import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
from src.models.user import db, bcrypt
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = (
    "postgresql://neondb_owner:npg_dP1BrV2uSIbD@"
    "ep-divine-bird-addhz4kv-pooler.c-2.us-east-1.aws.neon.tech/"
    "neondb?sslmode=require"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app, origins="*", supports_credentials=True)
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)

swagger_template = {
    "info": {
        "title": "HRMS API Documentation",
        "description": "Human Resource Management System backend Swagger UI.",
        "version": "1.0.0",
        "contact": {"name": "HRMS Dev Team", "email": "support@hrms.com"},
    },
    "schemes": ["https"]
}
swagger = Swagger(app, template=swagger_template)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')

def init_database():
    from src.models.user import Role, Permission

    permissions_data = [
        ('user_read', 'Read user information'),
        ('user_write', 'Create and update users'),
        ('user_delete', 'Delete users'),
        ('role_read', 'Read role information'),
        ('role_write', 'Create and update roles'),
        ('role_delete', 'Delete roles'),
        ('permission_read', 'Read permission information'),
        ('permission_write', 'Create and update permissions'),
        ('permission_delete', 'Delete permissions'),
        ('task_read', 'Read task information'),
        ('task_write', 'Create and update tasks'),
        ('task_delete', 'Delete tasks'),
        ('leave_read', 'Read leave requests'),
        ('leave_write', 'Create and update leave requests'),
        ('leave_delete', 'Delete leave requests'),
        ('leave_approve', 'Approve or reject leave requests'),
    ]

    for perm_name, perm_desc in permissions_data:
        if not Permission.query.filter_by(name=perm_name).first():
            db.session.add(Permission(name=perm_name, description=perm_desc))

    roles_data = [
        ('Admin', 'System administrator with full access'),
        ('HR', 'Human resources manager'),
        ('Employee', 'Regular employee'),
    ]

    for role_name, role_desc in roles_data:
        if not Role.query.filter_by(name=role_name).first():
            db.session.add(Role(name=role_name, description=role_desc))

    db.session.commit()

    admin_role = Role.query.filter_by(name='Admin').first()
    hr_role = Role.query.filter_by(name='HR').first()
    employee_role = Role.query.filter_by(name='Employee').first()

    if admin_role:
        admin_role.permissions = Permission.query.all()
    if hr_role:
        hr_role.permissions = Permission.query.filter(
            Permission.name.in_([
                'user_read', 'user_write', 'role_read',
                'task_read', 'task_write', 'task_delete',
                'leave_read', 'leave_write', 'leave_approve'
            ])
        ).all()
    if employee_role:
        employee_role.permissions = Permission.query.filter(
            Permission.name.in_(['user_read', 'task_read', 'leave_read', 'leave_write'])
        ).all()

    db.session.commit()

with app.app_context():
    db.create_all()
    init_database()

@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({"message": "Hello, Swagger is working!"})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)), debug=True)
