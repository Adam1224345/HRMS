from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from src.models.user import User, Role, db
from datetime import timedelta
import secrets
import string

auth_bp = Blueprint('auth', __name__)

# In-memory stores
blacklisted_tokens = set()
reset_tokens = {}


@auth_bp.route('/register', methods=['POST'])
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
            last_name=data.get('last_name', '')
        )
        user.set_password(data['password'])

        default_role = Role.query.filter_by(name='Employee').first()
        if default_role:
            user.roles.append(default_role)

        db.session.add(user)
        db.session.commit()

        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(include_roles=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
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
        data = request.get_json()
        if not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400

        user = User.query.filter(
            (User.username == data['username']) | (User.email == data['username'])
        ).first()

        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        if not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 401

        access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=24))
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict(include_roles=True)
        }), 200
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
        jti = get_jwt()['jti']
        blacklisted_tokens.add(jti)
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

        data = request.get_json()
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
        return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict(include_roles=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
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

        data = request.get_json()
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400

        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 400

        user.set_password(data['new_password'])
        db.session.commit()
        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
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
        data = request.get_json()
        if not data.get('email'):
            return jsonify({'error': 'Email is required'}), 400

        user = User.query.filter_by(email=data['email']).first()
        if not user:
            return jsonify({'message': 'If the email exists, a reset token has been generated'}), 200

        token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        reset_tokens[token] = user.id
        return jsonify({'message': 'Password reset token generated', 'reset_token': token}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/reset-password', methods=['POST'])
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
        data = request.get_json()
        if not data.get('token') or not data.get('new_password'):
            return jsonify({'error': 'Token and new password are required'}), 400

        user_id = reset_tokens.get(data['token'])
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        user.set_password(data['new_password'])
        db.session.commit()
        del reset_tokens[data['token']]

        return jsonify({'message': 'Password reset successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def check_if_token_revoked(jwt_header, jwt_payload):
    """Check if JWT token is blacklisted"""
    jti = jwt_payload['jti']
    return jti in blacklisted_tokens
