from src.models.user import db
from datetime import datetime

class Leave(db.Model):
    __tablename__ = 'leave'

    id = db.Column(db.Integer, primary_key=True)
    leave_type = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default='Pending', nullable=False)
    remarks = db.Column(db.Text, nullable=True)

    # REAL APPLICATION FIX:
    # When a user is deleted → keep record → user_id set to NULL
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete="SET NULL"),
        nullable=True
    )

    reviewed_by_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    user = db.relationship(
        'User',
        foreign_keys=[user_id],
        backref=db.backref('leave_requests', lazy='dynamic', passive_deletes=True)
    )

    reviewed_by = db.relationship(
        'User',
        foreign_keys=[reviewed_by_id],
        backref=db.backref('reviewed_leaves', lazy='dynamic', passive_deletes=True)
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'leave_type': self.leave_type,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'reason': self.reason,
            'status': self.status,
            'remarks': self.remarks or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,

            # USER WHO CREATED THE LEAVE
            'user': {
                'id': self.user.id if self.user else None,
                'username': self.user.username if self.user else "Deleted User",
                'first_name': (self.user.first_name if self.user else '') or '',
                'last_name': (self.user.last_name if self.user else '') or '',
                'full_name': (
                    f"{self.user.first_name or ''} {self.user.last_name or ''}".strip()
                    if self.user else "Deleted User"
                ),
            },

            # ADMIN WHO REVIEWED
            'reviewed_by': {
                'id': self.reviewed_by.id if self.reviewed_by else None,
                'username': self.reviewed_by.username if self.reviewed_by else None,
                'full_name': (
                    f"{(self.reviewed_by.first_name or '')} {(self.reviewed_by.last_name or '')}".strip()
                    if self.reviewed_by else None
                )
            } if self.reviewed_by else None
        }
