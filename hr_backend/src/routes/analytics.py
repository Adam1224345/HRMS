from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Role, db, user_roles
from src.models.task import Task
from src.models.leave import Leave
from sqlalchemy import func, extract
from datetime import datetime, timedelta

analytics_bp = Blueprint('analytics', __name__)

# ===================== ADMIN DASHBOARD =====================
@analytics_bp.route('/dashboard/admin', methods=['GET'])
@jwt_required()
def get_admin_dashboard_data():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Task Stats
        total_tasks = Task.query.count()
        completed_tasks = Task.query.filter(Task.status == 'Completed').count()
        completion_rate = round((completed_tasks / total_tasks * 100), 2) if total_tasks else 0

        status_raw = db.session.query(Task.status, func.count(Task.id))\
            .group_by(Task.status).all()
        tasks_by_status = {row[0] or 'Unknown': row[1] for row in status_raw}

        # Leave Stats
        total_requests = Leave.query.count()
        approved = Leave.query.filter(Leave.status == 'Approved').count()
        rejected = Leave.query.filter(Leave.status == 'Rejected').count()
        pending = total_requests - approved - rejected
        rejection_rate = round((rejected / total_requests * 100), 2) if total_requests else 0

        # Leave by Type
        type_raw = db.session.query(Leave.leave_type, func.count(Leave.id))\
            .group_by(Leave.leave_type).all()
        leave_by_type = {str(row[0]).capitalize(): row[1] for row in type_raw if row[0]}

        # Monthly Trend 
        one_year_ago = datetime.utcnow() - timedelta(days=365)
        monthly_raw = db.session.query(
            func.date_trunc('month', Leave.created_at).label('month'),
            func.count(Leave.id)
        ).filter(Leave.created_at >= one_year_ago)\
         .group_by(func.date_trunc('month', Leave.created_at))\
         .order_by('month').all()

        monthly_trend = [
            {"month": row.month.strftime('%Y-%m'), "count": int(row[1])}
            for row in monthly_raw
        ]

        # User Stats
        total_users = User.query.count()
        users_by_role_raw = db.session.query(
            Role.name, func.count(User.id)
        ).join(user_roles, User.id == user_roles.c.user_id, isouter=True)\
         .join(Role, Role.id == user_roles.c.role_id, isouter=True)\
         .group_by(Role.name).all()

        users_by_role = {row[0] or 'Unknown': row[1] for row in users_by_role_raw}

        return jsonify({
            'task_stats': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'completion_rate': completion_rate,
                'tasks_by_status': tasks_by_status
            },
            'leave_stats': {
                'total_requests': total_requests,
                'approved_requests': approved,
                'pending_requests': pending,
                'rejection_rate': rejection_rate,
                'leave_by_type': leave_by_type,
                'monthly_trend': monthly_trend
            },
            'user_stats': {
                'total_users': total_users,
                'users_by_role': users_by_role
            }
        }), 200

    except Exception as e:
        print(f"[ERROR] Admin dashboard: {str(e)}")
        return jsonify({'error': 'Internal Server Error'}), 500


# ===================== EMPLOYEE DASHBOARD =====================
@analytics_bp.route('/dashboard/employee', methods=['GET'])
@jwt_required()
def get_employee_dashboard_data():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # My Tasks
        my_tasks = Task.query.filter_by(assigned_to_id=user.id)
        total_tasks = my_tasks.count()
        completed_tasks = my_tasks.filter(Task.status == 'Completed').count()
        completion_rate = round((completed_tasks / total_tasks * 100), 2) if total_tasks else 0

        status_raw = db.session.query(Task.status, func.count(Task.id))\
            .filter(Task.assigned_to_id == user.id)\
            .group_by(Task.status).all()
        tasks_by_status = {row[0] or 'Unknown': row[1] for row in status_raw}

        priority_raw = db.session.query(Task.priority, func.count(Task.id))\
            .filter(Task.assigned_to_id == user.id)\
            .group_by(Task.priority).all()
        tasks_by_priority = {row[0] or 'Low': row[1] for row in priority_raw}

        # My Leaves
        my_leaves = Leave.query.filter_by(user_id=user.id)
        total_requests = my_leaves.count()
        pending_requests = my_leaves.filter(Leave.status == 'Pending').count()

        # Monthly Trend (FIXED for PostgreSQL)
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly_raw = db.session.query(
            func.date_trunc('month', Leave.start_date).label('month'),
            func.count(Leave.id)
        ).filter(
            Leave.user_id == user.id,
            Leave.start_date >= six_months_ago
        ).group_by(func.date_trunc('month', Leave.start_date))\
         .order_by('month').all()

        monthly_trend = [
            {"month": row.month.strftime('%Y-%m'), "count": int(row[1])}
            for row in monthly_raw
        ]

        return jsonify({
            'my_task_stats': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'completion_rate': completion_rate,
                'tasks_by_status': tasks_by_status,
                'tasks_by_priority': tasks_by_priority
            },
            'my_leave_stats': {
                'total_requests': total_requests,
                'pending_requests': pending_requests,
                'monthly_trend': monthly_trend
            }
        }), 200

    except Exception as e:
        print(f"[ERROR] Employee dashboard: {str(e)}")
        return jsonify({'error': 'Internal Server Error'}), 500