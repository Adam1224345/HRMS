import os
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
from src.models.user import db, bcrypt
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.user import user_bp
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp

# ----------------------------
# Flask app setup
# ----------------------------
app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), 'static'),
    static_url_path='/static'
)

# ----------------------------
# Hardcoded configuration (No .env)
# ----------------------------
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'

# PostgreSQL database URI (Neon example)
app.config['SQLALCHEMY_DATABASE_URI'] = (
    'postgresql://neondb_owner:npg_dP1BrV2uSIbD@'
    'ep-divine-bird-addhz4kv-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ----------------------------
# Extensions
# ----------------------------
jwt = JWTManager(app)
bcrypt.init_app(app)
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)

# ----------------------------
# Enable CORS for all /api/* routes
# ----------------------------
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ----------------------------
# Swagger setup
# ----------------------------
swagger_template = {
    "info": {
        "title": "HRMS API Documentation",
        "description": "Swagger UI for HRMS backend",
        "version": "1.0.0",
        "contact": {"name": "HRMS Dev Team", "email": "support@hrms.com"},
    },
    "schemes": ["https"],  # Force HTTPS
    "basePath": "/api"
}
Swagger(app, template=swagger_template, config={"specs_route": "/api/docs/"})

# ----------------------------
# Register blueprints
# ----------------------------
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')

# ----------------------------
# Test endpoint
# ----------------------------
@app.route('/api/hello', methods=['GET'])
def hello_world():
    from src.models.user import Role
    try:
        role_count = Role.query.count()
    except Exception:
        role_count = "Database not initialized"
    return jsonify({"message": f"Hello, Swagger is working! Roles: {role_count}"})

# ----------------------------
# Serve frontend
# ----------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if path and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    elif os.path.exists(os.path.join(static_folder_path, 'index.html')):
        return send_from_directory(static_folder_path, 'index.html')
    else:
        return "index.html not found", 404

# ----------------------------
# Run locally only
# ----------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
