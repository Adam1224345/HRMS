from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.notification import Notification
from src.models.user import db, User

notification_bp = Blueprint('notification_bp', __name__)

@notification_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    notifs = Notification.query.filter_by(recipient_id=user_id)\
        .order_by(Notification.timestamp.desc()).all()
    return jsonify([n.to_dict() for n in notifs]), 200

@notification_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(notification_id):
    user_id = get_jwt_identity()
    notif = Notification.query.get_or_404(notification_id)
    if notif.recipient_id != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    notif.is_read = True
    db.session.commit()
    return jsonify(notif.to_dict()), 200

@notification_bp.route('/notifications/read-all', methods=['PUT'])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    Notification.query.filter_by(recipient_id=user_id)\
        .update({Notification.is_read: True})
    db.session.commit()
    return jsonify({"message": "All read"}), 200

@notification_bp.route('/notifications/all', methods=['GET'])
@jwt_required()
def get_all_notifications():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not any(role.name == 'Admin' for role in user.roles):
        return jsonify({"error": "Unauthorized"}), 403
    notifs = Notification.query.order_by(Notification.timestamp.desc()).all()
    return jsonify([n.to_dict() for n in notifs]), 200