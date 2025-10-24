import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify, Response
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
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_TOKEN_LOCATION'] = ['headers']  # Ensure JWT in headers only
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600  # 1-hour token expiry
app.config['PROPAGATE_EXCEPTIONS'] = True  # Ensure errors are visible in Vercel logs

jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app, resources={r"/api/*": {"origins": ["*"], "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})  # Enhanced CORS
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)

app.config['SWAGGER'] = {
    'title': 'HRMS API Documentation',
    'uiversion': 3,
    'securityDefinitions': {
        'BearerAuth': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header',
            'description': 'Enter: Bearer <JWT_TOKEN>'
        }
    }
}

swagger_template = {
    "info": {
        "title": "HRMS API Documentation",
        "description": "This is the Swagger UI for the Human Resource Management System backend.",
        "version": "1.0.0",
        "contact": {
            "name": "HRMS Dev Team",
            "email": "support@hrms.com",
        },
    },
    "basePath": "/api",
    "schemes": ["https"],  # Force HTTPS for Vercel
    "security": [{"BearerAuth": []}]  # Require JWT for protected endpoints
}

swagger = Swagger(app, template=swagger_template)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')

def init_database():
    """Initialize database with default roles, permissions, and admin user"""
    from src.models.user import Role, Permission, User

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

    # Create default admin user for login
    if not User.query.filter_by(email='admin@hrms.com').first():
        admin_user = User(
            email='admin@hrms.com',
            password=bcrypt.generate_password_hash('admin123').decode('utf-8'),
            first_name='Admin',
            last_name='User',
            role_id=admin_role.id if admin_role else None
        )
        db.session.add(admin_user)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Database initialization failed: {str(e)}")  # Log error for Vercel

with app.app_context():
    try:
        db.create_all()
        init_database()
    except Exception as e:
        print(f"Failed to initialize database: {str(e)}")  # Log error for Vercel

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

@app.route('/api/apidocs', methods=['GET'])
def apidocs():
    """Serve Swagger UI"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
      <title>HRMS API Documentation</title>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
      <style>
        body { margin: 0; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '/api/swagger.json',
            dom_id: '#swagger-ui',
            presets: [
              SwaggerUIBundle.presets.apis,
            ],
            deepLinking: true,
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1
          });
          window.ui = ui;
        };
      </script>
    </body>
    </html>
    """
    return Response(html, mimetype='text/html')

@app.route('/api/swagger.json', methods=['GET', 'OPTIONS'])
def swagger_json():
    """Serve Swagger JSON spec"""
    if request.method == 'OPTIONS':
        return '', 200  # Handle CORS preflight
    try:
        from flasgger import utils
        spec = utils.get_spec(swagger.app)
        return jsonify(spec)
    except Exception as e:
        return jsonify({'error': f'Failed to generate Swagger spec: {str(e)}'}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return jsonify({'error': 'Static folder not configured'}), 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return jsonify({'error': 'index.html not found'}), 404
