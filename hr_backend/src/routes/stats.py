from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Role, db, user_roles
from src.models.task import Task
from src.models.leave import Leave
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta
from functools import wraps

stats_bp = Blueprint('stats', __name__)

def has_role(user, role_name):
    return any(role.name == role_name for role in user.roles)

# ===================== TASK STATISTICS =====================
@stats_bp.route('/stats/tasks', methods=['GET'])
@jwt_required()
def get_task_statistics():
    """
    Get detailed task statistics
    ---
    tags:
      - Statistics
    parameters:
      - name: period
        in: query
        type: string
        required: false
        description: Time period (week, month, year, all)
        default: all
    responses:
      200:
        description: Task statistics
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        period = request.args.get('period', 'all')
        can_view_all = has_role(user, 'Admin') or has_role(user, 'HR')
        
        # Base query
        if can_view_all:
            base_query = Task.query
        else:
            base_query = Task.query.filter_by(assigned_to_id=current_user_id)
        
        # Apply time filter
        if period == 'week':
            start_date = datetime.utcnow() - timedelta(days=7)
            base_query = base_query.filter(Task.created_at >= start_date)
        elif period == 'month':
            start_date = datetime.utcnow() - timedelta(days=30)
            base_query = base_query.filter(Task.created_at >= start_date)
        elif period == 'year':
            start_date = datetime.utcnow() - timedelta(days=365)
            base_query = base_query.filter(Task.created_at >= start_date)
        
        # Total counts
        total_tasks = base_query.count()
        completed_tasks = base_query.filter(Task.status == 'Completed').count()
        in_progress_tasks = base_query.filter(Task.status == 'In Progress').count()
        pending_tasks = base_query.filter(Task.status == 'Pending').count()
        
        # Completion rate
        completion_rate = round((completed_tasks / total_tasks * 100), 2) if total_tasks else 0
        
        # Tasks by status
        status_raw = db.session.query(Task.status, func.count(Task.id))\
            .filter(Task.id.in_([t.id for t in base_query.all()]))\
            .group_by(Task.status).all()
        tasks_by_status = {row[0] or 'Unknown': row[1] for row in status_raw}
        
        # Tasks by priority
        priority_raw = db.session.query(Task.priority, func.count(Task.id))\
            .filter(Task.id.in_([t.id for t in base_query.all()]))\
            .group_by(Task.priority).all()
        tasks_by_priority = {row[0] or 'Low': row[1] for row in priority_raw}
        
        # Overdue tasks
        today = datetime.utcnow().date()
        overdue_tasks = base_query.filter(
            and_(Task.due_date < today, Task.status != 'Completed')
        ).count()
        
        # Tasks due this week
        week_end = today + timedelta(days=7)
        due_this_week = base_query.filter(
            and_(
                Task.due_date >= today,
                Task.due_date <= week_end,
                Task.status != 'Completed'
            )
        ).count()
        
        # Average completion time (for completed tasks)
        completed_with_dates = base_query.filter(
            and_(Task.status == 'Completed', Task.updated_at.isnot(None))
        ).all()
        
        avg_completion_days = 0
        if completed_with_dates:
            total_days = 0
            for task in completed_with_dates:
                if task.created_at and task.updated_at:
                    delta = task.updated_at - task.created_at
                    total_days += delta.days
            avg_completion_days = round(total_days / len(completed_with_dates), 1)
        
        return jsonify({
            'period': period,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'pending_tasks': pending_tasks,
            'completion_rate': completion_rate,
            'tasks_by_status': tasks_by_status,
            'tasks_by_priority': tasks_by_priority,
            'overdue_tasks': overdue_tasks,
            'due_this_week': due_this_week,
            'avg_completion_days': avg_completion_days
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Task statistics: {str(e)}")
        return jsonify({'error': 'Internal Server Error'}), 500


# ===================== LEAVE STATISTICS =====================
@stats_bp.route('/stats/leaves', methods=['GET'])
@jwt_required()
def get_leave_statistics():
    """
    Get detailed leave statistics
    ---
    tags:
      - Statistics
    parameters:
      - name: period
        in: query
        type: string
        required: false
        description: Time period (week, month, year, all)
        default: all
    responses:
      200:
        description: Leave statistics
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        period = request.args.get('period', 'all')
        can_view_all = has_role(user, 'Admin') or has_role(user, 'HR')
        
        # Base query
        if can_view_all:
            base_query = Leave.query
        else:
            base_query = Leave.query.filter_by(user_id=current_user_id)
        
        # Apply time filter
        if period == 'week':
            start_date = datetime.utcnow() - timedelta(days=7)
            base_query = base_query.filter(Leave.created_at >= start_date)
        elif period == 'month':
            start_date = datetime.utcnow() - timedelta(days=30)
            base_query = base_query.filter(Leave.created_at >= start_date)
        elif period == 'year':
            start_date = datetime.utcnow() - timedelta(days=365)
            base_query = base_query.filter(Leave.created_at >= start_date)
        
        # Total counts
        total_requests = base_query.count()
        approved_requests = base_query.filter(Leave.status == 'Approved').count()
        rejected_requests = base_query.filter(Leave.status == 'Rejected').count()
        pending_requests = base_query.filter(Leave.status == 'Pending').count()
        
        # Approval rate
        approval_rate = round((approved_requests / total_requests * 100), 2) if total_requests else 0
        rejection_rate = round((rejected_requests / total_requests * 100), 2) if total_requests else 0
        
        # Leaves by type
        type_raw = db.session.query(Leave.leave_type, func.count(Leave.id))\
            .filter(Leave.id.in_([l.id for l in base_query.all()]))\
            .group_by(Leave.leave_type).all()
        leave_by_type = {str(row[0]): row[1] for row in type_raw if row[0]}
        
        # Leaves by status
        status_raw = db.session.query(Leave.status, func.count(Leave.id))\
            .filter(Leave.id.in_([l.id for l in base_query.all()]))\
            .group_by(Leave.status).all()
        leave_by_status = {row[0] or 'Unknown': row[1] for row in status_raw}
        
        # Total leave days
        total_days = 0
        approved_leaves = base_query.filter(Leave.status == 'Approved').all()
        for leave in approved_leaves:
            if leave.start_date and leave.end_date:
                delta = leave.end_date - leave.start_date
                total_days += delta.days + 1
        
        # Average leave duration
        avg_duration = round(total_days / len(approved_leaves), 1) if approved_leaves else 0
        
        # Monthly trend (last 6 months)
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly_raw = db.session.query(
            func.strftime('%Y-%m', Leave.created_at),
            func.count(Leave.id)
        ).filter(
            and_(
                Leave.id.in_([l.id for l in base_query.all()]),
                Leave.created_at >= six_months_ago
            )
        ).group_by(func.strftime('%Y-%m', Leave.created_at))\
         .order_by(func.strftime('%Y-%m', Leave.created_at)).all()
        
        monthly_trend = [{"month": row[0], "count": int(row[1])} for row in monthly_raw]
        
        return jsonify({
            'period': period,
            'total_requests': total_requests,
            'approved_requests': approved_requests,
            'rejected_requests': rejected_requests,
            'pending_requests': pending_requests,
            'approval_rate': approval_rate,
            'rejection_rate': rejection_rate,
            'leave_by_type': leave_by_type,
            'leave_by_status': leave_by_status,
            'total_leave_days': total_days,
            'avg_leave_duration': avg_duration,
            'monthly_trend': monthly_trend
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Leave statistics: {str(e)}")
        return jsonify({'error': 'Internal Server Error'}), 500


# ===================== USER STATISTICS =====================
@stats_bp.route('/stats/users', methods=['GET'])
@jwt_required()
def get_user_statistics():
    """
    Get user statistics (Admin/HR only)
    ---
    tags:
      - Statistics
    responses:
      200:
        description: User statistics
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check permissions
        if not (has_role(user, 'Admin') or has_role(user, 'HR')):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Total users
        total_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count()
        inactive_users = total_users - active_users
        
        # Users by role
        users_by_role_raw = db.session.query(
            Role.name, func.count(User.id)
        ).join(user_roles, User.id == user_roles.c.user_id, isouter=True)\
         .join(Role, Role.id == user_roles.c.role_id, isouter=True)\
         .group_by(Role.name).all()
        
        users_by_role = {row[0] or 'No Role': row[1] for row in users_by_role_raw}
        
        # New users (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        new_users = User.query.filter(User.created_at >= thirty_days_ago).count()
        
        # Users with tasks
        users_with_tasks = db.session.query(func.count(func.distinct(Task.assigned_to_id))).scalar() or 0
        
        # Users with leaves
        users_with_leaves = db.session.query(func.count(func.distinct(Leave.user_id))).scalar() or 0
        
        return jsonify({
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'users_by_role': users_by_role,
            'new_users_last_30_days': new_users,
            'users_with_tasks': users_with_tasks,
            'users_with_leaves': users_with_leaves
        }), 200
        
    except Exception as e:
        print(f"[ERROR] User statistics: {str(e)}")
        return jsonify({'error': 'Internal Server Error'}), 500
