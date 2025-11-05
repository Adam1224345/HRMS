# main.py
import os
import sys
import traceback  # NEW: For full error traces
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger

# Models
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave

# Blueprints
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp
from src.routes.calendar import calendar_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# === CONFIG ===
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# === DATABASE: NEON POSTGRESQL ONLY ===
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required! Set it in Vercel Environment Variables: postgresql://neondb_owner:npg_dP1BrV2uSIbD@ep-divine-bird-addhz4kv-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")

# Fix URI (ensure postgresql://)
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL

# Test DB connection on startup (NEW: Catches errors early)
try:
    with app.app_context():
        db.engine.execute("SELECT 1")  # Simple ping
        print("✅ Database connected successfully!")
except Exception as e:
    print(f"❌ Database connection failed: {str(e)}")
    traceback.print_exc()  # Full trace in logs

# === EXTENSIONS ===
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app)
db.init_app(app)
jwt.token_in_blocklist_loader(check_if_token_revoked)

# === SWAGGER ===
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

# === BLUEPRINTS ===
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(calendar_bp, url_prefix='/api')

# === CREATE TABLES ===
with app.app_context():
    try:
        db.create_all()
        print("✅ Tables created.")
    except Exception as e:
        print(f"❌ Table creation failed: {str(e)}")
        traceback.print_exc()

# === HEALTH CHECK ENDPOINT (NEW: Test in browser) ===
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        with app.app_context():
            result = db.engine.execute("SELECT 1").scalar()
            return jsonify({"status": "healthy", "db_ping": result}), 200
    except Exception as e:
        print(f"Health check failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# === TEST ENDPOINT ===
@app.route('/api/hello', methods=['GET'])
def hello_world():
    return jsonify({"message": "Hello, Swagger is working!"})

# === SERVE FRONTEND ===
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

# === GLOBAL ERROR HANDLER (NEW: Catches 500s) ===
@app.errorhandler(500)
def internal_error(error):
    print(f"500 Error: {str(error)}")
    traceback.print_exc()
    return jsonify({"error": "Internal Server Error", "details": str(error)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
