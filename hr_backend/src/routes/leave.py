from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.utils.audit_logger import log_audit_event
from src.models.user import db, User
from src.models.leave import Leave
from datetime import datetime
from functools import wraps
from flasgger import swag_from

leave_bp = Blueprint('leave', __name__)


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

get_leaves_docs = {
    "tags": ["Leave"],
    "summary": "Get all leave requests (paginated)",
    "description": "Admins/HR see all leaves. Employees see only their own.",
    "parameters": [
        {"name": "page", "in": "query", "type": "integer", "default": 1},
        {"name": "per_page", "in": "query", "type": "integer", "default": 10},
        {"name": "status", "in": "query", "type": "string", "enum": ["Pending", "Approved", "Rejected"]}
    ],
    "responses": {
        "200": {
            "description": "Paginated list of leaves",
            "schema": {
                "type": "object",
                "properties": {
                    "leaves": {"type": "array", "items": {"$ref": "#/definitions/Leave"}},
                    "total": {"type": "integer"},
                    "page": {"type": "integer"},
                    "per_page": {"type": "integer"},
                    "pages": {"type": "integer"}
                }
            }
        }
    },
    "security": [{"bearerAuth": []}]
}

get_leave_docs = {
    "tags": ["Leave"],
    "summary": "Get a specific leave request",
    "parameters": [{"name": "leave_id", "in": "path", "type": "integer", "required": True}],
    "responses": {
        "200": {"description": "Leave details", "schema": {"$ref": "#/definitions/Leave"}},
        "404": {"description": "Leave not found"}
    },
    "security": [{"bearerAuth": []}]
}

create_leave_docs = {
    "tags": ["Leave"],
    "summary": "Create a new leave request",
    "parameters": [{
        "name": "body",
        "in": "body",
        "required": True,
        "schema": {
            "type": "object",
            "properties": {
                "leave_type": {"type": "string", "example": "Annual"},
                "start_date": {"type": "string", "format": "date", "example": "2025-12-01"},
                "end_date": {"type": "string", "format": "date", "example": "2025-12-05"},
                "reason": {"type": "string", "example": "Vacation"}
            },
            "required": ["leave_type", "start_date", "end_date", "reason"]
        }
    }],
    "responses": {
        "201": {"description": "Leave created", "schema": {"$ref": "#/definitions/Leave"}},
        "400": {"description": "Invalid input"}
    },
    "security": [{"bearerAuth": []}]
}

update_leave_docs = {
    "tags": ["Leave"],
    "summary": "Update a leave request",
    "description": "Admin/HR can update status. Owner can edit if Pending.",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {
            "name": "body",
            "in": "body",
            "schema": {
                "type": "object",
                "properties": {
                    "leave_type": {"type": "string"},
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "reason": {"type": "string"},
                    "status": {"type": "string", "enum": ["Pending", "Approved", "Rejected"]},
                    "remarks": {"type": "string"}
                }
            }
        }
    ],
    "responses": {
        "200": {"description": "Leave updated", "schema": {"$ref": "#/definitions/Leave"}},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}

delete_leave_docs = {
    "tags": ["Leave"],
    "summary": "Delete a leave request",
    "description": "Admin or owner (if Pending) can delete.",
    "parameters": [{"name": "leave_id", "in": "path", "type": "integer", "required": True}],
    "responses": {
        "200": {"description": "Leave deleted"},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}

approve_leave_docs = {
    "tags": ["Leave"],
    "summary": "Approve a leave request (Admin/HR only)",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {
            "name": "body",
            "in": "body",
            "schema": {
                "type": "object",
                "properties": {"remarks": {"type": "string", "example": "Approved"}}
            }
        }
    ],
    "responses": {
        "200": {"description": "Leave approved", "schema": {"$ref": "#/definitions/Leave"}},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}

reject_leave_docs = {
    "tags": ["Leave"],
    "summary": "Reject a leave request (Admin/HR only)",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {
            "name": "body",
            "in": "body",
            "schema": {
                "type": "object",
                "properties": {"remarks": {"type": "string", "example": "Insufficient balance"}}
            }
        }
    ],
    "responses": {
        "200": {"description": "Leave rejected", "schema": {"$ref": "#/definitions/Leave"}},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}


@leave_bp.route('/leaves', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
@swag_from(get_leaves_docs)
def get_leaves():
    try:
        if current_app.config.get("DEBUG", False):
            leaves = Leave.query.all()
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            if has_role(user, 'Admin') or has_role(user, 'HR'):
                leaves = Leave.query.all()
            else:
                leaves = Leave.query.filter_by(user_id=current_user_id).all()

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status_filter = request.args.get('status')

        if status_filter:
            leaves = [l for l in leaves if l.status == status_filter]

        total = len(leaves)
        start = (page - 1) * per_page
        end = start + per_page
        paginated = leaves[start:end]

        return jsonify({
            'leaves': [l.to_dict() for l in paginated],
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@leave_bp.route('/leaves/<int:leave_id>', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
@swag_from(get_leave_docs)
def get_leave(leave_id):
    try:
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        if current_app.config.get("DEBUG", False):
            return jsonify(leave.to_dict()), 200

        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not (has_role(user, 'Admin') or has_role(user, 'HR') or leave.user_id == current_user_id):
            return jsonify({'error': 'Insufficient permissions'}), 403

        return jsonify(leave.to_dict()), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@leave_bp.route('/leaves', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
@swag_from(create_leave_docs)
def create_leave():
    try:
        current_user_id = 1 if current_app.config.get("DEBUG", False) else get_jwt_identity()

        data = request.get_json()
        required = ['leave_type', 'start_date', 'end_date', 'reason']
        for field in required:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        if end_date < start_date:
            return jsonify({'error': 'End date must be after start date'}), 400

        leave = Leave(
            leave_type=data['leave_type'],
            start_date=start_date,
            end_date=end_date,
            reason=data['reason'],
            status='Pending',
            user_id=current_user_id
        )
        db.session.add(leave)
        db.session.commit()

        log_audit_event(
            user_id=current_user_id,
            action='LEAVE_REQUESTED',
            resource_type='Leave',
            resource_id=leave.id,
            details={'type': leave.leave_type, 'dates': f"{leave.start_date} to {leave.end_date}"}
        )

        return jsonify(leave.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@leave_bp.route('/leaves/<int:leave_id>', methods=['PUT'])
@optional_jwt_required
@debug_skip_auth
@swag_from(update_leave_docs)
def update_leave(leave_id):
    try:
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        data = request.get_json() or {}
        current_user_id = 1 if current_app.config.get("DEBUG", False) else get_jwt_identity()
        user = User.query.get(current_user_id) if not current_app.config.get("DEBUG", False) else None

        is_admin_hr = current_app.config.get("DEBUG", False) or (user and (has_role(user, 'Admin') or has_role(user, 'HR')))
        is_owner_pending = leave.user_id == current_user_id and leave.status == 'Pending'

        if not (is_admin_hr or is_owner_pending):
            return jsonify({'error': 'Insufficient permissions'}), 403

        old_status = leave.status
        new_status = data.get('status')

        if is_admin_hr:
            if 'status' in data and data['status'] in ['Pending', 'Approved', 'Rejected']:
                leave.status = data['status']
                leave.reviewed_by_id = current_user_id
            if 'remarks' in data:
                leave.remarks = data['remarks']

        if is_owner_pending:
            for field in ['leave_type', 'reason']:
                if field in data:
                    setattr(leave, field, data[field])
            for field in ['start_date', 'end_date']:
                if field in data:
                    try:
                        date = datetime.strptime(data[field], '%Y-%m-%d').date()
                        setattr(leave, field, date)
                    except ValueError:
                        return jsonify({'error': f'Invalid {field} format'}), 400

        if leave.end_date < leave.start_date:
            return jsonify({'error': 'End date must be after start date'}), 400

        db.session.commit()

        if new_status and new_status != old_status:
            action = f"LEAVE_{new_status.upper()}"
            log_audit_event(
                user_id=current_user_id,
                action=action,
                resource_type='Leave',
                resource_id=leave_id,
                details={'from_status': old_status, 'to_status': new_status, 'user_id': leave.user_id}
            )
        elif is_owner_pending and any(k in data for k in ['leave_type', 'start_date', 'end_date', 'reason']):
            log_audit_event(
                user_id=current_user_id,
                action='LEAVE_UPDATED',
                resource_type='Leave',
                resource_id=leave_id,
                details={'user_id': leave.user_id}
            )

        return jsonify(leave.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@leave_bp.route('/leaves/<int:leave_id>', methods=['DELETE'])
@optional_jwt_required
@debug_skip_auth
@swag_from(delete_leave_docs)
def delete_leave(leave_id):
    try:
        # --- ALWAYS ASSIGN current_user_id ---
        current_user_id = 1 if current_app.config.get("DEBUG", False) else get_jwt_identity()

        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        # --- Permission check only in non-DEBUG ---
        if not current_app.config.get("DEBUG", False):
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404

            allowed = has_role(user, 'Admin') or (leave.user_id == current_user_id and leave.status == 'Pending')
            if not allowed:
                return jsonify({'error': 'Insufficient permissions'}), 403

        # --- Delete + Audit Log ---
        db.session.delete(leave)
        db.session.commit()

        log_audit_event(
            user_id=current_user_id,
            action='LEAVE_DELETED',
            resource_type='Leave',
            resource_id=leave_id,
            details={
                'owner_id': leave.user_id,
                'leave_type': leave.leave_type,
                'dates': f"{leave.start_date} to {leave.end_date}"
            }
        )

        return jsonify({'message': 'Leave request deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@leave_bp.route('/leaves/<int:leave_id>/approve', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
@swag_from(approve_leave_docs)
def approve_leave(leave_id):
    return _change_status(leave_id, 'Approved')


@leave_bp.route('/leaves/<int:leave_id>/reject', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
@swag_from(reject_leave_docs)
def reject_leave(leave_id):
    return _change_status(leave_id, 'Rejected')


# === HELPER FUNCTION ===
def _change_status(leave_id, status):
    try:
        current_user_id = 1 if current_app.config.get("DEBUG", False) else get_jwt_identity()

        if not current_app.config.get("DEBUG", False):
            user = User.query.get(current_user_id)
            if not (has_role(user, 'Admin') or has_role(user, 'HR')):
                return jsonify({'error': 'Insufficient permissions'}), 403

        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        data = request.get_json() or {}
        leave.status = status
        leave.reviewed_by_id = current_user_id
        if data.get('remarks'):
            leave.remarks = data['remarks']

        db.session.commit()

        log_audit_event(
            user_id=current_user_id,
            action=f"LEAVE_{status.upper()}",
            resource_type='Leave',
            resource_id=leave_id,
            details={'user_id': leave.user_id, 'remarks': data.get('remarks')}
        )

        return jsonify(leave.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500