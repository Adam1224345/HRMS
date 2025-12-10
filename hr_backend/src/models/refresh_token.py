from src.models.user import db, User
from datetime import datetime

class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id = db.Column(db.Integer, primary_key=True)
    refresh_token = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    # ✅ FIXED FOREIGN KEY
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Relationship to User
    user = db.relationship("User", backref="refresh_tokens", lazy=True)

    @staticmethod
    def is_token_revoked(jti):
        token = RefreshToken.query.filter_by(refresh_token=jti).first()
        return token is None
