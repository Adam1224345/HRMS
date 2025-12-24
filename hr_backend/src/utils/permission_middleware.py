"""
Permission Middleware and Enforcement Utilities
Provides decorators and utilities for enforcing role-based access control (RBAC)
on Flask endpoints.

Features:
- require_permission: Decorator to enforce specific permissions on endpoints
- require_any_permission: Decorator to enforce any one of multiple permissions
- require_all_permissions: Decorator to enforce all of multiple permissions
- require_role: Decorator to enforce specific roles
- optional_jwt_required: Decorator for optional JWT authentication (useful for testing)
"""

from functools import wraps
from flask import jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User


def optional_jwt_required(func):
    """
    Optional JWT authentication decorator.
    Allows requests without JWT in debug mode for testing via Swagger/cURL.
    In production, JWT is required.
    
    Usage:
        @optional_jwt_required
        def my_endpoint():
            pass
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if current_app.config.get("DEBUG", False):
            return func(*args, **kwargs)
        return jwt_required()(func)(*args, **kwargs)
    return wrapper


def require_permission(permission_name):
    """
    Decorator to require a specific permission on an endpoint.
    
    Args:
        permission_name (str): The name of the permission to require (e.g., 'user_read')
    
    Returns:
        function: Decorated function that checks permission before execution
    
    Usage:
        @require_permission('user_read')
        def get_users():
            return jsonify({'users': [...]})
    
    Raises:
        403: If user lacks the required permission
        404: If user is not found
    """
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            # Skip permission check in debug mode
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)
            
            try:
                user_id = int(get_jwt_identity())
                user = User.query.get(user_id)

                if not user:
                    return jsonify({'error': 'User not found'}), 404

                if not user.has_permission(permission_name):
                    return jsonify({
                        'error': f'Insufficient permissions. Required: {permission_name}'
                    }), 403

                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': f'Permission check failed: {str(e)}'}), 500
        
        return decorated_function
    return decorator


def require_any_permission(*permission_names):
    """
    Decorator to require any one of multiple permissions on an endpoint.
    
    Args:
        *permission_names: Variable length argument list of permission names
    
    Returns:
        function: Decorated function that checks if user has any of the permissions
    
    Usage:
        @require_any_permission('user_write', 'admin_write')
        def update_user():
            return jsonify({'message': 'User updated'})
    
    Raises:
        403: If user lacks all of the specified permissions
        404: If user is not found
    """
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            # Skip permission check in debug mode
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)
            
            try:
                user_id = int(get_jwt_identity())
                user = User.query.get(user_id)

                if not user:
                    return jsonify({'error': 'User not found'}), 404

                # Check if user has any of the required permissions
                has_permission = any(
                    user.has_permission(perm) for perm in permission_names
                )

                if not has_permission:
                    return jsonify({
                        'error': f'Insufficient permissions. Required any of: {", ".join(permission_names)}'
                    }), 403

                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': f'Permission check failed: {str(e)}'}), 500
        
        return decorated_function
    return decorator


def require_all_permissions(*permission_names):
    """
    Decorator to require all of multiple permissions on an endpoint.
    
    Args:
        *permission_names: Variable length argument list of permission names
    
    Returns:
        function: Decorated function that checks if user has all permissions
    
    Usage:
        @require_all_permissions('user_read', 'user_write', 'user_delete')
        def admin_user_action():
            return jsonify({'message': 'Admin action performed'})
    
    Raises:
        403: If user lacks any of the specified permissions
        404: If user is not found
    """
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            # Skip permission check in debug mode
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)
            
            try:
                user_id = int(get_jwt_identity())
                user = User.query.get(user_id)

                if not user:
                    return jsonify({'error': 'User not found'}), 404

                # Check if user has all required permissions
                missing_permissions = [
                    perm for perm in permission_names
                    if not user.has_permission(perm)
                ]

                if missing_permissions:
                    return jsonify({
                        'error': f'Insufficient permissions. Missing: {", ".join(missing_permissions)}'
                    }), 403

                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': f'Permission check failed: {str(e)}'}), 500
        
        return decorated_function
    return decorator


def require_role(role_name):
    """
    Decorator to require a specific role on an endpoint.
    
    Args:
        role_name (str): The name of the role to require (e.g., 'Admin', 'Manager')
    
    Returns:
        function: Decorated function that checks role before execution
    
    Usage:
        @require_role('Admin')
        def admin_only_endpoint():
            return jsonify({'message': 'Admin only'})
    
    Raises:
        403: If user doesn't have the required role
        404: If user is not found
    """
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            # Skip role check in debug mode
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)
            
            try:
                user_id = int(get_jwt_identity())
                user = User.query.get(user_id)

                if not user:
                    return jsonify({'error': 'User not found'}), 404

                # Check if user has the required role
                has_role = any(role.name == role_name for role in user.roles)

                if not has_role:
                    return jsonify({
                        'error': f'Insufficient permissions. Required role: {role_name}'
                    }), 403

                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': f'Role check failed: {str(e)}'}), 500
        
        return decorated_function
    return decorator


def require_any_role(*role_names):
    """
    Decorator to require any one of multiple roles on an endpoint.
    
    Args:
        *role_names: Variable length argument list of role names
    
    Returns:
        function: Decorated function that checks if user has any of the roles
    
    Usage:
        @require_any_role('Admin', 'Manager')
        def manager_endpoint():
            return jsonify({'message': 'Admin or Manager only'})
    
    Raises:
        403: If user doesn't have any of the required roles
        404: If user is not found
    """
    def decorator(f):
        @wraps(f)
        @optional_jwt_required
        def decorated_function(*args, **kwargs):
            # Skip role check in debug mode
            if current_app.config.get("DEBUG", False):
                return f(*args, **kwargs)
            
            try:
                user_id = int(get_jwt_identity())
                user = User.query.get(user_id)

                if not user:
                    return jsonify({'error': 'User not found'}), 404

                # Check if user has any of the required roles
                user_role_names = {role.name for role in user.roles}
                has_role = any(role_name in user_role_names for role_name in role_names)

                if not has_role:
                    return jsonify({
                        'error': f'Insufficient permissions. Required any of: {", ".join(role_names)}'
                    }), 403

                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': f'Role check failed: {str(e)}'}), 500
        
        return decorated_function
    return decorator


def get_current_user():
    """
    Get the current authenticated user from JWT token.
    
    Returns:
        User: The current user object, or None if not authenticated
    
    Usage:
        @jwt_required()
        def my_endpoint():
            user = get_current_user()
            return jsonify({'user': user.to_dict()})
    """
    try:
        user_id = int(get_jwt_identity())
        return User.query.get(user_id)
    except Exception:
        return None


def get_current_user_permissions():
    """
    Get all permissions for the current authenticated user.
    
    Returns:
        list: List of permission names the user has
    
    Usage:
        @jwt_required()
        def my_endpoint():
            permissions = get_current_user_permissions()
            return jsonify({'permissions': permissions})
    """
    user = get_current_user()
    if not user:
        return []
    return user.get_permissions()


def get_current_user_roles():
    """
    Get all roles for the current authenticated user.
    
    Returns:
        list: List of role names the user has
    
    Usage:
        @jwt_required()
        def my_endpoint():
            roles = get_current_user_roles()
            return jsonify({'roles': roles})
    """
    user = get_current_user()
    if not user:
        return []
    return [role.name for role in user.roles]
