from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User, Role
from src.models.task import Task
from datetime import datetime

task_bp = Blueprint('task', __name__)

def has_permission(user, permission_name):
    """Check if user has specific permission"""
    return user.has_permission(permission_name)

def has_role(user, role_name):
    """Check if user has specific role"""
    return any(role.name == role_name for role in user.roles)

@task_bp.route('/tasks', methods=['GET'])
@jwt_required()
def get_tasks():
    """Get tasks based on user role"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Admin and HR can see all tasks
        if has_role(user, 'Admin') or has_role(user, 'HR'):
            tasks = Task.query.all()
        else:
            # Employees see only their assigned tasks
            tasks = Task.query.filter_by(assigned_to_id=current_user_id).all()
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Pagination
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
@jwt_required()
def get_task(task_id):
    """Get a specific task"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        # Check if user has permission to view this task
        if not (has_role(user, 'Admin') or has_role(user, 'HR') or task.assigned_to_id == current_user_id):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        return jsonify({'task': task.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@task_bp.route('/tasks', methods=['POST'])
@jwt_required()
def create_task():
    """Create a new task (Admin and HR only)"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        # Only Admin and HR can create tasks
        if not (has_role(user, 'Admin') or has_role(user, 'HR')):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('title') or not data.get('assigned_to_id'):
            return jsonify({'error': 'Title and assigned_to_id are required'}), 400
        
        # Check if assigned user exists
        assigned_user = User.query.get(data['assigned_to_id'])
        if not assigned_user:
            return jsonify({'error': 'Assigned user not found'}), 404
        
        # Parse due_date if provided
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
        
        return jsonify({
            'message': 'Task created successfully',
            'task': task.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@task_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    """Update a task"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        data = request.get_json()
        
        # Admin and HR can update all fields
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
        # Employees can only update status of their own tasks
        elif task.assigned_to_id == current_user_id:
            if 'status' in data:
                task.status = data['status']
            else:
                return jsonify({'error': 'Employees can only update task status'}), 403
        else:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        db.session.commit()
        
        return jsonify({
            'message': 'Task updated successfully',
            'task': task.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@task_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    """Delete a task (Admin and HR only)"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        # Only Admin and HR can delete tasks
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

