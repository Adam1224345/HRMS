from src.models.user import db
from datetime import datetime

class Document(db.Model):
    __tablename__ = 'documents'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)    
    original_name = db.Column(db.String(255), nullable=False)     
    # Cloudinary URLs can be long, so String(500) is good
    file_path = db.Column(db.String(500), nullable=False) 
    file_type = db.Column(db.String(100), nullable=False)
    purpose = db.Column(db.String(100), default='general')         
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    leave_id = db.Column(db.Integer, db.ForeignKey('leave.id'), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    uploader = db.relationship('User', backref='documents')
    leave = db.relationship('Leave', backref='documents')

    def to_dict(self):
        return {
            "id": self.id,
            "original_name": self.original_name,
            "purpose": self.purpose,
            "file_type": self.file_type,
            "uploaded_at": self.uploaded_at.isoformat() + 'Z',
            # This URL points to your backend route which handles the redirect
            "download_url": f"/api/documents/download/{self.id}",
            "uploader": {
                "id": self.uploader.id,
                "username": self.uploader.username,
                "full_name": f"{self.uploader.first_name or ''} {self.uploader.last_name or ''}".strip()
            }
        }
