import json
from flask import request
from src.models.user import db

# SENSITIVE KEYS THAT MUST NEVER BE LOGGED
SENSITIVE_KEYS = {
    "password", "new_password", "current_password",
    "token", "reset_token", "access_token", "refresh_token",
    "email", "otp"
}

def sanitize_details(details: dict) -> dict:
    """
    Sanitizes sensitive fields so they are not stored in logs.
    """
    if not isinstance(details, dict):
        return {}

    safe = {}
    for key, value in details.items():
        if key.lower() in SENSITIVE_KEYS:
            safe[key] = "[REDACTED]"
        else:
            safe[key] = value
    return safe


def log_audit_event(user_id, action, resource_type=None, resource_id=None, details=None):
    """
    Secure audit logging. Does NOT break application if logging fails.
    """

    try:
        from src.models.audit_log import AuditLog

        # --- Request Meta ---
        meta = {
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "path": request.path,
            "method": request.method
        }

        # --- Merge details ---
        if isinstance(details, dict):
            meta.update(sanitize_details(details))

        details_json = json.dumps(meta)

        log = AuditLog(
            user_id=user_id or 0,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details_json
        )

        db.session.add(log)
        db.session.commit()

    except Exception as e:
        # NEVER crash API due to logging failure
        db.session.rollback()
        print(f"[AUDIT LOG ERROR] {str(e)}")
