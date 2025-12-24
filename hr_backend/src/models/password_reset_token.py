from src.models.user import db
# ✅ FIX 1: Import timezone
from datetime import datetime, timedelta, timezone 
import uuid

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(255), unique=True, nullable=False)
    # Note: Ensure your DB column type supports timezones if needed, 
    # but SQLAlchemy usually handles the conversion if we pass aware objects.
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used = db.Column(db.Boolean, default=False)

    user = db.relationship('User', backref='password_reset_tokens')

    @staticmethod
    def generate(user):
        token = str(uuid.uuid4())
        
        # ✅ FIX 2: Use timezone-aware datetime for expiration
        # datetime.utcnow() is naive (no timezone), which causes the crash.
        expires = datetime.now(timezone.utc) + timedelta(hours=1)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires
        )
        db.session.add(reset_token)
        db.session.commit()
        return token

    @staticmethod
    def get_valid(token_str):
        token = PasswordResetToken.query.filter_by(token=token_str, used=False).first()
        
        # ✅ FIX 3: Compare against timezone-aware current time
        # This fixes "can't compare offset-naive and offset-aware datetimes"
        if token and token.expires_at > datetime.now(timezone.utc):
            return token
            
        return None

    def mark_used(self):
        self.used = True
        db.session.commit()