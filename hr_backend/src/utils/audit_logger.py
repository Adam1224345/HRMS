from flask import request
from src.models.audit_log import db, AuditLog

# System event = NULL user_id
SYSTEM_USER_ID = None


def get_client_ip():
    """Safely get client IP without crashing on background tasks."""
    try:
        return request.remote_addr
    except Exception:
        return "Unknown"


def get_user_agent():
    """Safely get User-Agent header even if no request context."""
    try:
        return request.headers.get("User-Agent", "Unknown")
    except Exception:
        return "Unknown"


def log_action(action, resource_type=None, resource_id=None, user_id=None, details=None):
    """
    Create an audit log entry.
    user_id:
        - Logged in user → integer
        - System event → None
    """

    # FIX: Ensure valid user_id
    final_user_id = user_id if user_id not in (None, 0, "0") else SYSTEM_USER_ID

    log_entry = AuditLog(
        user_id=final_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )

    db.session.add(log_entry)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print("Audit Log Error:", e)


def log_audit_event(action, resource_type=None, resource_id=None, user_id=None, details=None):
    """
    Wrapper function.
    IMPORTANT: This keeps the SAME signature your entire app uses.
    """
    return log_action(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        details=details
    )
