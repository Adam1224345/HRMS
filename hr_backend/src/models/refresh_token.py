from src.models.user import db
from datetime import datetime, timezone  # ← timezone import zaroori

class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(120), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)

    user = db.relationship("User", backref="refresh_tokens", lazy=True)

    @staticmethod
    def add_token(user_id, jti, expires_at):
        """Add new refresh token (rotate old one if exists)"""
        # Optional: Old jti wala delete kar do (safety)
        if jti:
            RefreshToken.query.filter_by(jti=jti).delete()

        token = RefreshToken(
            user_id=user_id,
            jti=jti or "fallback-jti",
            expires_at=expires_at  # Yeh already aware UTC datetime hoga
        )
        db.session.add(token)
        db.session.commit()

    @staticmethod
    def revoke_token(jti):
        """Revoke by deleting (token rotation)"""
        if not jti:
            return False
        deleted = RefreshToken.query.filter_by(jti=jti).delete()
        db.session.commit()
        return deleted > 0

    @staticmethod
    def is_token_revoked(jti):
        """Token missing OR expired = revoked"""
        if not jti:
            return True

        token = RefreshToken.query.filter_by(jti=jti).first()
        if not token:
            return True

        # Expiry check in UTC
        return token.expires_at < datetime.now(timezone.utc)
