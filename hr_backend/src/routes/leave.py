from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from src.models.leave import Leave
from datetime import datetime
from functools import wraps

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

# Helper – adds employee_name to a leave dict
def _add_employee_name(leave_dict, leave_obj):
    employee = User.query.with_entities(User.name).filter_by(id=leave_obj.user_id).first()
    leave_dict["employee_name"] = employee.name if employee else "Unknown"
    return leave_dict

@leave_bp.route('/leaves', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
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
        status_filter = request.args.get('status', None)
        
        if status_filter:
            leaves = [leave for leave in leaves if leave.status == status_filter]
        
        total_leaves = len(leaves)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_leaves = leaves[start:end]
        
        # ---- ADD employee_name here ----
        leaves_with_name = [
            _add_employee_name(leave.to_dict(), leave) for leave in paginated_leaves
        ]
        # --------------------------------
        
        return jsonify({
            'leaves': leaves_with_name,
            'total': total_leaves,
            'page': page,
            'per_page': per_page,
            'pages': (total_leaves + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['GET'])
@optional_jwt_required
@debug_skip_auth
def get_leave(leave_id):
    try:
        if current_app.config.get("DEBUG", False):
            leave = Leave.query.get(leave_id)
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            leave = Leave.query.get(leave_id)
            if not leave:
                return jsonify({'error': 'Leave request not found'}), 404
            if not (has_role(user, 'Admin') or has_role(user, 'HR') or leave.user_id == current_user_id):
                return jsonify({'error': 'Insufficient permissions'}), 403
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        # ---- ADD employee_name here ----
        leave_dict = _add_employee_name(leave.to_dict(), leave)
        # --------------------------------
        return jsonify({'leave': leave_dict}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
def create_leave():
    try:
        if current_app.config.get("DEBUG", False):
            current_user_id = 1
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
        
        data = request.get_json()
        
        required_fields = ['leave_type', 'start_date', 'end_date', 'reason']
        for field in required_fields:
            if not data.get(field):
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
        
        # ---- ADD employee_name here ----
        leave_dict = _add_employee_name(leave.to_dict(), leave)
        # --------------------------------
        return jsonify({
            'message': 'Leave request created successfully',
            'leave': leave_dict
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['PUT'])
@optional_jwt_required
@debug_skip_auth
def update_leave(leave_id):
    try:
        if current_app.config.get("DEBUG", False):
            current_user_id = 1
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        data = request.get_json()
        
        if current_app.config.get("DEBUG", False):
            if 'status' in data:
                if data['status'] not in ['Pending', 'Approved', 'Rejected']:
                    return jsonify({'error': 'Invalid status'}), 400
                leave.status = data['status']
                leave.reviewed_by_id = current_user_id
            if 'remarks' in data:
                leave.remarks = data['remarks']
            if 'leave_type' in data:
                leave.leave_type = data['leave_type']
            if 'start_date' in data:
                try:
                    leave.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid start_date format'}), 400
            if 'end_date' in data:
                try:
                    leave.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid end_date format'}), 400
            if 'reason' in data:
                leave.reason = data['reason']
            
            if leave.end_date < leave.start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
        else:
            if has_role(user, 'Admin') or has_role(user, 'HR'):
                if 'status' in data:
                    if data['status'] not in ['Pending', 'Approved', 'Rejected']:
                        return jsonify({'error': 'Invalid status'}), 400
                    leave.status = data['status']
                    leave.reviewed_by_id = current_user_id
                if 'remarks' in data:
                    leave.remarks = data['remarks']
            elif leave.user_id == current_user_id and leave.status == 'Pending':
                if 'leave_type' in data:
                    leave.leave_type = data['leave_type']
                if 'start_date' in data:
                    try:
                        leave.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
                    except ValueError:
                        return jsonify({'error': 'Invalid start_date format'}), 400
                if 'end_date' in data:
                    try:
                        leave.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
                    except ValueError:
                        return jsonify({'error': 'Invalid end_date format'}), 400
                if 'reason' in data:
                    leave.reason = data['reason']
                
                if leave.end_date < leave.start_date:
                    return jsonify({'error': 'End date must be after start date'}), 400
            else:
                return jsonify({'error': 'Insufficient permissions or leave request already processed'}), 403
        
        db.session.commit()
        
        # ---- ADD employee_name here ----
        leave_dict = _add_employee_name(leave.to_dict(), leave)
        # --------------------------------
        return jsonify({
            'message': 'Leave request updated successfully',
            'leave': leave_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['DELETE'])
@optional_jwt_required
@debug_skip_auth
def delete_leave(leave_id):
    try:
        if current_app.config.get("DEBUG", False):
            pass
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        if not current_app.config.get("DEBUG", False):
            if not (has_role(user, 'Admin') or (leave.user_id == current_user_id and leave.status == 'Pending')):
                return jsonify({'error': 'Insufficient permissions'}), 403
        
        db.session.delete(leave)
        db.session.commit()
        
        return jsonify({'message': 'Leave request deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>/approve', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
def approve_leave(leave_id):
    try:
        if current_app.config.get("DEBUG", False):
            current_user_id = 1
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not (has_role(user, 'Admin') or has_role(user, 'HR')):
                return jsonify({'error': 'Insufficient permissions'}), 403
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        data = request.get_json() or {}
        
        leave.status = 'Approved'
        leave.reviewed_by_id = current_user_id
        if data.get('remarks'):
            leave.remarks = data['remarks']
        
        db.session.commit()
        
        # ---- ADD employee_name here ----
        leave_dict = _add_employee_name(leave.to_dict(), leave)
        # --------------------------------
        return jsonify({
            'message': 'Leave request approved successfully',
            'leave': leave_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>/reject', methods=['POST'])
@optional_jwt_required
@debug_skip_auth
def reject_leave(leave_id):
    try:
        if current_app.config.get("DEBUG", False):
            current_user_id = 1
        else:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not (has_role(user, 'Admin') or has_role(user, 'HR')):
                return jsonify({'error': 'Insufficient permissions'}), 403
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        data = request.get_json() or {}
        
        leave.status = 'Rejected'
        leave.reviewed_by_id = current_user_id
        if data.get('remarks'):
            leave.remarks = data['remarks']
        
        db.session.commit()
        
        # ---- ADD employee_name here ----
        leave_dict = _add_employee_name(leave.to_dict(), leave)
        # --------------------------------
        return jsonify({
            'message': 'Leave request rejected successfully',
            'leave': leave_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
