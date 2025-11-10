# src/utils/audit_logger.py
import json
from flask import request
from src.models.user import db

def log_audit_event(user_id, action, resource_type=None, resource_id=None, details=None):
    try:
        # Lazy import to avoid circular import
        from src.models.audit_log import AuditLog

        extra = {
            "ip": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "path": request.path,
            "method": request.method
        }
        if isinstance(details, dict):
            extra.update(details)
        details_json = json.dumps(extra)

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
        db.session.rollback()
        print(f"[AUDIT LOG ERROR] {e}")