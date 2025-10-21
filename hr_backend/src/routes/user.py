from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Role, db
from functools import wraps

user_bp = Blueprint('user', __name__)

def optional_jwt_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if current_app.config.get("DEBUG", False):
            return func(*args, **kwargs)
        return jwt_required()(func)(*args, **kwargs)
    return wrapper

def require_permission(permission_name):
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)
            user_id = int(get_jwt_identity())
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            if not user.has_permission(permission_name):
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


@user_bp.route('/users', methods=['GET'])
@require_permission('user_read')
def get_users():
    """
    Get all users (Admin/HR only)
    ---
    tags:
      - Users
    parameters:
      - name: page
        in: query
        type: integer
        required: false
        description: Page number
      - name: per_page
        in: query
        type: integer
        required: false
        description: Number of results per page
    responses:
      200:
        description: List of users retrieved successfully
      403:
        description: Unauthorized access
      500:
        description: Internal server error
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        users = User.query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'users': [user.to_dict(include_roles=True) for user in users.items],
            'total': users.total,
            'pages': users.pages,
            'current_page': page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/users', methods=['POST'])
@require_permission('user_write')
def create_user():
    """
    Create a new user (Admin/HR only)
    ---
    tags:
      - Users
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - username
            - email
            - password
          properties:
            username:
              type: string
              example: "john_doe"
            email:
              type: string
              example: "john@example.com"
            password:
              type: string
              example: "securePass123"
            first_name:
              type: string
              example: "John"
            last_name:
              type: string
              example: "Doe"
            is_active:
              type: boolean
              example: true
            role_ids:
              type: array
              items:
                type: integer
              example: [1, 2]
    responses:
      201:
        description: User created successfully
      400:
        description: Missing or invalid data
      403:
        description: Unauthorized
      500:
        description: Server error
    """
    try:
        data = request.get_json()
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            is_active=data.get('is_active', True)
        )
        user.set_password(data['password'])

        if 'role_ids' in data:
            roles = Role.query.filter(Role.id.in_(data['role_ids'])).all()
            user.roles = roles
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict(include_roles=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/users/<int:user_id>', methods=['GET'])
@require_permission('user_read')
def get_user(user_id):
    """
    Get a specific user (Admin/HR only)
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        required: true
        type: integer
        description: ID of the user
    responses:
      200:
        description: User retrieved successfully
      404:
        description: User not found
      403:
        description: Unauthorized
    """
    try:
        user = User.query.get_or_404(user_id)
        return jsonify({'user': user.to_dict(include_roles=True)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@user_bp.route('/users/<int:user_id>', methods=['PUT'])
@require_permission('user_write')
def update_user(user_id):
    """
    Update a user (Admin/HR only)
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        required: true
        type: integer
      - in: body
        name: body
        schema:
          type: object
          properties:
            username:
              type: string
            email:
              type: string
            first_name:
              type: string
            last_name:
              type: string
            is_active:
              type: boolean
            password:
              type: string
            role_ids:
              type: array
              items:
                type: integer
    responses:
      200:
        description: User updated successfully
      400:
        description: Validation error
      404:
        description: User not found
    """
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if 'username' in data:
            existing_user = User.query.filter(User.username == data['username'], User.id != user_id).first()
            if existing_user:
                return jsonify({'error': 'Username already exists'}), 400
            user.username = data['username']

        if 'email' in data:
            existing_user = User.query.filter(User.email == data['email'], User.id != user_id).first()
            if existing_user:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']

        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        if 'role_ids' in data:
            roles = Role.query.filter(Role.id.in_(data['role_ids'])).all()
            user.roles = roles

        db.session.commit()
        return jsonify({'message': 'User updated successfully', 'user': user.to_dict(include_roles=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
@require_permission('user_delete')
def delete_user(user_id):
    """
    Delete a user (Admin only)
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        type: integer
        required: true
        description: ID of the user to delete
    responses:
      200:
        description: User deleted successfully
      400:
        description: Cannot delete own account
      404:
        description: User not found
    """
    try:
        if current_app.config.get("DEBUG", False):
            pass
        else:
            current_user_id = int(get_jwt_identity())
            if current_user_id == user_id:
                return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/users/<int:user_id>/roles', methods=['POST'])
@require_permission('user_write')
def assign_role_to_user(user_id):
    """
    Assign a role to a user (Admin/HR only)
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        required: true
        type: integer
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - role_id
          properties:
            role_id:
              type: integer
              example: 2
    responses:
      200:
        description: Role assigned successfully
      400:
        description: User already has this role
      404:
        description: Role or user not found
    """
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        if not data.get('role_id'):
            return jsonify({'error': 'role_id is required'}), 400
        
        role = Role.query.get_or_404(data['role_id'])
        if role not in user.roles:
            user.roles.append(role)
            db.session.commit()
            return jsonify({
                'message': f'Role {role.name} assigned to user {user.username}',
                'user': user.to_dict(include_roles=True)
            }), 200
        else:
            return jsonify({'error': 'User already has this role'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/users/<int:user_id>/roles/<int:role_id>', methods=['DELETE'])
@require_permission('user_write')
def remove_role_from_user(user_id, role_id):
    """
    Remove a role from a user (Admin/HR only)
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        required: true
        type: integer
      - name: role_id
        in: path
        required: true
        type: integer
    responses:
      200:
        description: Role removed successfully
      400:
        description: User does not have this role
      404:
        description: User or role not found
    """
    try:
        user = User.query.get_or_404(user_id)
        role = Role.query.get_or_404(role_id)
        
        if role in user.roles:
            user.roles.remove(role)
            db.session.commit()
            return jsonify({
                'message': f'Role {role.name} removed from user {user.username}',
                'user': user.to_dict(include_roles=True)
            }), 200
        else:
            return jsonify({'error': 'User does not have this role'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500