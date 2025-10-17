from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from src.models.leave import Leave
from datetime import datetime

leave_bp = Blueprint('leave', __name__)

def has_role(user, role_name):
    """Check if user has specific role"""
    return any(role.name == role_name for role in user.roles)

@leave_bp.route('/leaves', methods=['GET'])
@jwt_required()
def get_leaves():
    """Get leave requests based on user role"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Admin and HR can see all leave requests
        if has_role(user, 'Admin') or has_role(user, 'HR'):
            leaves = Leave.query.all()
        else:
            # Employees see only their own leave requests
            leaves = Leave.query.filter_by(user_id=current_user_id).all()
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status_filter = request.args.get('status', None)
        
        # Filter by status if provided
        if status_filter:
            leaves = [leave for leave in leaves if leave.status == status_filter]
        
        # Pagination
        total_leaves = len(leaves)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_leaves = leaves[start:end]
        
        return jsonify({
            'leaves': [leave.to_dict() for leave in paginated_leaves],
            'total': total_leaves,
            'page': page,
            'per_page': per_page,
            'pages': (total_leaves + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['GET'])
@jwt_required()
def get_leave(leave_id):
    """Get a specific leave request"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        # Check if user has permission to view this leave request
        if not (has_role(user, 'Admin') or has_role(user, 'HR') or leave.user_id == current_user_id):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        return jsonify({'leave': leave.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves', methods=['POST'])
@jwt_required()
def create_leave():
    """Create a new leave request"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['leave_type', 'start_date', 'end_date', 'reason']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse dates
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Validate date range
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
        
        return jsonify({
            'message': 'Leave request created successfully',
            'leave': leave.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['PUT'])
@jwt_required()
def update_leave(leave_id):
    """Update a leave request"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        data = request.get_json()
        
        # Admin and HR can approve/reject and add remarks
        if has_role(user, 'Admin') or has_role(user, 'HR'):
            if 'status' in data:
                if data['status'] not in ['Pending', 'Approved', 'Rejected']:
                    return jsonify({'error': 'Invalid status'}), 400
                leave.status = data['status']
                leave.reviewed_by_id = current_user_id
            if 'remarks' in data:
                leave.remarks = data['remarks']
        # Employees can only update their own pending leave requests
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
            
            # Validate date range
            if leave.end_date < leave.start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
        else:
            return jsonify({'error': 'Insufficient permissions or leave request already processed'}), 403
        
        db.session.commit()
        
        return jsonify({
            'message': 'Leave request updated successfully',
            'leave': leave.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['DELETE'])
@jwt_required()
def delete_leave(leave_id):
    """Delete a leave request"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        leave = Leave.query.get(leave_id)
        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404
        
        # Admin can delete any leave, employees can delete their own pending leaves
        if has_role(user, 'Admin'):
            pass
        elif leave.user_id == current_user_id and leave.status == 'Pending':
            pass
        else:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        db.session.delete(leave)
        db.session.commit()
        
        return jsonify({'message': 'Leave request deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>/approve', methods=['POST'])
@jwt_required()
def approve_leave(leave_id):
    """Approve a leave request (Admin and HR only)"""
    try:
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
        
        return jsonify({
            'message': 'Leave request approved successfully',
            'leave': leave.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>/reject', methods=['POST'])
@jwt_required()
def reject_leave(leave_id):
    """Reject a leave request (Admin and HR only)"""
    try:
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
        
        return jsonify({
            'message': 'Leave request rejected successfully',
            'leave': leave.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
