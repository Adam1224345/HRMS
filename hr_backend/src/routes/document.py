# src/routes/document.py

import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.document import Document
from src.models.user import User, Role, db
from src.models.leave import Leave
from datetime import datetime

document_bp = Blueprint('document', __name__, url_prefix='/api/documents')

# ──────────────────────────────────────────────────────────────
# Smart Upload Folder - Works on Local AND Vercel
# ──────────────────────────────────────────────────────────────
current_dir = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(current_dir, '..', '..'))

# Use /tmp on Vercel (writable), use project folder on local
if os.getenv('VERCEL') or os.getenv('SERVERLESS'):  # Vercel or similar serverless
    UPLOAD_FOLDER = '/tmp/uploads/documents'
    print("RUNNING ON SERVERLESS (Vercel) - Using /tmp for uploads")
else:
    UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'documents')
    print(f"RUNNING LOCALLY - Using {UPLOAD_FOLDER}")

# Create folder (safe)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ──────────────────────────────────────────────────────────────
# Upload Document
# ──────────────────────────────────────────────────────────────
@document_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_document():
    try:
        user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        purpose = request.form.get('purpose', 'general')
        leave_id = request.form.get('leave_id')

        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400

        ext = file.filename.rsplit('.', 1)[1].lower()
        secure_filename = f"{uuid.uuid4().hex}_{user_id}_{int(datetime.utcnow().timestamp())}.{ext}"
        
        # On Vercel: files in /tmp disappear after request → we skip saving
        if os.getenv('VERCEL') or os.getenv('SERVERLESS'):
            print("SERVERLESS MODE: Skipping file save (read-only FS). Saving metadata only.")
            file_path = f"/tmp/{secure_filename}"  # fake path for DB
        else:
            file_path = os.path.join(UPLOAD_FOLDER, secure_filename)
            file.save(file_path)
            print(f"File saved locally: {file_path}")

        # Always save metadata to DB
        document = Document(
            filename=secure_filename,
            original_name=file.filename,
            file_path=file_path,
            file_type=file.content_type,
            purpose=purpose,
            uploaded_by=user_id,
            leave_id=leave_id if leave_id else None
        )
        db.session.add(document)
        db.session.commit()

        return jsonify({
            "message": "Document uploaded successfully",
            "document": document.to_dict()
        }), 201

    except Exception as e:
        print(f"ERROR Uploading: {e}")
        db.session.rollback()
        return jsonify({"error": "Server error during upload"}), 500

# ──────────────────────────────────────────────────────────────
# Download Document - Works on local, returns message on Vercel
# ──────────────────────────────────────────────────────────────
@document_bp.route('/download/<int:doc_id>', methods=['GET'])
@jwt_required()
def download_document(doc_id):
    try:
        user_id = get_jwt_identity()
        doc = Document.query.get_or_404(doc_id)
        
        current_user = User.query.options(db.joinedload(User.roles)).get(user_id)
        is_admin_hr = any(r.name in ['Admin', 'HR'] for r in current_user.roles)
        is_uploader = (doc.uploaded_by == int(user_id))
        is_leave_owner = False
        
        if doc.leave_id:
            leave = Leave.query.get(doc.leave_id)
            if leave and leave.user_id == int(user_id):
                is_leave_owner = True

        if not (is_uploader or is_admin_hr or is_leave_owner):
            return jsonify({"error": "Unauthorized"}), 403

        # On Vercel: file not persisted
        if os.getenv('VERCEL') or os.getenv('SERVERLESS'):
            return jsonify({
                "message": "File download not available on Vercel (serverless)",
                "original_name": doc.original_name,
                "note": "Use cloud storage (S3/Cloudinary) for production file persistence"
            }), 200

        if not os.path.exists(doc.file_path):
            return jsonify({"error": "File not found on server"}), 404
        
        return send_from_directory(
            os.path.dirname(doc.file_path),
            os.path.basename(doc.file_path),
            as_attachment=True,
            download_name=doc.original_name
        )

    except Exception as e:
        print(f"ERROR Downloading: {e}")
        return jsonify({"error": str(e)}), 500

# ──────────────────────────────────────────────────────────────
# Get Documents for a Leave
# ──────────────────────────────────────────────────────────────
@document_bp.route('/leave/<int:leave_id>', methods=['GET'])
@jwt_required()
def get_leave_documents(leave_id):
    user_id = get_jwt_identity()
    current_user = User.query.options(db.joinedload(User.roles)).get(user_id)
    leave = Leave.query.get_or_404(leave_id)
    
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in current_user.roles)
    is_owner = (leave.user_id == int(user_id))

    if not (is_admin_hr or is_owner):
        return jsonify({"error": "Unauthorized"}), 403

    docs = Document.query.filter_by(leave_id=leave_id).order_by(Document.uploaded_at.desc()).all()
    return jsonify([d.to_dict() for d in docs])