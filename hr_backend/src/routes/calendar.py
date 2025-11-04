from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from src.models.leave import Leave
from src.models.task import Task
from datetime import datetime

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/calendar/events', methods=['GET'])
@jwt_required()
def get_calendar_events():
    """
    Get all calendar events (leave requests and task deadlines) for managers
    ---
    tags:
      - Calendar
    security:
      - Bearer: []
    responses:
      200:
        description: List of calendar events in ISO 8601 format
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
                description: Event ID (format - leave_{id} or task_{id})
              title:
                type: string
                description: Event title
              start:
                type: string
                format: date-time
                description: Event start date in ISO 8601 format
              end:
                type: string
                format: date-time
                description: Event end date in ISO 8601 format
              type:
                type: string
                description: Event type (leave or task)
              status:
                type: string
                description: Event status
              description:
                type: string
                description: Event description
              user:
                type: object
                description: User associated with the event
              priority:
                type: string
                description: Priority (for tasks only)
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        events = []

        # Check if user is a manager (Admin or HR role)
        user_roles = [role.name for role in current_user.roles]
        is_manager = 'Admin' in user_roles or 'HR' in user_roles

        if is_manager:
            # Managers can see all leave requests and tasks
            leaves = Leave.query.all()
            tasks = Task.query.all()
        else:
            # Regular employees can only see their own leave requests and assigned tasks
            leaves = Leave.query.filter_by(user_id=current_user_id).all()
            tasks = Task.query.filter_by(assigned_to_id=current_user_id).all()

        # Add leave requests to events
        for leave in leaves:
            # Convert date to datetime for ISO 8601 format
            start_datetime = datetime.combine(leave.start_date, datetime.min.time())
            end_datetime = datetime.combine(leave.end_date, datetime.max.time())

            events.append({
                'id': f'leave_{leave.id}',
                'title': f'{leave.leave_type} - {leave.user.first_name} {leave.user.last_name}',
                'start': start_datetime.isoformat(),
                'end': end_datetime.isoformat(),
                'type': 'leave',
                'status': leave.status,
                'description': leave.reason,
                'user': {
                    'id': leave.user.id,
                    'username': leave.user.username,
                    'first_name': leave.user.first_name,
                    'last_name': leave.user.last_name,
                    'email': leave.user.email
                } if leave.user else None
            })

        # Add task deadlines to events
        for task in tasks:
            if task.due_date:
                events.append({
                    'id': f'task_{task.id}',
                    'title': f'Task: {task.title}',
                    'start': task.due_date.isoformat(),
                    'end': task.due_date.isoformat(),
                    'type': 'task',
                    'status': task.status,
                    'description': task.description,
                    'priority': task.priority,
                    'user': {
                        'id': task.assigned_to.id,
                        'username': task.assigned_to.username,
                        'first_name': task.assigned_to.first_name,
                        'last_name': task.assigned_to.last_name,
                        'email': task.assigned_to.email
                    } if task.assigned_to else None
                })

        return jsonify(events), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calendar_bp.route('/calendar/events/summary', methods=['GET'])
@jwt_required()
def get_calendar_summary():
    """
    Get calendar events summary statistics
    ---
    tags:
      - Calendar
    security:
      - Bearer: []
    responses:
      200:
        description: Calendar events summary
        schema:
          type: object
          properties:
            total_events:
              type: integer
            leave_requests:
              type: object
            task_deadlines:
              type: object
      401:
        description: Unauthorized
      500:
        description: Internal server error
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        user_roles = [role.name for role in current_user.roles]
        is_manager = 'Admin' in user_roles or 'HR' in user_roles

        if is_manager:
            leaves = Leave.query.all()
            tasks = Task.query.filter(Task.due_date.isnot(None)).all()
        else:
            leaves = Leave.query.filter_by(user_id=current_user_id).all()
            tasks = Task.query.filter_by(assigned_to_id=current_user_id).filter(
                Task.due_date.isnot(None)
            ).all()

        # Calculate leave statistics
        leave_stats = {
            'total': len(leaves),
            'pending': len([l for l in leaves if l.status == 'Pending']),
            'approved': len([l for l in leaves if l.status == 'Approved']),
            'rejected': len([l for l in leaves if l.status == 'Rejected'])
        }

        # Calculate task statistics
        task_stats = {
            'total': len(tasks),
            'pending': len([t for t in tasks if t.status == 'Pending']),
            'in_progress': len([t for t in tasks if t.status == 'In Progress']),
            'completed': len([t for t in tasks if t.status == 'Completed'])
        }

        return jsonify({
            'total_events': len(leaves) + len(tasks),
            'leave_requests': leave_stats,
            'task_deadlines': task_stats
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
