import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from src.models.user import db, bcrypt
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'

# Initialize extensions
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app)

# JWT token blacklist checker
jwt.token_in_blocklist_loader(check_if_token_revoked)

# Register blueprints
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def init_database():
    """Initialize database with default roles and permissions"""
    from src.models.user import Role, Permission
    
    # Create default permissions
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
            permission = Permission(name=perm_name, description=perm_desc)
            db.session.add(permission)
    
    # Create default roles
    roles_data = [
        ('Admin', 'System administrator with full access'),
        ('HR', 'Human resources manager'),
        ('Employee', 'Regular employee'),
    ]
    
    for role_name, role_desc in roles_data:
        if not Role.query.filter_by(name=role_name).first():
            role = Role(name=role_name, description=role_desc)
            db.session.add(role)
    
    db.session.commit()
    
    # Assign permissions to roles
    admin_role = Role.query.filter_by(name='Admin').first()
    hr_role = Role.query.filter_by(name='HR').first()
    employee_role = Role.query.filter_by(name='Employee').first()
    
    if admin_role:
        # Admin gets all permissions
        all_permissions = Permission.query.all()
        admin_role.permissions = all_permissions
    
    if hr_role:
        # HR gets user, task, and leave management permissions
        hr_permissions = Permission.query.filter(
            Permission.name.in_(['user_read', 'user_write', 'role_read', 'task_read', 'task_write', 'task_delete', 'leave_read', 'leave_write', 'leave_approve'])
        ).all()
        hr_role.permissions = hr_permissions
    
    if employee_role:
        # Employee gets basic read permissions and can manage their own tasks/leaves
        employee_permissions = Permission.query.filter(
            Permission.name.in_(['user_read', 'task_read', 'leave_read', 'leave_write'])
        ).all()
        employee_role.permissions = employee_permissions
    
    db.session.commit()

with app.app_context():
    db.create_all()
    init_database()

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
    app.run(host='0.0.0.0', port=5000, debug=True)
