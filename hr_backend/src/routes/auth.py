from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from flask_jwt_extended.utils import decode_token
from src.models.user import User, Role, db
from src.models.refresh_token import RefreshToken
from src.utils.audit_logger import log_audit_event
from src.utils.password_validator import validate_password_strength
from datetime import timedelta, datetime
import secrets
import string

# Rate limiter integration: import limiter from main if available
try:
    from src.main import limiter
    from flask_limiter.util import get_remote_address
except Exception:
    limiter = None
    def get_remote_address():
        return request.remote_addr if request else "0.0.0.0"

auth_bp = Blueprint('auth', __name__)
blacklisted_tokens = set()
reset_tokens = {}

def user_id_key_func():
    """
    Used for user-scoped rate limiting where a JWT identity is available.
    Falls back to remote IP if identity not present.
    """
    try:
        uid = get_jwt_identity()
        if uid:
            return f"user:{uid}"
    except Exception:
        pass
    return get_remote_address()

# ---------------------------
# Helper decorator to apply limiter only if it exists
def apply_limit(limit_str, key_func=get_remote_address):
    def decorator(f):
        if limiter:
            return limiter.limit(limit_str, key_func=key_func)(f)
        return f
    return decorator
# ---------------------------

@auth_bp.route('/register', methods=['POST'])
@apply_limit("10/hour", key_func=get_remote_address)
def register():
    """
    Register a new user
    ---
    tags:
      - Authentication
    description: Create a new user account with username, email, and password.
    parameters:
      - name: body
        in: body
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
              example: johndoe
            email:
              type: string
              example: johndoe@example.com
            password:
              type: string
              example: strongpassword123
            first_name:
              type: string
              example: John
            last_name:
              type: string
              example: Doe
    responses:
      201:
        description: User registered successfully
      400:
        description: Missing or invalid data
      500:
        description: Server error
    """
    try:
        data = request.get_json() or {}
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        is_valid, error_msg = validate_password_strength(data['password'])
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400

        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', '')
        )
        user.set_password(data['password'])

        default_role = Role.query.filter_by(name='Employee').first()
        if default_role:
            user.roles.append(default_role)

        db.session.add(user)
        db.session.commit()

        # REAL AUDIT LOG
        log_audit_event(
            user_id=user.id,
            action='USER_REGISTERED',
            resource_type='User',
            resource_id=user.id,
            details={'username': user.username, 'email': user.email}
        )

        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(include_roles=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
@apply_limit("20/hour", key_func=get_remote_address)
def login():
    """
    Authenticate user and return JWT token
    ---
    tags:
      - Authentication
    description: Login with username or email and password to get a JWT token.
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: johndoe
            password:
              type: string
              example: strongpassword123
    responses:
      200:
        description: Login successful
      400:
        description: Missing credentials
      401:
        description: Invalid credentials
      500:
        description: Server error
    """
    try:
        data = request.get_json() or {}
        if not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400

        user = User.query.filter(
            (User.username == data['username']) | (User.email == data['username'])
        ).first()

        if not user or not user.check_password(data['password']):
            # Log failed login attempt
            log_audit_event(
                user_id=0, # Use 0 or a system user ID for unauthenticated actions
                action='LOGIN_FAILED',
                resource_type='User',
                details={'username_attempt': data['username'], 'ip_address': request.remote_addr}
            )
            return jsonify({'error': 'Invalid credentials'}), 401
        if not user.is_active:
            # Log failed login attempt - account deactivated
            log_audit_event(
                user_id=user.id,
                action='LOGIN_FAILED_DEACTIVATED',
                resource_type='User',
                resource_id=user.id,
                details={'ip_address': request.remote_addr}
            )
            return jsonify({'error': 'Account is deactivated'}), 401

        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        # decode refresh token to extract jti and expiry
        try:
            decoded = decode_token(refresh_token)
            refresh_jti = decoded.get('jti')
            exp = decoded.get('exp')
            expires_at = datetime.utcfromtimestamp(exp) if exp else None
            if refresh_jti:
                RefreshToken.add_token(user.id, refresh_jti, expires_at)
        except Exception:
            # If for some reason decoding fails, still continue but write an audit entry
            log_audit_event(user_id=user.id, action='REFRESH_JTI_DECODE_FAILED', resource_type='User', resource_id=user.id)

        # Log successful login
        log_audit_event(
            user_id=user.id,
            action='USER_LOGIN',
            resource_type='User',
            resource_id=user.id,
            details={'ip_address': request.remote_addr}
        )
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict(include_roles=True)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/token/refresh', methods=['POST'])
@jwt_required(refresh=True)
@apply_limit("60/hour", key_func=user_id_key_func)
def refresh():
    """
    Refresh access token
    ---
    tags:
      - Authentication
    security:
      - Refresh: []
    responses:
      200:
        description: New access token generated
      401:
        description: Invalid refresh token
    """
    try:
        # jti of the incoming refresh token (current request)
        current_payload = get_jwt()
        current_jti = current_payload.get('jti')

        # Ensure the current refresh token is valid in DB and not revoked
        # Revoke it now (rotation)
        if not RefreshToken.revoke_token(current_jti):
            # token not found or already revoked
            return jsonify({'error': 'Invalid or revoked refresh token'}), 401

        # Issue new tokens
        user_id = get_jwt_identity()
        new_access_token = create_access_token(identity=user_id)
        new_refresh_token = create_refresh_token(identity=user_id)

        # store new refresh token jti in DB
        try:
            decoded_new = decode_token(new_refresh_token)
            new_jti = decoded_new.get('jti')
            exp = decoded_new.get('exp')
            new_expires_at = datetime.utcfromtimestamp(exp) if exp else None
            if new_jti:
                RefreshToken.add_token(int(user_id), new_jti, new_expires_at)
        except Exception:
            log_audit_event(user_id=int(user_id) if user_id else 0, action='NEW_REFRESH_DECODE_FAILED', resource_type='User', resource_id=user_id)

        # Log token refresh
        log_audit_event(
            user_id=int(user_id) if user_id else 0,
            action='TOKEN_REFRESHED',
            resource_type='User',
            resource_id=user_id
        )

        return jsonify({'access_token': new_access_token, 'refresh_token': new_refresh_token}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user by blacklisting the JWT token
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Successfully logged out
      500:
        description: Server error
    """
    try:
        user_id = int(get_jwt_identity())
        jti = get_jwt().get('jti')
        # Revoke this token's JTI in the DB (if present)
        if jti:
            RefreshToken.revoke_token(jti)
        # Keep old in-memory blacklist for backward compatibility (harmless)
        blacklisted_tokens.add(jti)

        # Log successful logout
        log_audit_event(
            user_id=user_id,
            action='USER_LOGOUT',
            resource_type='User',
            resource_id=user_id
        )
        return jsonify({'message': 'Successfully logged out'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get current user's profile
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: User profile returned successfully
      404:
        description: User not found
      500:
        description: Server error
    """
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'user': user.to_dict(include_roles=True)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Update current user's profile
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            first_name:
              type: string
              example: John
            last_name:
              type: string
              example: Doe
            email:
              type: string
              example: john.doe@example.com
    responses:
      200:
        description: Profile updated successfully
      400:
        description: Email already exists
      404:
        description: User not found
      500:
        description: Server error
    """
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            existing_user = User.query.filter(User.email == data['email'], User.id != user_id).first()
            if existing_user:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']

        db.session.commit()

        # REAL AUDIT LOG
        log_audit_event(
            user_id=user.id,
            action='PROFILE_UPDATED',
            resource_type='User',
            resource_id=user.id,
            details={'changes': data}
        )

        return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict(include_roles=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
@apply_limit("30/hour", key_func=user_id_key_func)
def change_password():
    """
    Change user's password
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - current_password
            - new_password
          properties:
            current_password:
              type: string
              example: oldpassword123
            new_password:
              type: string
              example: newStrongPassword123
    responses:
      200:
        description: Password changed successfully
      400:
        description: Invalid current password
      404:
        description: User not found
      500:
        description: Server error
    """
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400

        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 400

        is_valid, error_msg = validate_password_strength(data['new_password'])
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        user.set_password(data['new_password'])
        db.session.commit()

        # REAL AUDIT LOG
        log_audit_event(
            user_id=user.id,
            action='PASSWORD_CHANGED',
            resource_type='User',
            resource_id=user.id
        )

        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
@apply_limit("10/hour", key_func=get_remote_address)
def forgot_password():
    """
    Generate password reset token
    ---
    tags:
      - Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - email
          properties:
            email:
              type: string
              example: johndoe@example.com
    responses:
      200:
        description: Reset token generated
      400:
        description: Missing email
      500:
        description: Server error
    """
    try:
        data = request.get_json() or {}
        if not data.get('email'):
            return jsonify({'error': 'Email is required'}), 400

        user = User.query.filter_by(email=data['email']).first()
        if not user:
            return jsonify({'message': 'If the email exists, a reset token has been generated'}), 200

        token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        reset_tokens[token] = user.id

        # REAL AUDIT LOG
        log_audit_event(
            user_id=user.id,
            action='PASSWORD_RESET_REQUESTED',
            resource_type='User',
            resource_id=user.id
        )

        return jsonify({'message': 'Password reset token generated', 'reset_token': token}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/reset-password', methods=['POST'])
@apply_limit("10/hour", key_func=get_remote_address)
def reset_password():
    """
    Reset password using token
    ---
    tags:
      - Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - token
            - new_password
          properties:
            token:
              type: string
              example: ABC123XYZ456
            new_password:
              type: string
              example: newPassword789
    responses:
      200:
        description: Password reset successfully
      400:
        description: Invalid or expired token
      404:
        description: User not found
      500:
        description: Server error
    """
    try:
        data = request.get_json() or {}
        if not data.get('token') or not data.get('new_password'):
            return jsonify({'error': 'Token and new password are required'}), 400

        user_id = reset_tokens.get(data['token'])
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        is_valid, error_msg = validate_password_strength(data['new_password'])
        if not is_valid:
            return jsonify({'error': error_msg}), 400

        user.set_password(data['new_password'])
        db.session.commit()
        del reset_tokens[data['token']]
        # REAL AUDIT LOG
        log_audit_event(
            user_id=user.id,
            action='PASSWORD_RESET',
            resource_type='User',
            resource_id=user.id
        )

        return jsonify({'message': 'Password reset successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def check_if_token_revoked(jwt_header, jwt_payload):
    """Check if JWT token is blacklisted or revoked in DB."""
    jti = jwt_payload.get('jti')
    try:
        if RefreshToken.is_token_revoked(jti):
            return True
    except Exception:
        pass

    return jti in blacklisted_tokens
