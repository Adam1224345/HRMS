from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User, Role
from src.models.task import Task
from datetime import datetime
from functools import wraps

task_bp = Blueprint('task', __name__)

def optional_jwt_required(func):
    """
    Skip JWT check in DEBUG mode (for Swagger/cURL testing)
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if current_app.config.get("DEBUG", False):
            # In DEBUG mode: Skip JWT - return empty user context
            return func(*args, **kwargs)
        return jwt_required()(func)(*args, **kwargs)
    return wrapper

def has_permission(user, permission_name):
    """Check if user has specific permission"""
    return user.has_permission(permission_name)

def has_role(user, role_name):
    """Check if user has specific role"""
    return any(role.name == role_name for role in user.roles)

def debug_skip_auth(func):
    """
    Skip ALL auth checks in DEBUG mode
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if current_app.config.get("DEBUG", False):
            # In DEBUG mode: Skip ALL auth - act as Admin
            return func(*args, **kwargs)
        return func(*args, **kwargs)
    return wrapper



@task_bp.route('/tasks', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
def get_tasks():
    """
    Get all tasks (Admin/HR see all, others see their own)
    ---
    tags:
      - Tasks
    parameters:
      - name: page
        in: query
        type: integer
        required: false
        description: Page number for pagination
      - name: per_page
        in: query
        type: integer
        required: false
        description: Number of tasks per page
    responses:
      200:
        description: List of tasks retrieved successfully
      500:
        description: Server error
    """
    try:
        if current_app.config.get("DEBUG", False):
            # DEBUG: Show ALL tasks (no auth)
            tasks = Task.query.all()
        else:
            # PRODUCTION: Normal auth logic
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404

            if has_role(user, 'Admin') or has_role(user, 'HR'):
                tasks = Task.query.all()
            else:
                tasks = Task.query.filter_by(assigned_to_id=current_user_id).all()

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)

        total_tasks = len(tasks)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_tasks = tasks[start:end]

        return jsonify({
            'tasks': [task.to_dict() for task in paginated_tasks],
            'total': total_tasks,
            'page': page,
            'per_page': per_page,
            'pages': (total_tasks + per_page - 1) // per_page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@task_bp.route('/tasks/<int:task_id>', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
def get_task(task_id):
    """
    Get a specific task
    ---
    tags:
      - Tasks
    parameters:
      - name: task_id
        in: path
        required: true
        type: integer
        description: ID of the task
    responses:
      200:
        description: Task found
      404:
        description: Task not found
    """
    try:
        if current_app.config.get("DEBUG", False):
            # DEBUG: Show ANY task
            task = Task.query.get(task_id)
        else:
            # PRODUCTION: Normal auth logic
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            task = Task.query.get(task_id)

            if not task:
                return jsonify({'error': 'Task not found'}), 404

            if not (has_role(user, 'Admin') or has_role(user, 'HR') or task.assigned_to_id == current_user_id):
                return jsonify({'error': 'Insufficient permissions'}), 403

        if not task:
            return jsonify({'error': 'Task not found'}), 404

        return jsonify({'task': task.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@task_bp.route('/tasks', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
def create_task():
    """
    Create a new task (Admin and HR only)
    ---
    tags:
      - Tasks
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - title
            - assigned_to_id
          properties:
            title:
              type: string
              example: "Prepare monthly report"
            description:
              type: string
              example: "Compile HR statistics for the month"
            assigned_to_id:
              type: integer
              example: 5
            due_date:
              type: string
              format: date-time
              example: "2025-10-25T17:00:00Z"
            priority:
              type: string
              enum: [Low, Medium, High]
              example: "High"
    responses:
      201:
        description: Task created successfully
      400:
        description: Validation error
    """
    try:
        if current_app.config.get("DEBUG", False):
            # DEBUG: Allow ANY user to create tasks
            current_user_id = 1  # Fake Admin ID
        else:
            # PRODUCTION: Normal auth logic
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not (has_role(user, 'Admin') or has_role(user, 'HR')):
                return jsonify({'error': 'Insufficient permissions'}), 403

        data = request.get_json()
        if not data.get('title') or not data.get('assigned_to_id'):
            return jsonify({'error': 'Title and assigned_to_id are required'}), 400

        assigned_user = User.query.get(data['assigned_to_id'])
        if not assigned_user:
            return jsonify({'error': 'Assigned user not found'}), 404

        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid due_date format'}), 400

        task = Task(
            title=data['title'],
            description=data.get('description', ''),
            status=data.get('status', 'Pending'),
            priority=data.get('priority', 'Medium'),
            due_date=due_date,
            assigned_to_id=data['assigned_to_id'],
            assigned_by_id=current_user_id
        )

        db.session.add(task)
        db.session.commit()
        return jsonify({'message': 'Task created successfully', 'task': task.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@task_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@optional_jwt_required
@debug_skip_auth
def update_task(task_id):
    """
    Update a task
    ---
    tags:
      - Tasks
    parameters:
      - name: task_id
        in: path
        required: true
        type: integer
      - in: body
        name: body
        schema:
          type: object
          properties:
            title:
              type: string
            description:
              type: string
            status:
              type: string
              enum: [Pending, In Progress, Completed]
            priority:
              type: string
              enum: [Low, Medium, High]
            assigned_to_id:
              type: integer
            due_date:
              type: string
              format: date-time
    responses:
      200:
        description: Task updated successfully
    """
    try:
        if current_app.config.get("DEBUG", False):
            # DEBUG: Allow ANY updates
            current_user_id = 1  # Fake Admin ID
        else:
            # PRODUCTION: Normal auth logic
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)

        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        data = request.get_json()
        if current_app.config.get("DEBUG", False):
            # DEBUG: Allow ALL updates
            if 'title' in data:
                task.title = data['title']
            if 'description' in data:
                task.description = data['description']
            if 'status' in data:
                task.status = data['status']
            if 'priority' in data:
                task.priority = data['priority']
            if 'assigned_to_id' in data:
                assigned_user = User.query.get(data['assigned_to_id'])
                if not assigned_user:
                    return jsonify({'error': 'Assigned user not found'}), 404
                task.assigned_to_id = data['assigned_to_id']
            if 'due_date' in data:
                if data['due_date']:
                    try:
                        task.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
                    except ValueError:
                        return jsonify({'error': 'Invalid due_date format'}), 400
                else:
                    task.due_date = None
        else:
            # PRODUCTION: Normal permission logic
            if has_role(user, 'Admin') or has_role(user, 'HR'):
                if 'title' in data:
                    task.title = data['title']
                if 'description' in data:
                    task.description = data['description']
                if 'status' in data:
                    task.status = data['status']
                if 'priority' in data:
                    task.priority = data['priority']
                if 'assigned_to_id' in data:
                    assigned_user = User.query.get(data['assigned_to_id'])
                    if not assigned_user:
                        return jsonify({'error': 'Assigned user not found'}), 404
                    task.assigned_to_id = data['assigned_to_id']
                if 'due_date' in data:
                    if data['due_date']:
                        try:
                            task.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
                        except ValueError:
                            return jsonify({'error': 'Invalid due_date format'}), 400
                    else:
                        task.due_date = None
            elif task.assigned_to_id == current_user_id:
                if 'status' in data:
                    task.status = data['status']
                else:
                    return jsonify({'error': 'Employees can only update task status'}), 403
            else:
                return jsonify({'error': 'Insufficient permissions'}), 403

        db.session.commit()
        return jsonify({'message': 'Task updated successfully', 'task': task.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@task_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@optional_jwt_required
@debug_skip_auth
def delete_task(task_id):
    """
    Delete a task (Admin and HR only)
    ---
    tags:
      - Tasks
    parameters:
      - name: task_id
        in: path
        type: integer
        required: true
        description: ID of the task to delete
    responses:
      200:
        description: Task deleted successfully
    """
    try:
        if current_app.config.get("DEBUG", False):
            # DEBUG: Allow ANY deletion
            pass
        else:
            # PRODUCTION: Normal auth logic
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)

            if not (has_role(user, 'Admin') or has_role(user, 'HR')):
                return jsonify({'error': 'Insufficient permissions'}), 403

        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        db.session.delete(task)
        db.session.commit()
        return jsonify({'message': 'Task deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
