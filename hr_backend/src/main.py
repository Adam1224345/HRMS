import os
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger

# === Fix path for imports when in src/ ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# === Models ===
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave

# === Blueprints ===
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp

# === Flask App ===
STATIC_DIR = os.path.join(BASE_DIR, 'static')
app = Flask(__name__, static_folder=STATIC_DIR)

# === Config ===
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# === Extensions ===
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app)
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)

# === Swagger ===
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

# === Register Blueprints ===
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')

# === Create Tables ===
with app.app_context():
    db.create_all()
    print("Database tables created. Run 'python seed.py' to seed data.")

# === Test Endpoint ===
@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({"message": "Hello, Swagger is working!"})

# === Serve React Frontend ===
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if not os.path.exists(STATIC_DIR):
        return "Static folder not found", 500
    if path and os.path.exists(os.path.join(STATIC_DIR, path)):
        return send_from_directory(STATIC_DIR, path)
    index_path = os.path.join(STATIC_DIR, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(STATIC_DIR, 'index.html')
    return "index.html not found", 404

# === EXPORT FOR VERCEL (CRITICAL) ===
# Vercel looks for `application` in serverless functions
application = app

# === Run locally ===
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
