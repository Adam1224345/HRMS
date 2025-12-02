from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Role, Permission, db
from functools import wraps

role_bp = Blueprint('role', __name__)

def optional_jwt_required(func):
    """
    JWT check  (for Swagger/cURL testing)
    """
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

@role_bp.route('/roles', methods=['GET'])
@require_permission('role_read')
def get_roles():
    """
    Get all roles
    ---
    tags:
      - Roles
    responses:
      200:
        description: List of roles retrieved successfully
      500:
        description: Internal server error
    """
    try:
        roles = Role.query.all()
        return jsonify({
            'roles': [role.to_dict(include_permissions=True) for role in roles]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@role_bp.route('/roles', methods=['POST'])
@require_permission('role_write')
def create_role():
    """
    Create a new role
    ---
    tags:
      - Roles
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
              example: Manager
            description:
              type: string
              example: Manages employee-related functions
            permission_ids:
              type: array
              items:
                type: integer
    responses:
      201:
        description: Role created successfully
      400:
        description: Validation error or role already exists
    """
    try:
        data = request.get_json()
        if not data.get('name'):
            return jsonify({'error': 'Role name is required'}), 400

        if Role.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Role already exists'}), 400

        role = Role(
            name=data['name'],
            description=data.get('description', '')
        )

        if 'permission_ids' in data:
            permissions = Permission.query.filter(Permission.id.in_(data['permission_ids'])).all()
            role.permissions = permissions

        db.session.add(role)
        db.session.commit()
        return jsonify({'message': 'Role created successfully', 'role': role.to_dict(include_permissions=True)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@role_bp.route('/roles/<int:role_id>', methods=['GET'])
@require_permission('role_read')
def get_role(role_id):
    """
    Get a specific role
    ---
    tags:
      - Roles
    parameters:
      - name: role_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Role found
      404:
        description: Role not found
    """
    try:
        role = Role.query.get_or_404(role_id)
        return jsonify({'role': role.to_dict(include_permissions=True)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@role_bp.route('/roles/<int:role_id>', methods=['PUT'])
@require_permission('role_write')
def update_role(role_id):
    """
    Update a role
    ---
    tags:
      - Roles
    parameters:
      - name: role_id
        in: path
        type: integer
        required: true
      - in: body
        name: body
        schema:
          type: object
          properties:
            name:
              type: string
            description:
              type: string
            permission_ids:
              type: array
              items:
                type: integer
    responses:
      200:
        description: Role updated successfully
      400:
        description: Validation error
    """
    try:
        role = Role.query.get_or_404(role_id)
        data = request.get_json()

        if 'name' in data:
            existing_role = Role.query.filter(Role.name == data['name'], Role.id != role_id).first()
            if existing_role:
                return jsonify({'error': 'Role name already exists'}), 400
            role.name = data['name']

        if 'description' in data:
            role.description = data['description']

        if 'permission_ids' in data:
            permissions = Permission.query.filter(Permission.id.in_(data['permission_ids'])).all()
            role.permissions = permissions

        db.session.commit()
        return jsonify({'message': 'Role updated successfully', 'role': role.to_dict(include_permissions=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@role_bp.route('/roles/<int:role_id>', methods=['DELETE'])
@require_permission('role_delete')
def delete_role(role_id):
    """
    Delete a role
    ---
    tags:
      - Roles
    parameters:
      - name: role_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Role deleted successfully
      400:
        description: Role is assigned to users
    """
    try:
        role = Role.query.get_or_404(role_id)
        if role.users:
            return jsonify({'error': f'Cannot delete role. It is assigned to {len(role.users)} user(s)'}), 400
        db.session.delete(role)
        db.session.commit()
        return jsonify({'message': 'Role deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/permissions', methods=['GET'])
@require_permission('permission_read')
def get_permissions():
    """
    Get all available permissions
    ---
    tags:
      - Roles
    responses:
      200:
        description: List of permissions retrieved successfully
      500:
        description: Internal server error
    """
    try:
        permissions = Permission.query.all()
        return jsonify({
            'permissions': [p.to_dict() for p in permissions]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
