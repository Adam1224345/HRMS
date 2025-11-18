# src/utils/notifications.py
from src.models.notification import Notification
from src.models.user import User
from flask_mail import Message
from threading import Thread
from datetime import datetime

# We'll inject socketio, mail, app later via a setup function
_socketio = None
_mail = None
_app = None

def setup_notifications(socketio, mail, app):
    global _socketio, _mail, _app
    _socketio = socketio
    _mail = mail
    _app = app

def send_email_async(msg):
    with _app.app_context():
        _mail.send(msg)

def send_notification(recipient_id, message, type, related_id=None, sender_id=None, send_email=True):
    """
    Creates a DB notification + real-time + BEAUTIFUL GMAIL EMAIL
    """
    global _socketio, _mail, _app

    if not all([_socketio, _mail, _app]):
        raise RuntimeError("Notifications not initialized. Call setup_notifications() first.")

    # 1. Create DB Notification
    notification = Notification.create_notification(
        recipient_id=recipient_id,
        sender_id=sender_id,
        message=message,
        type=type,
        related_id=related_id
    )

    # 2. Emit Real-time (in-app bell)
    _socketio.emit('new_notification', notification.to_dict(), room=str(recipient_id))

    # 3. Send GMAIL EMAIL (BEAUTIFUL HTML + ASYNC)
    if send_email:
        user = User.query.get(recipient_id)
        if user and user.email:
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 35px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 1px;">HRMS</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0; font-size: 16px;">Human Resource Management System</p>
              </div>
              <div style="padding: 40px 35px;">
                <h2 style="color: #1e293b; margin-top: 0; font-size: 26px; text-align: center;">New Notification</h2>
                <div style="background: #f0f9ff; padding: 28px; border-radius: 14px; border-left: 7px solid #0ea5e9; margin: 30px 0; box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);">
                  <p style="margin: 0; font-size: 19px; color: #0c4a6e; font-weight: 600; line-height: 1.7;">
                    {message}
                  </p>
                </div>
                <div style="text-align: center; padding: 20px;">
                  <p style="color: #64748b; font-size: 16px; margin: 0;">
                    <strong>Time:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
                  </p>
                </div>
                <div style="text-align: center; margin: 35px 0;">
                  <a href="http://localhost:5173" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 18px 48px; text-decoration: none; border-radius: 14px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);">
                    Open HRMS Dashboard
                  </a>
                </div>
              </div>
              <div style="background: #1e293b; color: #cbd5e1; padding: 25px; text-align: center; font-size: 13px; border-top: 1px solid #334155;">
                <p style="margin: 8px 0;">
                  © 2025 HRMS System • All rights reserved
                </p>
                <p style="margin: 8px 0; color: #94a3b8;">
                  Powered by <strong>adamraza5t7@gmail.com</strong>
                </p>
              </div>
            </div>
            """
            msg = Message(
                subject="HRMS Notification",
                recipients=[user.email],
                html=html,
                sender="adamraza5t7@gmail.com"
            )
            Thread(target=send_email_async, args=(msg,)).start()
            print(f"GMAIL SENT → {user.email}: {message}")

    return notification