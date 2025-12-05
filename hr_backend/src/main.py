import os
import sys

# -------------------- 0. Path Configuration --------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, send_from_directory
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
from flask_socketio import SocketIO
from flask_mail import Mail

# -------------------- 1. Import db & Models --------------------
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave
from src.models.audit_log import AuditLog
from src.models.notification import Notification
from src.models.document import Document 

# -------------------- 2. Create app & Config --------------------
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'

# --- DATABASE CONFIGURATION (NEON POSTGRESQL) ---
app.config['SQLALCHEMY_DATABASE_URI'] = (
    "postgresql://neondb_owner:npg_x8KPZuq3opyk@"
    "ep-muddy-darkness-a16txpfz-pooler.ap-southeast-1.aws.neon.tech/neondb"
    "?sslmode=require&channel_binding=require"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- GMAIL CONFIGURATION ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = 'adamtestapps71@gmail.com'
app.config['MAIL_PASSWORD'] = 'uhoj tldf oekh tlby' 
app.config['MAIL_DEFAULT_SENDER'] = ('HRMS Admin', 'adamtestapps71@gmail.com')

# -------------------- 3. Initialize extensions --------------------
socketio = SocketIO(app, cors_allowed_origins="*", transports=['websocket'])
mail = Mail(app)
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app, supports_credentials=True)
db.init_app(app)

from src.utils.notifications import setup_notifications
setup_notifications(socketio, mail, app)

# -------------------- 5. Socket.IO events --------------------
from src.socket_events import setup_socket_events
setup_socket_events(socketio)

# -------------------- 6. JWT + Swagger --------------------
jwt.token_in_blocklist_loader(lambda *args: False)
app.config['SWAGGER'] = {'title': 'HRMS API Documentation', 'uiversion': 3}
Swagger(app)

# -------------------- 7. Register Blueprints --------------------
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.role import role_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp
from src.routes.calendar import calendar_bp
from src.routes.audit_log import audit_log_bp
from src.routes.notification import notification_bp
from src.routes.document import document_bp  

task_bp = None
try:
    from src.routes.task import task_bp
except Exception:
    pass

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(calendar_bp, url_prefix='/api')
app.register_blueprint(audit_log_bp, url_prefix='/api')
app.register_blueprint(notification_bp, url_prefix='/api')
app.register_blueprint(document_bp)

if task_bp:
    app.register_blueprint(task_bp, url_prefix='/api')

# -------------------- 9. Serve frontend --------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static = app.static_folder
    if path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    if os.path.exists(os.path.join(static, 'index.html')):
        return send_from_directory(static, 'index.html')
    return "index.html not found", 404

# -------------------- 10. Run Server --------------------
if __name__ == '__main__':
    print("\nHRMS Backend Starting...")
    print("Database: NEON DB (PostgreSQL)")
    print("Gmail Config: LOADED")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)