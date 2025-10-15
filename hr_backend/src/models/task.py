from src.models.user import db
from datetime import datetime

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='Pending', nullable=False)  # Pending, In Progress, Completed
    priority = db.Column(db.String(50), default='Medium', nullable=False)  # Low, Medium, High
    due_date = db.Column(db.DateTime, nullable=True)
    
    # Foreign keys
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    assigned_to = db.relationship('User', foreign_keys=[assigned_to_id], backref='assigned_tasks')
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id], backref='created_tasks')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Task {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'assigned_to': {
                'id': self.assigned_to.id,
                'username': self.assigned_to.username,
                'first_name': self.assigned_to.first_name,
                'last_name': self.assigned_to.last_name,
                'email': self.assigned_to.email
            } if self.assigned_to else None,
            'assigned_by': {
                'id': self.assigned_by.id,
                'username': self.assigned_by.username,
                'first_name': self.assigned_by.first_name,
                'last_name': self.assigned_by.last_name
            } if self.assigned_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

