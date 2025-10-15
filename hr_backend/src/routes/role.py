
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Role, Permission, db
from functools import wraps

role_bp = Blueprint('role', __name__)

def require_permission(permission_name):
    """Decorator to check if user has required permission"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            user_id = int(get_jwt_identity())  # Convert to int
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if not user.has_permission(permission_name):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Role Management Routes

@role_bp.route('/roles', methods=['GET'])
@require_permission('role_read')
def get_roles():
    """Get all roles"""
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
    """Create a new role"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Role name is required'}), 400
        
        # Check if role already exists
        if Role.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Role already exists'}), 400
        
        # Create new role
        role = Role(
            name=data['name'],
            description=data.get('description', '')
        )
        
        # Assign permissions if provided
        if 'permission_ids' in data:
            permissions = Permission.query.filter(Permission.id.in_(data['permission_ids'])).all()
            role.permissions = permissions
        
        db.session.add(role)
        db.session.commit()
        
        return jsonify({
            'message': 'Role created successfully',
            'role': role.to_dict(include_permissions=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles/<int:role_id>', methods=['GET'])
@require_permission('role_read')
def get_role(role_id):
    """Get a specific role"""
    try:
        role = Role.query.get_or_404(role_id)
        return jsonify({'role': role.to_dict(include_permissions=True)}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles/<int:role_id>', methods=['PUT'])
@require_permission('role_write')
def update_role(role_id):
    """Update a role"""
    try:
        role = Role.query.get_or_404(role_id)
        data = request.get_json()
        
        # Update allowed fields
        if 'name' in data:
            # Check if name is already taken by another role
            existing_role = Role.query.filter(Role.name == data['name'], Role.id != role_id).first()
            if existing_role:
                return jsonify({'error': 'Role name already exists'}), 400
            role.name = data['name']
        
        if 'description' in data:
            role.description = data['description']
        
        # Update permissions if provided
        if 'permission_ids' in data:
            permissions = Permission.query.filter(Permission.id.in_(data['permission_ids'])).all()
            role.permissions = permissions
        
        db.session.commit()
        
        return jsonify({
            'message': 'Role updated successfully',
            'role': role.to_dict(include_permissions=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles/<int:role_id>', methods=['DELETE'])
@require_permission('role_delete')
def delete_role(role_id):
    """Delete a role"""
    try:
        role = Role.query.get_or_404(role_id)
        
        # Check if role is assigned to any users
        if role.users:
            return jsonify({
                'error': f'Cannot delete role. It is assigned to {len(role.users)} user(s)'
            }), 400
        
        db.session.delete(role)
        db.session.commit()
        
        return jsonify({'message': 'Role deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles/<int:role_id>/permissions', methods=['POST'])
@require_permission('role_write')
def assign_permission_to_role(role_id):
    """Assign a permission to a role"""
    try:
        role = Role.query.get_or_404(role_id)
        data = request.get_json()
        
        if not data.get('permission_id'):
            return jsonify({'error': 'permission_id is required'}), 400
        
        permission = Permission.query.get_or_404(data['permission_id'])
        
        if permission not in role.permissions:
            role.permissions.append(permission)
            db.session.commit()
            
            return jsonify({
                'message': f'Permission {permission.name} assigned to role {role.name}',
                'role': role.to_dict(include_permissions=True)
            }), 200
        else:
            return jsonify({'error': 'Role already has this permission'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/roles/<int:role_id>/permissions/<int:permission_id>', methods=['DELETE'])
@require_permission('role_write')
def remove_permission_from_role(role_id, permission_id):
    """Remove a permission from a role"""
    try:
        role = Role.query.get_or_404(role_id)
        permission = Permission.query.get_or_404(permission_id)
        
        if permission in role.permissions:
            role.permissions.remove(permission)
            db.session.commit()
            
            return jsonify({
                'message': f'Permission {permission.name} removed from role {role.name}',
                'role': role.to_dict(include_permissions=True)
            }), 200
        else:
            return jsonify({'error': 'Role does not have this permission'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Permission Management Routes

@role_bp.route('/permissions', methods=['GET'])
@require_permission('permission_read')
def get_permissions():
    """Get all permissions"""
    try:
        permissions = Permission.query.all()
        return jsonify({
            'permissions': [permission.to_dict() for permission in permissions]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@role_bp.route('/permissions', methods=['POST'])
@require_permission('permission_write')
def create_permission():
    """Create a new permission"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Permission name is required'}), 400
        
        # Check if permission already exists
        if Permission.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Permission already exists'}), 400
        
        # Create new permission
        permission = Permission(
            name=data['name'],
            description=data.get('description', '')
        )
        
        db.session.add(permission)
        db.session.commit()
        
        return jsonify({
            'message': 'Permission created successfully',
            'permission': permission.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/permissions/<int:permission_id>', methods=['GET'])
@require_permission('permission_read')
def get_permission(permission_id):
    """Get a specific permission"""
    try:
        permission = Permission.query.get_or_404(permission_id)
        return jsonify({'permission': permission.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@role_bp.route('/permissions/<int:permission_id>', methods=['PUT'])
@require_permission('permission_write')
def update_permission(permission_id):
    """Update a permission"""
    try:
        permission = Permission.query.get_or_404(permission_id)
        data = request.get_json()
        
        # Update allowed fields
        if 'name' in data:
            # Check if name is already taken by another permission
            existing_permission = Permission.query.filter(
                Permission.name == data['name'], 
                Permission.id != permission_id
            ).first()
            if existing_permission:
                return jsonify({'error': 'Permission name already exists'}), 400
            permission.name = data['name']
        
        if 'description' in data:
            permission.description = data['description']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Permission updated successfully',
            'permission': permission.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@role_bp.route('/permissions/<int:permission_id>', methods=['DELETE'])
@require_permission('permission_delete')
def delete_permission(permission_id):
    """Delete a permission"""
    try:
        permission = Permission.query.get_or_404(permission_id)
        
        # Check if permission is assigned to any roles
        if permission.roles:
            return jsonify({
                'error': f'Cannot delete permission. It is assigned to {len(permission.roles)} role(s)'
            }), 400
        
        db.session.delete(permission)
        db.session.commit()
        
        return jsonify({'message': 'Permission deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500