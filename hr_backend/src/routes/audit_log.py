# src/routes/audit_log.py
from flask import Blueprint, request, jsonify, current_app
from src.models.audit_log import AuditLog
from sqlalchemy import desc
from datetime import datetime

audit_log_bp = Blueprint('audit_log', __name__)

@audit_log_bp.route('/audit-logs', methods=['GET'])
def get_audit_logs():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        user_id = request.args.get('user_id', type=int)
        action = request.args.get('action', type=str)
        start = request.args.get('start_date', type=str)
        end = request.args.get('end_date', type=str)

        q = AuditLog.query

        if user_id:
            q = q.filter(AuditLog.user_id == user_id)
        if action:
            q = q.filter(AuditLog.action.ilike(f'%{action}%'))
        if start:
            try:
                s = datetime.strptime(start, '%Y-%m-%d')
                q = q.filter(AuditLog.timestamp >= s)
            except ValueError:
                return jsonify({'error': 'Invalid start_date'}), 400
        if end:
            try:
                e = datetime.strptime(end, '%Y-%m-%d')
                e = e.replace(hour=23, minute=59, second=59)
                q = q.filter(AuditLog.timestamp <= e)
            except ValueError:
                return jsonify({'error': 'Invalid end_date'}), 400

        q = q.order_by(desc(AuditLog.timestamp))
        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        logs = [log.to_dict() for log in paginated.items]
        total = paginated.total if paginated.total is not None else 0

        return jsonify({
            'logs': logs,
            'total': total,
            'page': paginated.page,
            'per_page': paginated.per_page,
            'pages': paginated.pages
        }), 200

    except Exception as e:
        current_app.logger.error(f"Audit log error: {e}")
        return jsonify({'error': 'Server error'}), 500