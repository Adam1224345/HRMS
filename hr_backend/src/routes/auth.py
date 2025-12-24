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
from src.models.password_reset_token import PasswordResetToken
from src.utils.audit_logger import log_audit_event
from src.utils.password_validator import validate_password_strength
from flask_mail import Message

# ✅ FIX 1: Import timezone and os
from datetime import timedelta, datetime, timezone
import secrets
import string
import os

# Rate limiter integration
try:
    from src.main import limiter
    from flask_limiter.util import get_remote_address
except Exception:
    limiter = None
    def get_remote_address():
        return request.remote_addr if request else "0.0.0.0"

auth_bp = Blueprint("auth", __name__)
blacklisted_tokens = set()
reset_tokens = {}

def user_id_key_func():
    try:
        uid = get_jwt_identity()
        if uid:
            return f"user:{uid}"
    except Exception:
        pass
    return get_remote_address()

def apply_limit(limit_str, key_func=get_remote_address):
    def decorator(f):
        if limiter:
            return limiter.limit(limit_str, key_func=key_func)(f)
        return f
    return decorator

# --------------------------------------------------------------------
# REGISTER
# --------------------------------------------------------------------
@auth_bp.route("/register", methods=["POST"])
@apply_limit("10/hour", key_func=get_remote_address)
def register():
    try:
        data = request.get_json() or {}
        required_fields = ["username", "email", "password"]

        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"{field} is required"}), 400

        is_valid, error_msg = validate_password_strength(data["password"])
        if not is_valid:
            return jsonify({"error": error_msg}), 400

        if User.query.filter_by(username=data["username"]).first():
            return jsonify({"error": "Username already exists"}), 400
        if User.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already exists"}), 400

        user = User(
            username=data["username"],
            email=data["email"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", "")
        )
        user.set_password(data["password"])

        default_role = Role.query.filter_by(name="Employee").first()
        if default_role:
            user.roles.append(default_role)

        db.session.add(user)
        db.session.commit()

        log_audit_event(
            user_id=user.id,
            action="USER_REGISTERED",
            resource_type="User",
            resource_id=user.id,
            details={"username": user.username, "email": user.email},
        )

        return jsonify({
            "message": "User registered successfully",
            "user": user.to_dict(include_roles=True)
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# LOGIN
# --------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
@apply_limit("20/hour", key_func=get_remote_address)
def login():
    try:
        data = request.get_json() or {}

        if not data.get("username") or not data.get("password"):
            return jsonify({"error": "Username and password are required"}), 400

        user = User.query.filter(
            (User.username == data["username"]) | (User.email == data["username"])
        ).first()

        if not user or not user.check_password(data["password"]):
            log_audit_event(
                user_id=0,
                action="LOGIN_FAILED",
                resource_type="User",
                details={"username_attempt": data["username"], "ip_address": request.remote_addr},
            )
            return jsonify({"error": "Invalid credentials"}), 401

        if not user.is_active:
            log_audit_event(
                user_id=user.id,
                action="LOGIN_FAILED_DEACTIVATED",
                resource_type="User",
                resource_id=user.id,
                details={"ip_address": request.remote_addr},
            )
            return jsonify({"error": "Account is deactivated"}), 401

        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        try:
            decoded = decode_token(refresh_token)
            refresh_jti = decoded.get("jti")
            exp = decoded.get("exp")
            
            # ✅ FIX 2: Use aware datetime for expiration
            expires_at = (
                datetime.fromtimestamp(exp, timezone.utc) 
                if exp else datetime.now(timezone.utc) + timedelta(days=7)
            )

            RefreshToken.add_token(user.id, refresh_jti, expires_at)

        except Exception as e:
            # ✅ FIX 3: Use aware datetime for fallback
            RefreshToken.add_token(
                user.id, None, datetime.now(timezone.utc) + timedelta(days=7)
            )
            print("Warning: refresh token decode failed:", e)

        log_audit_event(
            user_id=user.id,
            action="USER_LOGIN",
            resource_type="User",
            resource_id=user.id,
            details={"ip_address": request.remote_addr},
        )

        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user.to_dict(include_roles=True),
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# REFRESH TOKEN
# --------------------------------------------------------------------
@auth_bp.route("/token/refresh", methods=["POST"])
@jwt_required(refresh=True)
@apply_limit("60/hour", key_func=user_id_key_func)
def refresh():
    try:
        current_payload = get_jwt()
        current_jti = current_payload.get("jti")

        if not RefreshToken.revoke_token(current_jti):
            return jsonify({"error": "Invalid or revoked refresh token"}), 401

        user_id = get_jwt_identity()

        new_access_token = create_access_token(identity=user_id)
        new_refresh_token = create_refresh_token(identity=user_id)

        try:
            decoded_new = decode_token(new_refresh_token)
            new_jti = decoded_new.get("jti")
            exp = decoded_new.get("exp")
            
            # ✅ FIX 4: Use aware datetime for new token
            new_expires_at = (
                datetime.fromtimestamp(exp, timezone.utc)
                if exp
                else datetime.now(timezone.utc) + timedelta(days=7)
            )
            RefreshToken.add_token(int(user_id), new_jti, new_expires_at)

        except Exception as e:
            # ✅ FIX 5: Use aware datetime for fallback
            RefreshToken.add_token(
                int(user_id), None, datetime.now(timezone.utc) + timedelta(days=7)
            )
            print("Warning: new refresh token decode failed:", e)

        log_audit_event(
            user_id=int(user_id),
            action="TOKEN_REFRESHED",
            resource_type="User",
            resource_id=user_id,
        )

        return jsonify({
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# LOGOUT
# --------------------------------------------------------------------
@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        user_id = int(get_jwt_identity())
        jti = get_jwt().get("jti")

        if jti:
            RefreshToken.revoke_token(jti)

        blacklisted_tokens.add(jti)

        log_audit_event(
            user_id=user_id,
            action="USER_LOGOUT",
            resource_type="User",
            resource_id=user_id,
        )

        return jsonify({"message": "Successfully logged out"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# GET PROFILE
# --------------------------------------------------------------------
@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"user": user.to_dict(include_roles=True)}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# UPDATE PROFILE
# --------------------------------------------------------------------
@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}

        if "first_name" in data:
            user.first_name = data["first_name"]
        if "last_name" in data:
            user.last_name = data["last_name"]

        if "email" in data:
            existing_user = User.query.filter(
                User.email == data["email"], User.id != user_id
            ).first()
            if existing_user:
                return jsonify({"error": "Email already exists"}), 400
            user.email = data["email"]

        db.session.commit()

        log_audit_event(
            user_id=user.id,
            action="PROFILE_UPDATED",
            resource_type="User",
            resource_id=user.id,
            details={"changes": data},
        )

        return jsonify({
            "message": "Profile updated successfully",
            "user": user.to_dict(include_roles=True),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# CHANGE PASSWORD
# --------------------------------------------------------------------
@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
@apply_limit("30/hour", key_func=user_id_key_func)
def change_password():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}

        if not data.get("current_password") or not data.get("new_password"):
            return jsonify({"error": "Current password and new password are required"}), 400

        if not user.check_password(data["current_password"]):
            return jsonify({"error": "Current password is incorrect"}), 400

        is_valid, error_msg = validate_password_strength(data["new_password"])
        if not is_valid:
            return jsonify({"error": error_msg}), 400

        user.set_password(data["new_password"])
        db.session.commit()

        log_audit_event(
            user_id=user.id,
            action="PASSWORD_CHANGED",
            resource_type="User",
            resource_id=user.id,
        )

        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# FORGOT PASSWORD
# --------------------------------------------------------------------
@auth_bp.route("/forgot-password", methods=["POST"])
@apply_limit("10/hour", key_func=get_remote_address)
def forgot_password():
    try:
        data = request.get_json() or {}
        if not data.get("email"):
            return jsonify({"error": "Email is required"}), 400

        user = User.query.filter_by(email=data["email"]).first()

        if user:
            token = PasswordResetToken.generate(user)
            
            # ✅ FIX: Use environment variable for real production URL
            # Fallback to localhost only if FRONTEND_URL is missing
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
            
            # Prevent double slashes
            if frontend_url.endswith('/'):
                frontend_url = frontend_url[:-1]

            reset_url = f"{frontend_url}/reset-password/{token}"
            
            msg = Message(
                subject="HRMS - Password Reset Request",
                sender=current_app.config["MAIL_DEFAULT_SENDER"],
                recipients=[user.email]
            )
            msg.body = f"""
Hello {user.first_name or user.username},

You requested a password reset for your HRMS account.

Click the link below to reset your password:

{reset_url}

This link is valid for 1 hour.

If you did not request this, please ignore this email.

Thank you,
HRMS Team
            """
            try:
                current_app.extensions['mail'].send(msg)
                print(f"Password reset email sent to {user.email}")
            except Exception as e:
                print(f"Failed to send email: {e}")

            log_audit_event(
                user_id=user.id,
                action="PASSWORD_RESET_REQUESTED",
                resource_type="User",
                resource_id=user.id,
            )

        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

    except Exception as e:
        print(f"Forgot password error: {e}")
        return jsonify({"error": "Server error"}), 500

# --------------------------------------------------------------------
# RESET PASSWORD
# --------------------------------------------------------------------
@auth_bp.route("/reset-password", methods=["POST"])
@apply_limit("10/hour", key_func=get_remote_address)
def reset_password():
    try:
        data = request.get_json() or {}
        if not data.get("token") or not data.get("new_password"):
            return jsonify({"error": "Token and new password are required"}), 400

        # Note: If error persists here, check 'src/models/password_reset_token.py'
        # ensure it also uses datetime.now(timezone.utc)
        reset_token = PasswordResetToken.get_valid(data["token"])
        if not reset_token:
            return jsonify({"error": "Invalid or expired token"}), 400

        user = reset_token.user

        is_valid, error_msg = validate_password_strength(data["new_password"])
        if not is_valid:
            return jsonify({"error": error_msg}), 400

        user.set_password(data["new_password"])
        reset_token.mark_used()

        log_audit_event(
            user_id=user.id,
            action="PASSWORD_RESET",
            resource_type="User",
            resource_id=user.id,
        )

        return jsonify({"message": "Password reset successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------
# CHECK TOKEN REVOCATION
# --------------------------------------------------------------------
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload.get("jti")
    try:
        if RefreshToken.is_token_revoked(jti):
            return True
    except Exception:
        pass
    return jti in blacklisted_tokens