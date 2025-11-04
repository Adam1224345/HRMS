from src.models.user import db
from datetime import datetime

class Leave(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    leave_type = db.Column(db.String(100), nullable=False)  # Sick Leave, Casual Leave, Vacation, etc.
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default='Pending', nullable=False)  # Pending, Approved, Rejected
    remarks = db.Column(db.Text, nullable=True)  # Admin/HR remarks
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='leave_requests')
    reviewed_by = db.relationship('User', foreign_keys=[reviewed_by_id], backref='reviewed_leaves')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Leave {self.leave_type} - {self.user.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'leave_type': self.leave_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'reason': self.reason,
            'status': self.status,
            'remarks': self.remarks,
            'user': {
                'id': self.user.id,
                'username': self.user.username,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'email': self.user.email
            } if self.user else None,
            'reviewed_by': {
                'id': self.reviewed_by.id,
                'username': self.reviewed_by.username,
                'first_name': self.reviewed_by.first_name,
                'last_name': self.reviewed_by.last_name
            } if self.reviewed_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

