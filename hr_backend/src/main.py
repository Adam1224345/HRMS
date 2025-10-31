# src/main.py
import os
import sys

# === Fix path when file is in src/ ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger

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
# Vercel builds React to 'dist/', then we copy to 'static/' in build step
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

# === Blueprints ===
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

# === Serve Frontend from static/ (Vercel copies dist/ here) ===
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if not os.path.exists(STATIC_DIR):
        return "Static folder missing. Run 'npm run build' and ensure files are in static/.", 500
    
    file_path = os.path.join(STATIC_DIR, path) if path else None
    if path and os.path.exists(file_path):
        return send_from_directory(STATIC_DIR, path)
    
    index_path = os.path.join(STATIC_DIR, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(STATIC_DIR, 'index.html')
    
    return "index.html not found in static/", 404

# === VERCEL: Export app for serverless ===
application = app

# === LOCAL DEV: Run server ===
if __name__ == '__main__':
    # Ensure static folder has index.html
    if not os.path.exists(os.path.join(STATIC_DIR, 'index.html')):
        print("Warning: static/index.html not found. Run 'npm run build && cp -r dist/* static/'")
    app.run(host='0.0.0.0', port=5000, debug=True)
