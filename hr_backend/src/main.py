import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger

# ----------------------------------------------------------------------
# 1. Import db & models
# ----------------------------------------------------------------------
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave
from src.models.audit_log import AuditLog

# ----------------------------------------------------------------------
# 2. Safe blueprint imports
# ----------------------------------------------------------------------
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.role import role_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp
from src.routes.calendar import calendar_bp
from src.routes.audit_log import audit_log_bp  # ← ADDED

# Optional: Import logger for future use
try:
    from src.utils.audit_logger import log_audit_event
except Exception as e:
    print(f"WARNING: audit_logger not available: {e}")
    log_audit_event = None

# Try to import task_bp – if broken, skip
task_bp = None
try:
    from src.routes.task import task_bp
except Exception as e:
    print(f"WARNING: Could not load task routes: {e}")
    print("   → /api/tasks endpoints are DISABLED until task.py is fixed.")
    task_bp = None


# ----------------------------------------------------------------------
# 3. Flask app
# ----------------------------------------------------------------------
app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(__file__), 'static'))

app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


# ----------------------------------------------------------------------
# 4. Extensions
# ----------------------------------------------------------------------
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app, supports_credentials=True)  # ← Important for JWT + frontend
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)


# ----------------------------------------------------------------------
# 5. Swagger
# ----------------------------------------------------------------------
app.config['SWAGGER'] = {'title': 'HRMS API Documentation', 'uiversion': 3}
swagger_template = {
    "info": {
        "title": "HRMS API Documentation",
        "description": "Human Resource Management System",
        "version": "1.0.0",
        "contact": {"name": "HRMS Dev Team", "email": "support@hrms.com"},
    },
    "basePath": "/api",
    "schemes": ["http", "https"],
}
Swagger(app, template=swagger_template)


# ----------------------------------------------------------------------
# 6. Register blueprints AT STARTUP
# ----------------------------------------------------------------------
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(calendar_bp, url_prefix='/api')
app.register_blueprint(audit_log_bp, url_prefix='/api')  # ← ADDED

if task_bp:
    app.register_blueprint(task_bp, url_prefix='/api')
else:
    print("Task routes SKIPPED due to import error.")


# ----------------------------------------------------------------------
# 7. Safe audit_log table creation
# ----------------------------------------------------------------------
with app.app_context():
    inspector = db.inspect(db.engine)
    if 'audit_logs' not in inspector.get_table_names():  # ← Fixed table name
        print("Creating missing audit_logs table …")
        db.create_table(AuditLog.__table__)
        print("audit_logs table created!")
    else:
        print("audit_logs table already exists.")


# ----------------------------------------------------------------------
# 8. Routes
# ----------------------------------------------------------------------
@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({"message": "Hello, Swagger is working!"})


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static = app.static_folder
    if static is None:
        return "Static folder not configured", 404
    if path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    index = os.path.join(static, 'index.html')
    if os.path.exists(index):
        return send_from_directory(static, 'index.html')
    return "index.html not found", 404


# ----------------------------------------------------------------------
# 9. Run
# ----------------------------------------------------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)