import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.document import Document
from src.models.user import User, Role, db
from src.models.leave import Leave
from src.utils.audit_logger import log_audit_event
from src.utils.notifications import send_notification
from datetime import datetime

document_bp = Blueprint('document', __name__, url_prefix='/api/documents')

# ──────────────────────────────────────────────────────────────
# Config: ABSOLUTE PATHS (Fixes Windows Issues)
# ──────────────────────────────────────────────────────────────
# 1. Get the directory of THIS file (src/routes)
current_dir = os.path.dirname(os.path.abspath(__file__))

# 2. Go up two levels to root, then into uploads/documents
UPLOAD_FOLDER = os.path.abspath(os.path.join(current_dir, '../../uploads/documents'))

print(f"DEBUG: Document Storage Path: {UPLOAD_FOLDER}")

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

        # Secure filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        secure_filename = f"{uuid.uuid4().hex}_{user_id}_{int(datetime.utcnow().timestamp())}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, secure_filename)
        
        print(f"DEBUG: Saving file to: {filepath}")
        file.save(filepath)

        # Create document record
        document = Document(
            filename=secure_filename,
            original_name=file.filename,
            file_path=filepath,
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
        return jsonify({"error": "Server error during upload"}), 500


# ──────────────────────────────────────────────────────────────
# Download Document (WITH DEBUGGING)
# ──────────────────────────────────────────────────────────────
@document_bp.route('/download/<int:doc_id>', methods=['GET'])
@jwt_required()
def download_document(doc_id):
    try:
        user_id = get_jwt_identity()
        print(f"DEBUG: Download Request for Doc ID: {doc_id} by User ID: {user_id}")

        doc = Document.query.get_or_404(doc_id)
        
        try:
            user_id = int(user_id)
        except:
            pass

        current_user = User.query.options(db.joinedload(User.roles)).get(user_id)
        is_admin_hr = any(r.name in ['Admin', 'HR'] for r in current_user.roles)

        # Check ownership logic
        is_leave_owner = False
        if doc.leave_id:
            leave = Leave.query.get(doc.leave_id)
            if leave and leave.user_id == user_id:
                is_leave_owner = True
        
        is_uploader = (doc.uploaded_by == user_id)

        print(f"DEBUG: Perms - Admin/HR: {is_admin_hr}, Uploader: {is_uploader}, LeaveOwner: {is_leave_owner}")

        if not (is_uploader or is_admin_hr or is_leave_owner):
            print("DEBUG: Authorization Failed")
            return jsonify({"error": "Unauthorized"}), 403

        # Check if file exists physically
        full_path = os.path.join(UPLOAD_FOLDER, doc.filename)
        if not os.path.exists(full_path):
            print(f"DEBUG: File NOT FOUND at {full_path}")
            return jsonify({"error": "File not found on server"}), 404

        print(f"DEBUG: Sending file from {UPLOAD_FOLDER} : {doc.filename}")
        
        return send_from_directory(
            UPLOAD_FOLDER,
            doc.filename,
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
    try:
        user_id = int(user_id)
    except:
        pass
        
    current_user = User.query.options(db.joinedload(User.roles)).get(user_id)
    leave = Leave.query.get_or_404(leave_id)
    
    is_admin_hr = any(r.name in ['Admin', 'HR'] for r in current_user.roles)
    is_owner = (leave.user_id == user_id)

    if not (is_admin_hr or is_owner):
        return jsonify({"error": "Unauthorized"}), 403

    docs = Document.query.filter_by(leave_id=leave_id).order_by(Document.uploaded_at.desc()).all()

    return jsonify([d.to_dict() for d in docs])
