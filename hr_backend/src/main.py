import os
import sys
from dotenv import load_dotenv
from datetime import timedelta
from flask import Flask, send_from_directory
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
# This file is at: hr_backend/src/main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))     
PROJECT_ROOT = os.path.dirname(BASE_DIR)                  
STATIC_FOLDER = os.path.join(BASE_DIR, "static")          

load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# allow absolute imports (src.models, src.routes, etc.)
sys.path.insert(0, PROJECT_ROOT)

# ---------------------------------------------------
# FLASK APP
# ---------------------------------------------------
app = Flask(
    __name__,
    static_folder=STATIC_FOLDER,   # correct location of your React build
    static_url_path=""             # serve static files without /static prefix
)

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)

# Neon PostgreSQL
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Gmail Mail
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = (
    os.getenv("MAIL_DEFAULT_SENDER_NAME"),
    os.getenv("MAIL_DEFAULT_SENDER_EMAIL")
)

# ---------------------------------------------------
# RATE LIMITER
# ---------------------------------------------------
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# ---------------------------------------------------
# IMPORT MODELS
# ---------------------------------------------------
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave
from src.models.audit_log import AuditLog
from src.models.notification import Notification
from src.models.document import Document

# ---------------------------------------------------
# EXTENSIONS INIT
# ---------------------------------------------------
socketio = SocketIO(app, cors_allowed_origins="*")
mail = Mail(app)
bcrypt.init_app(app)
db.init_app(app)
CORS(app, supports_credentials=True)
limiter.init_app(app)
jwt = JWTManager(app)

@jwt.token_in_blocklist_loader
def check_blocklist(jwt_header, jwt_payload):
    return False   # no blocklist yet

# ---------------------------------------------------
# NOTIFICATIONS
# ---------------------------------------------------
from src.utils.notifications import setup_notifications
setup_notifications(socketio, mail, app)

# ---------------------------------------------------
# SOCKET EVENTS
# ---------------------------------------------------
from src.socket_events import setup_socket_events
setup_socket_events(socketio)

# ---------------------------------------------------
# BLUEPRINTS
# ---------------------------------------------------
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.role import role_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp
from src.routes.calendar import calendar_bp
from src.routes.audit_log import audit_log_bp
from src.routes.notification import notification_bp
from src.routes.document import document_bp

try:
    from src.routes.task import task_bp
except:
    task_bp = None

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(user_bp, url_prefix="/api")
app.register_blueprint(role_bp, url_prefix="/api")
app.register_blueprint(leave_bp, url_prefix="/api")
app.register_blueprint(analytics_bp, url_prefix="/api")
app.register_blueprint(calendar_bp, url_prefix="/api")
app.register_blueprint(audit_log_bp, url_prefix="/api")
app.register_blueprint(notification_bp, url_prefix="/api")
app.register_blueprint(document_bp, url_prefix="/api")

if task_bp:
    app.register_blueprint(task_bp, url_prefix="/api")

# ---------------------------------------------------
# SERVE REACT FRONTEND
# ---------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    file_path = os.path.join(STATIC_FOLDER, path)

    # Serve actual static files (assets, JS, CSS)
    if path and os.path.exists(file_path):
        return send_from_directory(STATIC_FOLDER, path)

    # Serve index.html for React SPA
    index_file = os.path.join(STATIC_FOLDER, "index.html")
    if os.path.exists(index_file):
        return send_from_directory(STATIC_FOLDER, "index.html")

    return "index.html not found", 404

# ---------------------------------------------------
# RUN SERVER
# ---------------------------------------------------
if __name__ == "__main__":
    print("────────────────────────────────────────────")
    print(" HRMS Backend Starting…")
    print(" Using Neon PostgreSQL")
    print(" Static Folder:", STATIC_FOLDER)
    print("────────────────────────────────────────────")

    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
