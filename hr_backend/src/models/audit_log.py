from src.models.user import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)

    # Allow null for system-generated events
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50), nullable=True)
    resource_id = db.Column(db.Integer, nullable=True)

    # FIX: Replace Text with JSON field
    details = db.Column(JSON, nullable=True)

    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship(
        'User',
        backref=db.backref(
            'audit_logs',
            lazy='dynamic',
            order_by='AuditLog.timestamp.desc()'
        )
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else 'System',
            'first_name': self.user.first_name if self.user else '',
            'last_name': self.user.last_name if self.user else '',
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': self.details if self.details else {},  # Always return JSON
            'timestamp': self.timestamp.isoformat() + 'Z'
        }
