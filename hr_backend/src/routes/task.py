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
# SWAGGER DOCUMENTATION
# ===================================================================

get_tasks_docs = {
    "tags": ["Tasks"],
    "summary": "Get all tasks (Admin/HR: all, Employee: own)",
    "parameters": [
        {"name": "page", "in": "query", "type": "integer", "default": 1},
        {"name": "per_page", "in": "query", "type": "integer", "default": 10}
    ],
    "responses": {"200": {"description": "Paginated tasks"}},
    "security": [{"bearerAuth": []}]
}

get_task_docs = {
    "tags": ["Tasks"],
    "summary": "Get a specific task",
    "parameters": [{"name": "task_id", "in": "path", "type": "integer", "required": True}],
    "responses": {
        "200": {"description": "Task details"},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}

create_task_docs = {
    "tags": ["Tasks"],
    "summary": "Create a new task (Admin/HR only)",
    "parameters": [{
        "name": "body",
        "in": "body",
        "required": True,
        "schema": {
            "type": "object",
            "required": ["title", "assigned_to_id"],
            "properties": {
                "title": {"type": "string", "example": "Fix login bug"},
                "description": {"type": "string", "example": "Users can't login"},
                "priority": {"type": "string", "enum": ["Low", "Medium", "High"], "example": "High"},
                "due_date": {"type": "string", "format": "date-time", "example": "2025-12-25T17:00:00Z"},
                "assigned_to_id": {"type": "integer", "example": 7}
            }
        }
    }],
    "responses": {"201": {"description": "Task created"}, "403": {"description": "Forbidden"}},
    "security": [{"bearerAuth": []}]
}

update_task_docs = {
    "tags": ["Tasks"],
    "summary": "Update task (Admin/HR: anything, Employee: only status)",
    "parameters": [
        {"name": "task_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object"}}
    ],
    "responses": {"200": {"description": "Updated"}, "403": {"description": "Forbidden"}},
    "security": [{"bearerAuth": []}]
}

delete_task_docs = {
    "tags": ["Tasks"],
    "summary": "Delete task (Admin/HR only)",
    "parameters": [{"name": "task_id", "in": "path", "type": "integer", "required": True}],
    "responses": {"200": {"description": "Deleted"}, "403": {"description": "Forbidden"}},
    "security": [{"bearerAuth": []}]
}

# ===================================================================
# ROUTES
# ===================================================================

@task_bp.route('/tasks', methods=['GET'])
@jwt_required()
@swag_from(get_tasks_docs)
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


@task_bp.route('/tasks/<int:task_id>', methods=['GET'])
@jwt_required()
@swag_from(get_task_docs)
def get_task(task_id):
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    task = Task.query.get_or_404(task_id)

    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
    if not (is_admin_hr or task.assigned_to_id == current_user_id):
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify(task.to_dict()), 200


@task_bp.route('/tasks', methods=['POST'])
@jwt_required()
@swag_from(create_task_docs)
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

    # Notify employee
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
@jwt_required()
@swag_from(update_task_docs)
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

    # Admin/HR can update everything
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

    # Employee can only update status
    if not is_admin_hr and is_assignee:
        if not data.get('status'):
            return jsonify({'error': 'status is required'}), 400
        if data['status'] not in ['Pending', 'In Progress', 'Completed']:
            return jsonify({'error': 'Invalid status'}), 400
        if task.status != data['status']:
            changes.append('status')
        task.status = data['status']

    db.session.commit()

    # NOTIFICATIONS
    if 'status' in changes and task.status == 'Completed':
        completer = user.username or user.email or "Employee"
        # Notify creator
        if task.assigned_by_id and task.assigned_by_id != current_user_id:
            send_notification(
                recipient_id=task.assigned_by_id,
                message=f"Task Completed: '{task.title}' by {completer}",
                type='task_completed',
                related_id=task.id,
                sender_id=current_user_id,
                send_email=True
            )
        # Notify all Admin/HR
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


@task_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
@swag_from(delete_task_docs)
def delete_task(task_id):
    current_user_id = get_jwt_identity()
    try:
        current_user_id = int(current_user_id)
    except:
        return jsonify({'error': 'Invalid token'}), 401

    user = User.query.options(joinedload(User.roles)).get(current_user_id)
    if not user or not any(r.name in ['Admin', 'HR'] for r in user.roles):
        return jsonify({'error': 'Only Admin/HR can delete'}), 403

    task = Task.query.get_or_404(task_id)
    
    
    log_audit_event(
        user_id=current_user_id,
        action='TASK_DELETED',
        resource_type='Task',
        resource_id=task.id,
        details={'title': task.title}
    )
    
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Task deleted'}), 200