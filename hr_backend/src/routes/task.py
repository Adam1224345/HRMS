from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User, Role
from src.models.task import Task
from src.utils.audit_logger import log_audit_event
from src.utils.notifications import send_notification
from datetime import datetime
from sqlalchemy.orm import joinedload
from flasgger import swag_from

task_bp = Blueprint('task', __name__, url_prefix='/api')

# ===================================================================
# SWAGGER DOCUMENTATION & ROUTES
# ===================================================================

@task_bp.route('/tasks', methods=['GET'])
@swag_from({
    'tags': ['Tasks'],
    'summary': 'Get paginated tasks',
    'description': 'Admin/HR sees all tasks. Employee sees only assigned tasks.',
    'parameters': [
        {
            'name': 'page',
            'in': 'query',
            'type': 'integer',
            'description': 'Page number (starts at 1)',
            'default': 1
        },
        {
            'name': 'per_page',
            'in': 'query',
            'type': 'integer',
            'description': 'Number of tasks per page',
            'default': 10
        }
    ],
    'security': [{'Bearer': []}],
    'responses': {
        '200': {
            'description': 'Paginated list of tasks',
            'schema': {
                'type': 'object',
                'properties': {
                    'tasks': {'type': 'array', 'items': {'type': 'object'}},
                    'total': {'type': 'integer'},
                    'page': {'type': 'integer'},
                    'per_page': {'type': 'integer'},
                    'pages': {'type': 'integer'}
                }
            }
        },
        '401': {'description': 'Missing or invalid token'},
        '403': {'description': 'Forbidden'}
    }
})
@jwt_required()
def get_tasks():
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
    query = Task.query if is_admin_hr else Task.query.filter_by(assigned_to_id=current_user_id)

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'tasks': [t.to_dict() for t in pagination.items],
        'total': pagination.total or 0,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    }), 200


@task_bp.route('/tasks/user/<int:user_id>', methods=['GET'])
@swag_from({
    'tags': ['Tasks'],
    'summary': 'Get all tasks assigned to a specific User',
    'description': 'Fetch all tasks for a specific user ID. Employees can only view their own ID.',
    'parameters': [
        {'name': 'user_id', 'in': 'path', 'type': 'integer', 'required': True, 'description': 'ID of the user to fetch tasks for'}
    ],
    'security': [{'Bearer': []}],
    'responses': {
        '200': {'description': 'List of tasks for the user'},
        '401': {'description': 'Unauthorized'},
        '403': {'description': 'Forbidden'},
        '404': {'description': 'User not found'}
    }
})
@jwt_required()
def get_tasks_by_user(user_id):
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    
    # Check if target user exists
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
    
    # Permission Check: 
    # Admin/HR can view anyone's tasks. Employee can only view their own.
    if not (is_admin_hr or user_id == current_user_id):
        return jsonify({'error': 'Forbidden: You can only view your own tasks'}), 403

    # Fetch all tasks for this user
    tasks = Task.query.filter_by(assigned_to_id=user_id).all()

    return jsonify([t.to_dict() for t in tasks]), 200


@task_bp.route('/tasks', methods=['POST'])
@swag_from({
    'tags': ['Tasks'],
    'summary': 'Create new task (Admin/HR only)',
    'parameters': [
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'required': ['title', 'assigned_to_id'],
                'properties': {
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'priority': {'type': 'string', 'enum': ['Low', 'Medium', 'High']},
                    'due_date': {'type': 'string', 'format': 'date-time'},
                    'assigned_to_id': {'type': 'integer'}
                }
            }
        }
    ],
    'security': [{'Bearer': []}],
    'responses': {
        '201': {'description': 'Task created'},
        '400': {'description': 'Validation error'},
        '401': {'description': 'Unauthorized'},
        '403': {'description': 'Forbidden'}
    }
})
@jwt_required()
def create_task():
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not any(r.name in ['Admin', 'HR'] for r in user.roles):
        return jsonify({'error': 'Only Admin/HR can create tasks'}), 403

    data = request.get_json()
    if not data or not data.get('title') or data.get('assigned_to_id') is None:
        return jsonify({'error': 'title and assigned_to_id required'}), 400

    try:
        assigned_to_id = int(data['assigned_to_id'])
    except:
        return jsonify({'error': 'assigned_to_id must be integer'}), 400

    assigned_user = User.query.get(assigned_to_id)
    if not assigned_user:
        return jsonify({'error': 'Assigned user not found'}), 404

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
        except ValueError as e:
            return jsonify({'error': f'Invalid due_date: {e}'}), 400

    task = Task(
        title=data['title'].strip(),
        description=data.get('description', '').strip(),
        priority=data.get('priority', 'Medium'),
        status='Pending',
        due_date=due_date,
        assigned_to_id=assigned_to_id,
        assigned_by_id=current_user_id
    )

    db.session.add(task)
    db.session.flush()

    send_notification(
        recipient_id=assigned_to_id,
        message=f"New task: {task.title}",
        type='task_assignment',
        related_id=task.id,
        sender_id=current_user_id,
        send_email=True
    )

    log_audit_event(
        user_id=current_user_id,
        action='TASK_CREATED',
        resource_type='Task',
        resource_id=task.id,
        details={'title': task.title, 'assigned_to': assigned_to_id}
    )

    db.session.commit()
    return jsonify(task.to_dict()), 201


@task_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@swag_from({
    'tags': ['Tasks'],
    'summary': 'Update task (Admin/HR full, Employee status only)',
    'parameters': [
        {'name': 'task_id', 'in': 'path', 'type': 'integer', 'required': True},
        {
            'name': 'body',
            'in': 'body',
            'schema': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'priority': {'type': 'string', 'enum': ['Low', 'Medium', 'High']},
                    'due_date': {'type': 'string', 'format': 'date-time'},
                    'assigned_to_id': {'type': 'integer'},
                    'status': {'type': 'string', 'enum': ['Pending', 'In Progress', 'Completed']}
                }
            }
        }
    ],
    'security': [{'Bearer': []}],
    'responses': {
        '200': {'description': 'Task updated'},
        '400': {'description': 'Validation error'},
        '401': {'description': 'Unauthorized'},
        '403': {'description': 'Forbidden'},
        '404': {'description': 'Not found'}
    }
})
@jwt_required()
def update_task(task_id):
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    task = Task.query.get_or_404(task_id)
    data = request.get_json() or {}

    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
    is_assignee = task.assigned_to_id == current_user_id

    if not (is_admin_hr or is_assignee):
        return jsonify({'error': 'Forbidden'}), 403

    changes = []
    old_status = task.status
    old_assignee = task.assigned_to_id

    if is_admin_hr:
        for field in ['title', 'description', 'priority', 'due_date', 'assigned_to_id', 'status']:
            if field in data:
                value = data[field]
                if field == 'due_date' and value:
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except:
                        return jsonify({'error': 'Invalid due_date'}), 400
                if field == 'assigned_to_id':
                    try:
                        value = int(value)
                    except:
                        return jsonify({'error': 'assigned_to_id must be integer'}), 400
                    if not User.query.get(value):
                        return jsonify({'error': 'User not found'}), 404
                if getattr(task, field) != value:
                    changes.append(field)
                setattr(task, field, value)

    if not is_admin_hr and is_assignee:
        if not data.get('status'):
            return jsonify({'error': 'status is required'}), 400
        if data['status'] not in ['Pending', 'In Progress', 'Completed']:
            return jsonify({'error': 'Invalid status'}), 400
        if task.status != data['status']:
            changes.append('status')
        task.status = data['status']

    db.session.commit()

    if 'status' in changes and task.status == 'Completed':
        completer = user.username or user.email or "Employee"
        if task.assigned_by_id and task.assigned_by_id != current_user_id:
            send_notification(
                recipient_id=task.assigned_by_id,
                message=f"Task Completed: '{task.title}' by {completer}",
                type='task_completed',
                related_id=task.id,
                sender_id=current_user_id,
                send_email=True
            )
        for admin in User.query.join(User.roles).filter(Role.name.in_(['Admin', 'HR'])).all():
            if admin.id not in (current_user_id, task.assigned_by_id):
                send_notification(
                    recipient_id=admin.id,
                    message=f"Task Completed: '{task.title}' by {completer}",
                    type='task_completed',
                    related_id=task.id,
                    sender_id=current_user_id
                )

    if 'assigned_to_id' in changes and task.assigned_to_id != old_assignee:
        send_notification(
            recipient_id=task.assigned_to_id,
            message=f"Task reassigned: {task.title}",
            type='task_reassignment',
            related_id=task.id,
            sender_id=current_user_id,
            send_email=True
        )

    if changes:
        log_audit_event(
            user_id=current_user_id,
            action='TASK_UPDATED',
            resource_type='Task',
            resource_id=task.id,
            details={'changes': changes}
        )

    return jsonify(task.to_dict()), 200


@task_bp.route('/tasks/user/<int:user_id>', methods=['DELETE'])
@swag_from({
    'tags': ['Tasks'],
    'summary': 'Delete all tasks assigned to a specific User (Admin/HR only)',
    'parameters': [
        {'name': 'user_id', 'in': 'path', 'type': 'integer', 'required': True, 'description': 'ID of the user whose tasks will be deleted'}
    ],
    'security': [{'Bearer': []}],
    'responses': {
        '200': {'description': 'All tasks for the user deleted'},
        '401': {'description': 'Unauthorized'},
        '403': {'description': 'Forbidden'},
        '404': {'description': 'User not found or no tasks'}
    }
})
@jwt_required()
def delete_tasks_by_user(user_id):
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    
    # Validation: Only Admin/HR can delete
    if not user or not any(r.name in ['Admin', 'HR'] for r in user.roles):
        return jsonify({'error': 'Only Admin/HR can delete tasks'}), 403

    # Check if tasks exist for this user
    tasks = Task.query.filter_by(assigned_to_id=user_id).all()
    
    if not tasks:
        return jsonify({'message': 'No tasks found for this user'}), 404

    deleted_count = 0
    
    for task in tasks:
        # Log Audit Event for each deleted task
        log_audit_event(
            user_id=current_user_id,
            action='TASK_DELETED_BY_ADMIN',
            resource_type='Task',
            resource_id=task.id,
            details={'title': task.title, 'owner_user_id': user_id}
        )
        db.session.delete(task)
        deleted_count += 1
    
    db.session.commit()
    return jsonify({'message': f'Successfully deleted {deleted_count} tasks for user {user_id}'}), 200
