from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from src.models.user import User, Role, Permission, db
from functools import wraps

role_bp = Blueprint('role', __name__)

# -----------------------------
# JWT Helpers
# -----------------------------
def optional_jwt_required(func):
    """
    Allows endpoints to work in Swagger/cURL if DEBUG is True.
    Otherwise, checks for JWT token.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()  # will raise if missing/invalid
        except:
            if current_app.config.get("DEBUG", False):
                return func(*args, **kwargs)
            return jsonify({"msg": "Missing Authorization Header"}), 401
        return func(*args, **kwargs)
    return wrapper

def require_permission(permission_name):
    """
    Checks if user has required permission.
    Works with optional_jwt_required.
    """
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            # Skip permission check in DEBUG mode
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)

            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'error': 'Missing JWT identity'}), 401

            user = User.query.get(int(user_id))
            if not user:
                return jsonify({'error': 'User not found'}), 404

            if not user.has_permission(permission_name):
                return jsonify({'error': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

# -----------------------------
# Role Routes
# -----------------------------
@role_bp.route('/roles', methods=['GET'])
@require_permission('role_read')
def get_roles():
    try:
        roles = Role.query.all()
        return jsonify({'roles': [role.to_dict(include_permissions=True) for role in roles]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles', methods=['POST'])
@require_permission('role_write')
def create_role():
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
    try:
        role = Role.query.get_or_404(role_id)
        return jsonify({'role': role.to_dict(include_permissions=True)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles/<int:role_id>', methods=['PUT'])
@require_permission('role_write')
def update_role(role_id):
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
