import os
import uuid
import requests  # Required for proxying
from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.document import Document
from src.models.user import User, Role, db
from src.models.leave import Leave
from datetime import datetime
import cloudinary
import cloudinary.uploader
import cloudinary.api

document_bp = Blueprint('document', __name__, url_prefix='/api/documents')

# ──────────────────────────────────────────────────────────────
# CLOUDINARY CONFIGURATION
# ──────────────────────────────────────────────────────────────
cloudinary.config( 
  cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'), 
  api_key = os.getenv('CLOUDINARY_API_KEY'), 
  api_secret = os.getenv('CLOUDINARY_API_SECRET'),
  secure = True
)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ──────────────────────────────────────────────────────────────
# Upload Document (Same as before)
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

        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            file, 
            resource_type = "auto", 
            folder = "hrms_documents"
        )
        
        file_url = upload_result.get('secure_url')
        public_id = upload_result.get('public_id')

        document = Document(
            filename=public_id,
            original_name=file.filename,
            file_path=file_url,
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
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

# ──────────────────────────────────────────────────────────────
# Download Document (FIX: PROXY MODE)
# ──────────────────────────────────────────────────────────────
@document_bp.route('/download/<int:doc_id>', methods=['GET'])
@jwt_required()
def download_document(doc_id):
    try:
        user_id = get_jwt_identity()
        doc = Document.query.get_or_404(doc_id)
        
        # Check Permissions
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

        # ✅ MAGIC FIX: Backend fetches file from Cloudinary and streams to Frontend
        # Frontend sees a regular file download from YOUR server, not Cloudinary
        
        # 1. Fetch file stream from Cloudinary
        cloudinary_res = requests.get(doc.file_path, stream=True)
        
        if cloudinary_res.status_code != 200:
            return jsonify({"error": "Could not fetch file from cloud"}), 502

        # 2. Stream it back to user
        headers = {
            'Content-Disposition': f'attachment; filename="{doc.original_name}"',
            'Content-Type': cloudinary_res.headers.get('Content-Type', 'application/octet-stream'),
            'Content-Length': cloudinary_res.headers.get('Content-Length')
        }

        return Response(
            stream_with_context(cloudinary_res.iter_content(chunk_size=8192)),
            headers=headers,
            status=200
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
