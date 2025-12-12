from src.models.user import db
from datetime import datetime

class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id = db.Column(db.Integer, primary_key=True)

    # Store ONLY JTI (unique identifier of refresh token)
    jti = db.Column(db.String(120), unique=True, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    user = db.relationship("User", backref="refresh_tokens", lazy=True)

    @staticmethod
    def add_token(user_id, jti, expires_at):
        """Store a new refresh token."""
        token = RefreshToken(
            user_id=user_id,
            jti=jti,
            expires_at=expires_at
        )
        db.session.add(token)
        db.session.commit()

    @staticmethod
    def revoke_token(jti):
        """Delete a refresh token (rotate)."""
        token = RefreshToken.query.filter_by(jti=jti).first()
        if token:
            db.session.delete(token)
            db.session.commit()
            return True
        return False

    @staticmethod
    def is_token_revoked(jti):
        """Check if refresh token exists."""
        token = RefreshToken.query.filter_by(jti=jti).first()
        return token is None
