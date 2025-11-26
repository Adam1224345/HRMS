from flask_socketio import SocketIO, join_room, leave_room
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask import current_app

def setup_socket_events(socketio: SocketIO):
    @socketio.on('connect')
    def handle_connect():
        current_app.logger.info('Client connected')

    @socketio.on('disconnect')
    def handle_disconnect():
        current_app.logger.info('Client disconnected')

    @socketio.on('join')
    def on_join(data):
        """
        Client sends their user ID after successful JWT authentication.
        This allows us to join a room specific to the user ID for private notifications.
        """
        user_id = data.get('user_id')
        if user_id:
            room = str(user_id)
            join_room(room)
            current_app.logger.info(f"User {user_id} joined room {room}")
        else:
            current_app.logger.warning("Join event received without user_id")

    @socketio.on('leave')
    def on_leave(data):
        user_id = data.get('user_id')
        if user_id:
            room = str(user_id)
            leave_room(room)
            current_app.logger.info(f"User {user_id} left room {room}")
