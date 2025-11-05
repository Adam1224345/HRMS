# main.py
import os
import sys
import traceback
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger

# MODELS
from src.models.user import db, bcrypt, User, Role
from src.models.task import Task
from src.models.leave import Leave

# BLUEPRINTS
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.role import role_bp
from src.routes.task import task_bp
from src.routes.leave import leave_bp
from src.routes.analytics import analytics_bp
from src.routes.calendar import calendar_bp

# FLASK APP
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# CONFIG
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string-change-in-production'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# DATABASE: NEON POSTGRESQL (HARDCODED — NO ENV)
app.config['SQLALCHEMY_DATABASE_URI'] = \
    'postgresql://neondb_owner:npg_dP1BrV2uSIbD@ep-divine-bird-addhz4kv-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# EXTENSIONS
jwt = JWTManager(app)
bcrypt.init_app(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})
db.init_app(app)
jwt.token_in_blocklist, check_if_token_revoked)

# SWAGGER
Swagger(app, template={
    "info": {"title": "HRMS API", "version": "1.0.0"},
    "basePath": "/api",
    "schemes": ["https"]
})

# BLUEPRINTS
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(role_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(leave_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(calendar_bp, url_prefix='/api')

# CREATE TABLES
with app.app_context():
    try:
        db.create_all()
        print("Tables created")
    except Exception as e:
        print("Table creation failed:", e)
        traceback.print_exc()

# HEALTH CHECK
@app.route('/api/health')
def health():
    try:
        db.engine.execute("SELECT 1").scalar()
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# TEST
@app.route('/api/hello')
def hello():
    return jsonify({"message": "API is live"})

# SERVE FRONTEND
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static = app.static_folder
    if not static or not os.path.exists(static):
        return "Static folder missing", 500
    if path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    index_path = os.path.join(static, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(static, 'index.html')
    return "index.html not found", 404

# 500 HANDLER
@app.errorhandler(500)
def error(e):
    print("500:", e)
    traceback.print_exc()
    return jsonify({"error": "Server error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)
