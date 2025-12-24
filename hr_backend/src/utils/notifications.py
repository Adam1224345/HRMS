from src.models.notification import Notification
from src.models.user import User
from flask_mail import Message
from threading import Thread
from datetime import datetime

# Global variables to hold app extensions
_socketio = None
_mail = None
_app = None

def setup_notifications(socketio, mail, app):
    """
    Initialize the notification system with the main app instance.
    """
    global _socketio, _mail, _app
    _socketio = socketio
    _mail = mail
    _app = app

def send_email_async(msg):
    """
    Sends email in a background thread to prevent the UI from freezing.
    """
    with _app.app_context():
        try:
            _mail.send(msg)
            print(f"✅ EMAIL SENT successfully to: {msg.recipients}")
        except Exception as e:
            # Log the error but don't crash the server
            print(f"⚠️ EMAIL FAILURE: {e}")

def send_notification(recipient_id, message, type="info", related_id=None, sender_id=None, send_email=True):
    """
    1. Saves notification to Database.
    2. Sends real-time alert via Socket.IO.
    3. Sends a PROFESSIONAL HTML Email (if valid).
    """
    global _socketio, _mail, _app

    if not all([_socketio, _mail, _app]):
        raise RuntimeError("Notifications not initialized. Call setup_notifications() first.")

    # -------------------- 1. DATABASE ENTRY --------------------
    notification = Notification.create_notification(
        recipient_id=recipient_id,
        sender_id=sender_id,
        message=message,
        type=type,
        related_id=related_id
    )

    # -------------------- 2. REAL-TIME SOCKET ALERT --------------------
    try:
        _socketio.emit('new_notification', notification.to_dict(), room=str(recipient_id))
    except Exception as e:
        print(f"Socket Error (Non-critical): {e}")

    # -------------------- 3. PROFESSIONAL EMAIL LOGIC --------------------
    if send_email:
        user = User.query.get(recipient_id)
        
        # --- A. Validation Check ---
        if not user or not user.email:
            return notification

        email = user.email.lower().strip()

        # --- B. Smart Blocker (Prevent "Delivery Incomplete" Errors) ---
        # Any email ending in these domains will be IGNORED silently.
        blocked_domains = ['hrms.com', 'example.com', 'test.com', 'localhost', 'fake.com', 'mydomain.com']
        
        try:
            domain = email.split('@')[1]
            if domain in blocked_domains:
                print(f"⛔ BLOCKED: Not sending email to fake domain '{domain}'")
                return notification
        except IndexError:
            return notification

        # --- C. Configuration ---
        # Get the sender address from main.py config
        sender_email = _app.config.get('MAIL_USERNAME', 'System')
        # Update this URL to your actual frontend URL
        app_url = "http://localhost:5173" 

        # --- D. PROFESSIONAL HTML TEMPLATE (Indigo Theme) ---
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .button:hover {{ background-color: #4338ca !important; }}
            </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                            
                            <tr>
                                <td bgcolor="#4f46e5" style="padding: 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">HRMS</h1>
                                    <p style="color: #e0e7ff; margin: 5px 0 0; font-size: 14px; font-weight: 500;">OFFICIAL NOTIFICATION</p>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 40px 30px;">
                                    
                                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                                        Hello <strong>{user.username}</strong>,
                                    </p>

                                    <div style="background-color: #eff6ff; border-left: 5px solid #3b82f6; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                                        <p style="margin: 0; color: #1e3a8a; font-size: 16px; line-height: 1.6;">
                                            {message}
                                        </p>
                                    </div>

                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <a href="{app_url}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                                    Open Dashboard
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
                                        Notification ID: #{notification.id} • {datetime.now().strftime('%b %d, %Y - %I:%M %p')}
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td bgcolor="#1f2937" style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                                    <p style="margin: 0;">&copy; 2025 HRMS System • All rights reserved</p>
                                    <p style="margin: 5px 0 0;">System email sent via {sender_email}</p>
                                </td>
                            </tr>
                        </table>
                        
                        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px;">
                            This is an automated message. Please do not reply.
                        </p>
                    </td>
                </tr>
            </table>

        </body>
        </html>
        """
        
        # --- E. Send Async ---
        msg = Message(
            subject=f"HRMS Alert: {type.title()}",
            recipients=[email],
            html=html
        )
        
        Thread(target=send_email_async, args=(msg,)).start()

    return notification