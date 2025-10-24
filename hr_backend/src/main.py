import os
import sys
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify, request
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
from src.models.user import db, bcrypt, User
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Basic Config
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'

# Use Neon PostgreSQL (serverless safe)
app.config['SQLALCHEMY_DATABASE_URI'] = (
    "postgresql://neondb_owner:npg_dP1BrV2uSIbD@"
    "ep-divine-bird-addhz4kv-pooler.c-2.us-east-1.aws.neon.tech/"
    "neondb?sslmode=require&channel_binding=require"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Init extensions
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app)
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)

# Swagger Config (No Authorize Button)
app.config['SWAGGER'] = {'title': 'HRMS API Documentation', 'uiversion': 3}
swagger_template = {
    "info": {
        "title": "HRMS API Documentation",
        "description": "Swagger UI for HRMS backend",
        "version": "1.0.0",
        "contact": {"name": "HRMS Dev Team", "email": "support@hrms.com"},
    },
    "securityDefinitions": {},  # remove auth popup
    "basePath": "/api",
}
swagger = Swagger(app, template=swagger_template)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')

# DB Initialization
def init_database():
    from src.models.user import Role, Permission

    # Permissions
    permissions_data = [
        ('user_read','Read user information'), ('user_write','Create and update users'), ('user_delete','Delete users'),
        ('role_read','Read role information'), ('role_write','Create and update roles'), ('role_delete','Delete roles'),
        ('permission_read','Read permission information'), ('permission_write','Create and update permissions'), ('permission_delete','Delete permissions'),
        ('task_read','Read task information'), ('task_write','Create and update tasks'), ('task_delete','Delete tasks'),
        ('leave_read','Read leave requests'), ('leave_write','Create and update leave requests'), ('leave_delete','Delete leave requests'),
        ('leave_approve','Approve or reject leave requests'),
    ]
    for name, desc in permissions_data:
        if not Permission.query.filter_by(name=name).first():
            db.session.add(Permission(name=name, description=desc))

    # Roles
    roles_data = [
        ('Admin','System administrator with full access'),
        ('HR','Human resources manager'),
        ('Employee','Regular employee'),
    ]
    for name, desc in roles_data:
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=desc))

    db.session.commit()

    # Assign permissions to roles
    admin = Role.query.filter_by(name='Admin').first()
    hr = Role.query.filter_by(name='HR').first()
    emp = Role.query.filter_by(name='Employee').first()
    if admin:
        admin.permissions = Permission.query.all()
    if hr:
        hr.permissions = Permission.query.filter(Permission.name.in_([
            'user_read','user_write','role_read','task_read','task_write','task_delete',
            'leave_read','leave_write','leave_approve'
        ])).all()
    if emp:
        emp.permissions = Permission.query.filter(Permission.name.in_([
            'user_read','task_read','leave_read','leave_write'
        ])).all()
    db.session.commit()

# Ensure default admin exists
def ensure_admin_user():
    if not User.query.filter_by(username='admin').first():
        admin_user = User(
            username='admin',
            email='admin@hrms.com',
            password=bcrypt.generate_password_hash('admin1123').decode('utf-8'),
            first_name='System',
            last_name='Administrator',
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(admin_user)
        db.session.commit()

# Create tables and initialize
with app.app_context():
    db.create_all()
    init_database()
    ensure_admin_user()

# Test endpoint
@app.route('/api/hello', methods=['GET'])
def hello_world():
    """
    Test Hello Endpoint
    ---
    tags:
      - Test
    responses:
      200:
        description: Returns a simple test message
        examples:
          application/json: {"message": "Hello, Swagger is working!"}
    """
    return jsonify({"message": "Hello, Swagger is working!"})

# Serve frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    index_path = os.path.join(static_folder_path, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(static_folder_path, 'index.html')
    return "index.html not found", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
