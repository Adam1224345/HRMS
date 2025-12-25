from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User, Role
from src.models.leave import Leave
from src.utils.audit_logger import log_audit_event
from src.utils.notifications import send_notification
from datetime import datetime, timedelta, date
from flasgger import swag_from
import holidays

leave_bp = Blueprint('leave', __name__, url_prefix='/api')

# ===================================================================
# CONFIG: 2025 GOVERNMENT HOLIDAYS (Pakistan)
# ===================================================================
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

# ===================================================================
# SWAGGER SCHEMAS & DOCUMENTATION
# ===================================================================
leave_definition = {
    "type": "object",
    "properties": {
        "id": {"type": "integer"},
        "user_id": {"type": "integer"},
        "leave_type": {"type": "string"},
        "start_date": {"type": "string", "format": "date"},
        "end_date": {"type": "string", "format": "date"},
        "reason": {"type": "string"},
        "status": {"type": "string"},
        "remarks": {"type": "string"},
        "created_at": {"type": "string", "format": "date-time"}
    }
}

get_leaves_docs = {
    "tags": ["Leave"],
    "summary": "Get all leave requests (paginated)",
    "description": "Admin/HR sees all leaves. Employee sees only own leaves.",
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
                    "pages": {"type": "integer"},
                    "page": {"type": "integer"},
                    "per_page": {"type": "integer"}
                }
            }
        },
        "401": {"description": "Unauthorized"},
        "403": {"description": "Forbidden"}
    },
    "definitions": {"Leave": leave_definition},
    "security": [{"Bearer": []}]
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
    "definitions": {"Leave": leave_definition},
    "security": [{"Bearer": []}]
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
        "201": {"description": "Leave created", "schema": {"$ref": "#/definitions/Leave"}},
        "400": {"description": "Invalid input"},
        "401": {"description": "Unauthorized"}
    },
    "definitions": {"Leave": leave_definition},
    "security": [{"Bearer": []}]
}

update_leave_docs = {
    "tags": ["Leave"],
    "summary": "Update leave request",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object"}}
    ],
    "responses": {
        "200": {"description": "Updated", "schema": {"$ref": "#/definitions/Leave"}},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "definitions": {"Leave": leave_definition},
    "security": [{"Bearer": []}]
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
    "security": [{"Bearer": []}]
}

approve_leave_docs = {
    "tags": ["Leave"],
    "summary": "Approve leave (Admin/HR only)",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object", "properties": {"remarks": {"type": "string"}}}}
    ],
    "responses": {
        "200": {"description": "Approved"},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"Bearer": []}]
}

reject_leave_docs = {
    "tags": ["Leave"],
    "summary": "Reject leave (Admin/HR only)",
    "parameters": [
        {"name": "leave_id", "in": "path", "type": "integer", "required": True},
        {"name": "body", "in": "body", "schema": {"type": "object", "properties": {"remarks": {"type": "string"}}}}
    ],
    "responses": {
        "200": {"description": "Rejected"},
        "403": {"description": "Forbidden"},
        "404": {"description": "Not found"}
    },
    "security": [{"Bearer": []}]
}

analyze_dates_docs = {
    "tags": ["Leave"],
    "summary": "Analyze leave dates for overlaps, holidays, and suggestions",
    "description": "Checks for overlapping leaves, holidays, and suggests bridge days.",
    "parameters": [
        {
            "name": "body",
            "in": "body",
            "required": True,
            "schema": {
                "type": "object",
                "required": ["start_date", "end_date"],
                "properties": {
                    "start_date": {"type": "string", "format": "date", "example": "2025-12-01"},
                    "end_date": {"type": "string", "format": "date", "example": "2025-12-05"}
                }
            }
        }
    ],
    "responses": {
        "200": {
            "description": "Date analysis result",
            "schema": {
                "type": "object",
                "properties": {
                    "overlap": {"type": "boolean"},
                    "overlap_msg": {"type": "string"},
                    "holidays": {"type": "array", "items": {"type": "object"}},
                    "suggestions": {"type": "array", "items": {"type": "string"}},
                    "weekend_days": {"type": "integer"},
                    "working_days": {"type": "integer"}
                }
            }
        },
        "400": {"description": "Invalid input"}
    },
    "security": [{"Bearer": []}]
}

# ===================================================================
# ROUTES
# ===================================================================

@leave_bp.route('/leaves/analyze-dates', methods=['POST'])
@jwt_required()
@swag_from(analyze_dates_docs)
def analyze_leave_dates():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    start_str = data.get('start_date')
    end_str = data.get('end_date')
    if not start_str or not end_str:
        return jsonify({'error': 'Dates required'}), 400

    try:
        start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date < start_date:
        return jsonify({'error': 'End date cannot be before start date'}), 400

    response = {
        'overlap': False,
        'overlap_msg': None,
        'holidays': [],
        'suggestions': [],
        'weekend_days': 0,
        'working_days': 0
    }

    # 1. Generate holidays for requested year
    pk_holidays = holidays.PK(years=start_date.year)

    # Override with official 2025 holidays if year is 2025
    if start_date.year == 2025:
        for date_str, name in OFFICIAL_HOLIDAYS_2025.items():
            h_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            pk_holidays[h_date] = name

    # 2. Check dates
    current = start_date
    while current <= end_date:
        is_weekend = current.weekday() >= 5
        is_holiday = current in pk_holidays

        if is_weekend:
            response['weekend_days'] += 1
        elif is_holiday:
            response['holidays'].append({
                'date': current.isoformat(),
                'name': pk_holidays[current]
            })
        else:
            response['working_days'] += 1
        current += timedelta(days=1)

    # 3. Check overlaps with existing leaves
    overlap = Leave.query.filter(
        Leave.user_id == current_user_id,
        Leave.status.in_(['Pending', 'Approved']),
        Leave.start_date <= end_date,
        Leave.end_date >= start_date
    ).first()
    if overlap:
        response['overlap'] = True
        response['overlap_msg'] = f"Overlaps with existing {overlap.leave_type} ({overlap.start_date} - {overlap.end_date})"

    # 4. Smart bridge suggestions
    day_before = start_date - timedelta(days=1)
    if day_before.weekday() < 5 and day_before not in pk_holidays:
        anchor = day_before - timedelta(days=1)
        if anchor in pk_holidays or anchor.weekday() >= 5:
            reason = pk_holidays.get(anchor, "the weekend")
            response['suggestions'].append(
                f"💡 Tip: Take {day_before} off to connect this leave with {reason}!"
            )

    day_after = end_date + timedelta(days=1)
    if day_after.weekday() < 5 and day_after not in pk_holidays:
        anchor = day_after + timedelta(days=1)
        if anchor in pk_holidays or anchor.weekday() >= 5:
            reason = pk_holidays.get(anchor, "the weekend")
            response['suggestions'].append(
                f"💡 Tip: Take {day_after} off to connect this leave with {reason}!"
            )

    return jsonify(response), 200

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

    try:
        current_user_id = int(current_user_id)
    except:
        pass
    user = User.query.options(db.joinedload(User.roles)).get(current_user_id)
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)
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

    try:
        current_user_id = int(current_user_id)
    except:
        pass
    user = User.query.options(db.joinedload(User.roles)).get(current_user_id)
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in user.roles)

    is_owner = (leave.user_id == current_user_id)

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
