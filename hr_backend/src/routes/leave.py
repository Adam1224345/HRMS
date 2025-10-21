from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from src.models.leave import Leave
from datetime import datetime

leave_bp = Blueprint('leave', __name__)

def has_role(user, role_name):
    """Check if user has a specific role"""
    return any(role.name == role_name for role in user.roles)

@leave_bp.route('/leaves', methods=['GET'])
@jwt_required()
def get_leaves():
    """
    Get leave requests based on user role
    ---
    tags:
      - Leave
    security:
      - BearerAuth: []
    parameters:
      - name: page
        in: query
        type: integer
        required: false
        description: Page number for pagination
      - name: per_page
        in: query
        type: integer
        required: false
        description: Number of leaves per page
      - name: status
        in: query
        type: string
        required: false
        description: Filter leaves by status (Pending, Approved, Rejected)
    responses:
      200:
        description: List of leave requests
      401:
        description: Missing or invalid token
    """
    try:
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
    """
    Get a specific leave request
    ---
    tags:
      - Leave
    security:
      - BearerAuth: []
    parameters:
      - name: leave_id
        in: path
        type: integer
        required: true
        description: ID of the leave request
    responses:
      200:
        description: Leave request details
      404:
        description: Leave not found
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        leave = Leave.query.get(leave_id)

        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        if not (has_role(user, 'Admin') or has_role(user, 'HR') or leave.user_id == current_user_id):
            return jsonify({'error': 'Insufficient permissions'}), 403

        return jsonify({'leave': leave.to_dict()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves', methods=['POST'])
@jwt_required()
def create_leave():
    """
    Create a new leave request
    ---
    tags:
      - Leave
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - leave_type
              - start_date
              - end_date
              - reason
            properties:
              leave_type:
                type: string
              start_date:
                type: string
                format: date
              end_date:
                type: string
                format: date
              reason:
                type: string
    responses:
      201:
        description: Leave request created successfully
      400:
        description: Validation error
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        required_fields = ['leave_type', 'start_date', 'end_date', 'reason']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()

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
    """
    Update an existing leave request
    ---
    tags:
      - Leave
    security:
      - BearerAuth: []
    parameters:
      - name: leave_id
        in: path
        type: integer
        required: true
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              leave_type: {type: string}
              start_date: {type: string, format: date}
              end_date: {type: string, format: date}
              reason: {type: string}
              status: {type: string}
              remarks: {type: string}
    responses:
      200:
        description: Leave updated successfully
      403:
        description: Insufficient permissions
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        leave = Leave.query.get(leave_id)

        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        data = request.get_json()

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
                leave.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            if 'end_date' in data:
                leave.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            if 'reason' in data:
                leave.reason = data['reason']
            if leave.end_date < leave.start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
        else:
            return jsonify({'error': 'Insufficient permissions'}), 403

        db.session.commit()

        return jsonify({
            'message': 'Leave updated successfully',
            'leave': leave.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@leave_bp.route('/leaves/<int:leave_id>', methods=['DELETE'])
@jwt_required()
def delete_leave(leave_id):
    """
    Delete a leave request
    ---
    tags:
      - Leave
    security:
      - BearerAuth: []
    parameters:
      - name: leave_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Leave deleted successfully
      403:
        description: Insufficient permissions
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        leave = Leave.query.get(leave_id)

        if not leave:
            return jsonify({'error': 'Leave request not found'}), 404

        if not (has_role(user, 'Admin') or (leave.user_id == current_user_id and leave.status == 'Pending')):
            return jsonify({'error': 'Insufficient permissions'}), 403

        db.session.delete(leave)
        db.session.commit()

        return jsonify({'message': 'Leave deleted successfully'}), 200

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
