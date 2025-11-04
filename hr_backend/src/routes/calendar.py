from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from src.models.task import Task
from src.models.leave import Leave
from datetime import datetime
from functools import wraps

calendar_bp = Blueprint('calendar', __name__)

def optional_jwt_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if current_app.config.get("DEBUG", False):
            return func(*args, **kwargs)
        return jwt_required()(func)(*args, **kwargs)
    return wrapper

def debug_skip_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if current_app.config.get("DEBUG", False):
            return func(*args, **kwargs)
        return func(*args, **kwargs)
    return wrapper

def has_role(user, role_name):
    return any(role.name == role_name for role in user.roles)

@calendar_bp.route('/calendar/events', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
def get_calendar_events():
    """
    Get all calendar events (tasks and leaves) in ISO 8601 format for FullCalendar
    ---
    tags:
      - Calendar
    parameters:
      - name: start
        in: query
        type: string
        required: false
        description: Start date in ISO 8601 format (YYYY-MM-DD)
      - name: end
        in: query
        type: string
        required: false
        description: End date in ISO 8601 format (YYYY-MM-DD)
    responses:
      200:
        description: List of calendar events
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              title:
                type: string
              start:
                type: string
                format: date-time
              end:
                type: string
                format: date-time
              backgroundColor:
                type: string
              borderColor:
                type: string
              extendedProps:
                type: object
    """
    try:
        # Get date range from query parameters
        start_date = request.args.get('start', None)
        end_date = request.args.get('end', None)
        
        if current_app.config.get("DEBUG", False):
            current_user_id = 1
            user = User.query.get(current_user_id)
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
        
        # Check if user can view all events
        can_view_all = has_role(user, 'Admin') or has_role(user, 'HR')
        
        # Fetch tasks
        if can_view_all:
            tasks_query = Task.query
        else:
            tasks_query = Task.query.filter_by(assigned_to_id=current_user_id)
        
        # Apply date filters if provided
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                tasks_query = tasks_query.filter(Task.due_date >= start.date())
            except ValueError:
                pass
        
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                tasks_query = tasks_query.filter(Task.due_date <= end.date())
            except ValueError:
                pass
        
        tasks = tasks_query.all()
        
        # Fetch leaves
        if can_view_all:
            leaves_query = Leave.query
        else:
            leaves_query = Leave.query.filter_by(user_id=current_user_id)
        
        # Apply date filters if provided
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                leaves_query = leaves_query.filter(Leave.end_date >= start.date())
            except ValueError:
                pass
        
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                leaves_query = leaves_query.filter(Leave.start_date <= end.date())
            except ValueError:
                pass
        
        leaves = leaves_query.all()
        
        # Transform tasks to calendar events
        task_events = []
        for task in tasks:
            assigned_to_name = 'Unassigned'
            if task.assigned_to:
                assigned_to_name = f"{task.assigned_to.first_name} {task.assigned_to.last_name}"
            
            # Determine color based on status and priority
            if task.status == 'Completed':
                color = '#10B981'  # Green
            elif task.priority == 'High':
                color = '#EF4444'  # Red
            elif task.priority == 'Medium':
                color = '#F59E0B'  # Orange
            else:
                color = '#3B82F6'  # Blue
            
            task_events.append({
                'id': f'task-{task.id}',
                'title': f'📋 {task.title}',
                'start': task.due_date.isoformat() if task.due_date else None,
                'end': task.due_date.isoformat() if task.due_date else None,
                'backgroundColor': color,
                'borderColor': color,
                'extendedProps': {
                    'type': 'task',
                    'taskId': task.id,
                    'status': task.status,
                    'priority': task.priority,
                    'assignedTo': assigned_to_name,
                    'description': task.description
                }
            })
        
        # Transform leaves to calendar events
        leave_events = []
        for leave in leaves:
            employee_name = 'Unknown'
            if leave.user:
                employee_name = f"{leave.user.first_name} {leave.user.last_name}"
            
            # Determine color based on status
            if leave.status == 'Approved':
                color = '#8B5CF6'  # Purple
            elif leave.status == 'Rejected':
                color = '#6B7280'  # Gray
            else:
                color = '#F59E0B'  # Orange (Pending)
            
            leave_events.append({
                'id': f'leave-{leave.id}',
                'title': f'🏖️ {employee_name} - {leave.leave_type}',
                'start': leave.start_date.isoformat() if leave.start_date else None,
                'end': leave.end_date.isoformat() if leave.end_date else None,
                'backgroundColor': color,
                'borderColor': color,
                'extendedProps': {
                    'type': 'leave',
                    'leaveId': leave.id,
                    'status': leave.status,
                    'leaveType': leave.leave_type,
                    'employee': employee_name,
                    'reason': leave.reason,
                    'remarks': leave.remarks
                }
            })
        
        # Combine all events
        all_events = task_events + leave_events
        
        return jsonify(all_events), 200
        
    except Exception as e:
        print(f"[ERROR] Calendar events: {str(e)}")
        return jsonify({'error': 'Internal Server Error'}), 500
