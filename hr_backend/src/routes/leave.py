from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User, Role
from src.models.leave import Leave
from src.utils.audit_logger import log_audit_event
from src.utils.notifications import send_notification
from datetime import datetime
from flasgger import swag_from

leave_bp = Blueprint('leave', __name__, url_prefix='/api')

# ===================================================================
# SWAGGER DOCUMENTATION
# ===================================================================

get_leaves_docs = {
    "tags": ["Leave"],
    "summary": "Get all leave requests (paginated)",
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
        "404": {"description": "Leave not found"},
        "403": {"description": "Forbidden"}
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
            "required": ["leave_type", "start_date", "end_date", "reason"],
            "properties": {
                "leave_type": {"type": "string", "example": "Annual"},
                "start_date": {"type": "string", "format": "date", "example": "2025-12-01"},
                "end_date": {"type": "string", "format": "date", "example": "2025-12-05"},
                "reason": {"type": "string", "example": "Family vacation"}
            }
        }
    }],
    "responses": {
        "201": {"description": "Leave created"},
        "400": {"description": "Invalid input"}
    },
    "security": [{"bearerAuth": []}]
}

update_leave_docs = {
    "tags": ["Leave"],
    "summary": "Update leave request",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object"}}
    ],
    "responses": {
        "200": {"description": "Updated"},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}

delete_leave_docs = {
    "tags": ["Leave"],
    "summary": "Delete leave request (Admin or Owner)",
    "parameters": [{"name": "leave_id", "in": "path", "type": "integer", "required": True}],
    "responses": {
        "200": {"description": "Deleted"},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"bearerAuth": []}]
}

approve_leave_docs = {
    "tags": ["Leave"],
    "summary": "Approve leave (Admin/HR only)",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object", "properties": {"remarks": {"type": "string"}}}}
    ],
    "responses": {"200": {"description": "Approved"}},
    "security": [{"bearerAuth": []}]
}

reject_leave_docs = {
    "tags": ["Leave"],
    "summary": "Reject leave (Admin/HR only)",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object", "properties": {"remarks": {"type": "string"}}}}
    ],
    "responses": {"200": {"description": "Rejected"}},
    "security": [{"bearerAuth": []}]
}


# ===================================================================
# ROUTES
# ===================================================================

@leave_bp.route('/leaves', methods=['GET'])
@jwt_required()
@swag_from(get_leaves_docs)
def get_leaves():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.options(db.joinedload(User.roles)).get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
        
        # Ensure strict type comparison isn't an issue by using user object directly for filtering if needed
        query = Leave.query if is_admin_hr else Leave.query.filter_by(user_id=user.id)

        if request.args.get('status'):
            query = query.filter(Leave.status == request.args.get('status'))

        page = max(1, request.args.get('page', 1, type=int))
        per_page = min(50, request.args.get('per_page', 10, type=int))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'leaves': [l.to_dict() for l in pagination.items],
            'total': pagination.total or 0,
            'pages': pagination.pages,
            'page': page,
            'per_page': per_page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@leave_bp.route('/leaves/<int:leave_id>', methods=['GET'])
@jwt_required()
@swag_from(get_leave_docs)
def get_leave(leave_id):
    leave = Leave.query.get_or_404(leave_id)
    current_user_id = get_jwt_identity()
    
    # Safe Casting
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    user = User.query.options(db.joinedload(User.roles)).get(current_user_id)
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)

    if not (is_admin_hr or leave.user_id == current_user_id):
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify(leave.to_dict()), 200


@leave_bp.route('/leaves', methods=['POST'])
@jwt_required()
@swag_from(create_leave_docs)
def create_leave():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    required = ['leave_type', 'start_date', 'end_date', 'reason']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f"Missing: {', '.join(missing)}"}), 400

    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date < start_date:
        return jsonify({'error': 'End date cannot be before start date'}), 400

    leave = Leave(
        leave_type=data['leave_type'].strip(),
        start_date=start_date,
        end_date=end_date,
        reason=data['reason'].strip(),
        status='Pending',
        user_id=user.id
    )
    db.session.add(leave)
    db.session.flush()

    log_audit_event(
        user_id=user.id,
        action='LEAVE_CREATED',
        resource_type='Leave',
        resource_id=leave.id,
        details={
            'leave_type': leave.leave_type,
            'dates': f"{start_date} - {end_date}",
            'status': 'Pending'
        }
    )

    # Notification Logic
    employee_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
    approvers = User.query.join(User.roles).filter(Role.name.in_(['Admin', 'HR'])).all()
    
    for approver in approvers:
        send_notification(
            recipient_id=approver.id,
            message=f"New Leave Request\nFrom: {employee_name}\nType: {leave.leave_type}",
            type='new_leave_request',
            related_id=leave.id,
            sender_id=user.id,
            send_email=True
        )

    send_notification(
        recipient_id=user.id,
        message="Your leave request has been submitted.",
        type='leave_submitted',
        related_id=leave.id,
        send_email=False
    )

    db.session.commit()
    return jsonify(leave.to_dict()), 201


@leave_bp.route('/leaves/<int:leave_id>', methods=['PUT'])
@jwt_required()
@swag_from(update_leave_docs)
def update_leave(leave_id):
    leave = Leave.query.get_or_404(leave_id)
    current_user_id = get_jwt_identity()
    
    # Safe Casting
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    user = User.query.options(db.joinedload(User.roles)).get(current_user_id)
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)

    # Allow update if Admin/HR OR Owner (if Pending)
    if not (is_admin_hr or (leave.user_id == current_user_id and leave.status == 'Pending')):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json() or {}
    changes = {}

    def track_change(field, old, new):
        if str(new) != str(old):
            changes[field] = {'old': str(old), 'new': str(new)}

    old_status = leave.status
    
    if is_admin_hr:
        if 'status' in data and data['status'] in ['Approved', 'Rejected', 'Pending']:
            track_change('status', old_status, data['status'])
            leave.status = data['status']
            leave.reviewed_by_id = current_user_id
        if 'remarks' in data:
            track_change('remarks', leave.remarks, data['remarks'])
            leave.remarks = data['remarks']

    if leave.user_id == current_user_id and leave.status == 'Pending':
        if 'leave_type' in data:
            track_change('leave_type', leave.leave_type, data['leave_type'])
            leave.leave_type = data['leave_type'].strip()
        if 'reason' in data:
            track_change('reason', leave.reason, data['reason'])
            leave.reason = data['reason'].strip()
        if 'start_date' in data:
            try:
                new_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
                track_change('start_date', leave.start_date, new_date)
                leave.start_date = new_date
            except ValueError:
                return jsonify({'error': 'Invalid start_date'}), 400
        if 'end_date' in data:
            try:
                new_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
                track_change('end_date', leave.end_date, new_date)
                leave.end_date = new_date
            except ValueError:
                return jsonify({'error': 'Invalid end_date'}), 400

    if leave.end_date < leave.start_date:
        return jsonify({'error': 'End date cannot be before start date'}), 400

    db.session.commit()

    if changes:
        log_audit_event(
            user_id=current_user_id,
            action='LEAVE_UPDATED',
            resource_type='Leave',
            resource_id=leave.id,
            details={'updated_by': 'Admin/HR' if is_admin_hr else 'Owner', 'changes': changes}
        )

    return jsonify(leave.to_dict()), 200


@leave_bp.route('/leaves/<int:leave_id>', methods=['DELETE'])
@jwt_required()
@swag_from(delete_leave_docs)
def delete_leave(leave_id):
    leave = Leave.query.get_or_404(leave_id)
    current_user_id = get_jwt_identity()

    # --- DEBUGGING PRINTS (Check your console when you hit this endpoint) ---
    print(f"DEBUG: ID from Token: {current_user_id} (Type: {type(current_user_id)})")
    print(f"DEBUG: ID from Leave: {leave.user_id} (Type: {type(leave.user_id)})")

    # SAFE CASTING: Ensure we are comparing Integers to Integers
    try:
        current_user_id = int(current_user_id)
    except ValueError:
        return jsonify({'error': 'Invalid User ID token format'}), 400

    user = User.query.options(db.joinedload(User.roles)).get(current_user_id)
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
    
    # FIX: Strict comparison with casted integer
    is_owner = (leave.user_id == current_user_id)

    print(f"DEBUG: Is Owner? {is_owner}")
    print(f"DEBUG: Is Admin? {is_admin_hr}")

    # Logic: Admin/HR can delete, OR Owner can delete (ANY status)
    if not (is_admin_hr or is_owner):
        return jsonify({'error': 'Forbidden: Only Admin/HR or the owner can delete this request'}), 403

    log_audit_event(
        user_id=current_user_id,
        action='LEAVE_DELETED',
        resource_type='Leave',
        resource_id=leave_id,
        details={
            'leave_type': leave.leave_type,
            'status': leave.status,
            'deleted_by': 'Admin/HR' if is_admin_hr else 'Employee (Owner)'
        }
    )

    db.session.delete(leave)
    db.session.commit()

    return jsonify({'message': 'Leave request deleted successfully'}), 200


def _change_status(leave_id, status):
    current_user_id = get_jwt_identity()
    
    # Safe cast
    try:
        current_user_id = int(current_user_id)
    except:
        pass

    reviewer = User.query.options(db.joinedload(User.roles)).get(current_user_id)
    if not reviewer or not any(r.name in ['Admin', 'HR'] for r in reviewer.roles):
        return jsonify({'error': 'Only Admin/HR can approve/reject'}), 403

    leave = Leave.query.get_or_404(leave_id)
    if leave.status != 'Pending':
        return jsonify({'error': f'Leave already {leave.status}'}), 400

    data = request.get_json() or {}
    remarks = data.get('remarks', '').strip()
    
    leave.status = status
    leave.reviewed_by_id = current_user_id
    leave.remarks = remarks

    db.session.commit()

    log_audit_event(
        user_id=current_user_id,
        action=f'LEAVE_{status.upper()}',
        resource_type='Leave',
        resource_id=leave.id,
        details={'new_status': status, 'remarks': remarks}
    )

    send_notification(
        recipient_id=leave.user_id,
        message=f"Your leave request has been {status.upper()}!",
        type='leave_status',
        related_id=leave.id,
        sender_id=current_user_id,
        send_email=True
    )

    return jsonify(leave.to_dict()), 200


@leave_bp.route('/leaves/<int:leave_id>/approve', methods=['POST'])
@jwt_required()
@swag_from(approve_leave_docs)
def approve_leave(leave_id):
    return _change_status(leave_id, 'Approved')


@leave_bp.route('/leaves/<int:leave_id>/reject', methods=['POST'])
@jwt_required()
@swag_from(reject_leave_docs)
def reject_leave(leave_id):
    return _change_status(leave_id, 'Rejected')