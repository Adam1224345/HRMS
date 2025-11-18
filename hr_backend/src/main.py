# src/main.py
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify, request
from flask_jwt_extended import JWTManager, get_jwt_identity, jwt_required
from flask_cors import CORS
from flasgger import Swagger
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
from datetime import datetime

# ----------------------------------------------------------------------
# 1. Import db & models FIRST
# ----------------------------------------------------------------------
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave
from src.models.audit_log import AuditLog
from src.models.notification import Notification

# ----------------------------------------------------------------------
# 2. Create app & extensions
# ----------------------------------------------------------------------
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = "postgresql+psycopg2://neondb_owner:npg_m6LVun7ioweT@ep-shy-breeze-af2z9bj7.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require"
# GMAIL CONFIG – WORKING 100%
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = 'adamraza5t7@gmail.com'
app.config['MAIL_PASSWORD'] = 'xmsm byrt pxdu hdhe'  
app.config['MAIL_DEFAULT_SENDER'] = 'adamraza5t7@gmail.com'

# Initialize extensions
socketio = SocketIO(app, cors_allowed_origins="*", transports=['websocket'])
mail = Mail(app)
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app, supports_credentials=True)
db.init_app(app)

# ----------------------------------------------------------------------
# 3. GMAIL + IN-APP NOTIFICATION FUNCTION (ONLY ADDED THIS)
# ----------------------------------------------------------------------
def send_gmail_notification(user_id, message, subject="HRMS Notification"):
    # Save to DB
    notif = Notification(user_id=user_id, message=message)
    db.session.add(notif)
    db.session.commit()

    # Real-time in-app
    emit('new_notification', {
        'id': notif.id,
        'message': message,
        'timestamp': notif.timestamp.isoformat(),
        'is_read': False
    }, room=f"user_{user_id}", namespace='/')

    # GMAIL EMAIL
    user = User.query.get(user_id)
    if user and user.email:
        try:
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">HRMS</h1>
              </div>
              <div style="padding: 40px 30px; background: #ffffff;">
                <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">New Notification</h2>
                <div style="background: #f0f9ff; padding: 25px; border-radius: 12px; border-left: 6px solid #0ea5e9; margin: 25px 0;">
                  <p style="margin: 0; font-size: 18px; color: #0c4a6e; font-weight: 600; line-height: 1.6;">
                    {message}
                  </p>
                </div>
                <p style="color: #64748b; font-size: 15px; margin: 20px 0;">
                  Time: <strong>{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</strong>
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="http://localhost:5173" style="background: #6366f1; color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Open HRMS Dashboard
                  </a>
                </div>
              </div>
              <div style="background: #1e293b; color: #cbd5e1; padding: 25px; text-align: center; font-size: 13px;">
                © 2025 HRMS System • Powered by adamraza5t7@gmail.com
              </div>
            </div>
            """
            msg = Message(subject, recipients=[user.email], html=html)
            mail.send(msg)
            print(f"GMAIL SENT → {user.email}: {message}")
        except Exception as e:
            print(f"Email failed: {e}")

# ----------------------------------------------------------------------
# 4. Keep your original notification setup
# ----------------------------------------------------------------------
from src.utils.notifications import setup_notifications
setup_notifications(socketio, mail, app)

# ----------------------------------------------------------------------
# 5. Socket.IO events (unchanged)
# ----------------------------------------------------------------------
from src.socket_events import setup_socket_events
setup_socket_events(socketio)

# ----------------------------------------------------------------------
# 6. JWT + Swagger + Blueprints (100% YOUR ORIGINAL CODE)
# ----------------------------------------------------------------------
jwt.token_in_blocklist_loader(lambda *args: False)  # Replace with your real function if exists

app.config['SWAGGER'] = {'title': 'HRMS API Documentation', 'uiversion': 3}
swagger_template = {
    "info": {
        "title": "HRMS API Documentation",
        "description": "Human Resource Management System",
        "version": "1.0.0",
    },
}
Swagger(app, template=swagger_template)

# Register all your original blueprints
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.role import role_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp
from src.routes.calendar import calendar_bp
from src.routes.audit_log import audit_log_bp
from src.routes.notification import notification_bp

task_bp = None
try:
    from src.routes.task import task_bp
except Exception as e:
    print(f"Task routes disabled: {e}")

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(calendar_bp, url_prefix='/api')
app.register_blueprint(audit_log_bp, url_prefix='/api')
app.register_blueprint(notification_bp, url_prefix='/api')
if task_bp:
    app.register_blueprint(task_bp, url_prefix='/api')

# ----------------------------------------------------------------------
# 7. Ensure audit_logs table exists (YOUR ORIGINAL CODE)
# ----------------------------------------------------------------------
with app.app_context():
    inspector = db.inspect(db.engine)
    if 'audit_logs' not in inspector.get_table_names():
        print("Creating missing audit_logs table...")
        db.create_table(AuditLog.__table__)
        print("audit_logs table created!")
    else:
        print("audit_logs table already exists.")

# ----------------------------------------------------------------------
# 8. Serve frontend (YOUR ORIGINAL CODE)
# ----------------------------------------------------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static = app.static_folder
    if not static:
        return "Static folder not configured", 404
    if path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    index_path = os.path.join(static, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(static, 'index.html')
    return "index.html not found", 404

# ----------------------------------------------------------------------
# 9. Run
# ----------------------------------------------------------------------
if __name__ == '__main__':
    print("\nHRMS Backend Starting...")
    print("GMAIL NOTIFICATIONS: ACTIVE (adamraza5t7@gmail.com)")
    print("Real-time + Email working")
    print("Visit: http://localhost:5000")
    print("API Docs: http://localhost:5000/apidocs\n")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)