from src.models.user import db
from datetime import datetime

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)

    # FIX: Allow NULL so deleting a user won't break notifications/history
    recipient_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete="SET NULL"),
        nullable=True
    )

    sender_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete="SET NULL"),
        nullable=True
    )

    message = db.Column(db.String(500), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    related_id = db.Column(db.Integer, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    recipient = db.relationship(
        'User',
        foreign_keys=[recipient_id],
        backref=db.backref('notifications', lazy='dynamic', passive_deletes=True)
    )

    sender = db.relationship(
        'User',
        foreign_keys=[sender_id],
        backref=db.backref('sent_notifications', lazy='dynamic', passive_deletes=True)
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.recipient_id,
            'sender_id': self.sender_id,
            'message': self.message,
            'type': self.type,
            'related_id': self.related_id,
            'is_read': self.is_read,

            # Do NOT crash when user is deleted
            'recipient': {
                'id': self.recipient.id if self.recipient else None,
                'username': self.recipient.username if self.recipient else "Deleted User"
            },

            'sender': {
                'id': self.sender.id if self.sender else None,
                'username': self.sender.username if self.sender else "Deleted User"
            },

            'timestamp': self.timestamp.isoformat() + 'Z' if self.timestamp else None
        }

    @staticmethod
    def create_notification(recipient_id, message, type, related_id=None, sender_id=None):
        new_notification = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            message=message,
            type=type,
            related_id=related_id
        )
        db.session.add(new_notification)
        return new_notification
