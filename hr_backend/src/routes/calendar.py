from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from src.models.leave import Leave
from src.models.task import Task
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload
import holidays  
calendar_bp = Blueprint('calendar', __name__, url_prefix='/api')

# ===================================================================
# CONFIG: 2025 GOVERNMENT HOLIDAYS (Pakistan)
# ===================================================================
# We hardcode 2025 for 100% accuracy.
# For 2026-2045, the system will estimate automatically using the library.
OFFICIAL_HOLIDAYS_2025 = {
    "2025-02-05": "Kashmir Day",
    "2025-03-23": "Pakistan Day",
    "2025-03-31": "Eid-ul-Fitr (Day 1)",
    "2025-04-01": "Eid-ul-Fitr (Day 2)",
    "2025-04-02": "Eid-ul-Fitr (Day 3)",
    "2025-05-01": "Labour Day",
    "2025-06-07": "Eid-ul-Azha (Day 1)",
    "2025-06-08": "Eid-ul-Azha (Day 2)",
    "2025-06-09": "Eid-ul-Azha (Day 3)",
    "2025-07-05": "Ashura (9th Muharram)",
    "2025-07-06": "Ashura (10th Muharram)",
    "2025-08-14": "Independence Day",
    "2025-09-06": "Eid Milad-un-Nabi",
    "2025-11-09": "Iqbal Day",
    "2025-12-25": "Quaid-e-Azam Day / Christmas",
}

@calendar_bp.route('/calendar/events', methods=['GET'])
@jwt_required()
def get_calendar_events():
    """
    Get all calendar events (leaves + task due dates + public holidays up to 2045)
    """
    try:
        current_user_id = get_jwt_identity()

        # CRITICAL: Load user with roles eagerly to avoid lazy-load issues
        current_user = (
            User.query
            .options(joinedload(User.roles))
            .get(current_user_id)
        )

        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        # Determine if user is Admin or HR
        is_manager = any(role.name in ['Admin', 'HR'] for role in current_user.roles)

        events = []

        # ========================
        # 1. LEAVE REQUESTS
        # ========================
        if is_manager:
            leaves = Leave.query.options(joinedload(Leave.user)).all()
        else:
            leaves = Leave.query.options(joinedload(Leave.user)).filter_by(user_id=current_user_id).all()

        for leave in leaves:
            user = leave.user
            user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username

            start_dt = datetime.combine(leave.start_date, datetime.min.time())
            # End date is inclusive → add 1 day for FullCalendar "all-day" display
            end_dt = datetime.combine(leave.end_date, datetime.max.time()) + timedelta(days=1)

            events.append({
                'id': f'leave_{leave.id}',
                'title': f"{leave.leave_type} - {user_name}",
                'start': start_dt.isoformat(),
                'end': end_dt.isoformat(),  # FullCalendar treats end as exclusive
                'allDay': True,
                'type': 'leave',
                'status': leave.status,
                'backgroundColor': {
                    'Pending': '#ffc107',
                    'Approved': '#28a745',
                    'Rejected': '#dc3545'
                }.get(leave.status, '#6c757d'),
                'borderColor': '#333',
                'description': leave.reason or "No reason provided",
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'name': user_name,
                    'email': user.email
                } if user else None
            })

        # ========================
        # 2. TASK DEADLINES
        # ========================
        if is_manager:
            tasks = Task.query.options(
                joinedload(Task.assigned_to)
            ).filter(Task.due_date.isnot(None)).all()
        else:
            tasks = Task.query.options(
                joinedload(Task.assigned_to)
            ).filter(
                Task.assigned_to_id == current_user_id,
                Task.due_date.isnot(None)
            ).all()

        for task in tasks:
            assignee = task.assigned_to
            assignee_name = f"{assignee.first_name or ''} {assignee.last_name or ''}".strip() or assignee.username

            due_dt = datetime.combine(task.due_date, datetime.min.time())

            events.append({
                'id': f'task_{task.id}',
                'title': f"Task: {task.title}",
                'start': due_dt.isoformat(),
                'end': due_dt.isoformat(),
                'allDay': True,
                'type': 'task',
                'status': task.status,
                'priority': task.priority,
                'backgroundColor': {
                    'High': '#dc3545',
                    'Medium': '#ffc107',
                    'Low': '#28a745'
                }.get(task.priority, '#6c757d'),
                'borderColor': '#333',
                'description': task.description or "No description",
                'user': {
                    'id': assignee.id,
                    'username': assignee.username,
                    'name': assignee_name,
                    'email': assignee.email
                } if assignee else None
            })

        # ========================
        # 3. PUBLIC HOLIDAYS (Current Year -> 2045)
        # ========================
        curr_year = datetime.now().year
        
        # Generate list of years from Current Year to 2045 (inclusive)
        years_to_fetch = list(range(curr_year, 2046))
        
        # Use library for mathematical calculation (Estimate for future years)
        pk_holidays = holidays.PK(years=years_to_fetch)

        # Override 2025 with official list (Exact for this year)
        for date_str, name in OFFICIAL_HOLIDAYS_2025.items():
            h_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            pk_holidays[h_date] = name

        for h_date, name in pk_holidays.items():
            events.append({
                'id': f'holiday_{h_date}',
                'title': f"🌴 {name}", # Icon makes it look nice on calendar
                'start': h_date.isoformat(),
                'end': h_date.isoformat(),
                'allDay': True,
                'type': 'holiday',
                'status': 'Holiday',
                'backgroundColor': '#8b5cf6', # Purple/Violet color for Holidays
                'borderColor': 'transparent',
                'description': "Public Holiday (Government of Pakistan)",
                'user': None
            })

        return jsonify(events), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calendar_bp.route('/calendar/events/summary', methods=['GET'])
@jwt_required()
def get_calendar_summary():
    """
    Summary stats for dashboard
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.options(joinedload(User.roles)).get(current_user_id)
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        is_manager = any(role.name in ['Admin', 'HR'] for role in current_user.roles)
        
        # Determine current date based on server time (PKT) for comparison
        today = datetime.now().date() 

        # Leaves
        if is_manager:
            total_leaves = Leave.query.count()
            pending_leaves = Leave.query.filter_by(status='Pending').count()
        else:
            total_leaves = Leave.query.filter_by(user_id=current_user_id).count()
            pending_leaves = Leave.query.filter_by(user_id=current_user_id, status='Pending').count()

        # Tasks with due date
        if is_manager:
            total_tasks = Task.query.filter(Task.due_date.isnot(None)).count()
            overdue_tasks = Task.query.filter(
                Task.due_date < today,
                Task.status != 'Completed'
            ).count()
        else:
            total_tasks = Task.query.filter(
                Task.assigned_to_id == current_user_id,
                Task.due_date.isnot(None)
            ).count()
            overdue_tasks = Task.query.filter(
                Task.assigned_to_id == current_user_id,
                Task.due_date < today,
                Task.status != 'Completed'
            ).count()

        return jsonify({
            'total_events': total_leaves + total_tasks,
            'leave_requests': {
                'total': total_leaves,
                'pending': pending_leaves
            },
            'task_deadlines': {
                'total': total_tasks,
                'overdue': overdue_tasks
            },
            'upcoming_this_week': '...'  
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
