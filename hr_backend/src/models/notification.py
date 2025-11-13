from src.models.user import db
from datetime import datetime

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    message = db.Column(db.String(500), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    related_id = db.Column(db.Integer, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='notifications')
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_notifications')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.recipient_id,        # Frontend expects `user_id`
            'sender_id': self.sender_id,
            'message': self.message,
            'type': self.type,
            'related_id': self.related_id,
            'is_read': self.is_read,
            'timestamp': self.timestamp.isoformat() + 'Z' if self.timestamp else None
        }

    @staticmethod
    def create_notification(recipient_id, message, type, related_id=None, sender_id=None):
        """
        Creates a notification but does NOT commit.
        Caller must commit after all DB operations.
        """
        new_notification = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            message=message,
            type=type,
            related_id=related_id
        )
        db.session.add(new_notification)
        return new_notification