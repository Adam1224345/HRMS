
import os
from flask import Blueprint, jsonify, session, current_app

lang_bp = Blueprint('lang', __name__)

@lang_bp.route('/set_language/<lang_code>', methods=['POST'])
def set_language(lang_code):
    if lang_code in current_app.config['LANGUAGES']:
        session['lang'] = lang_code
        return jsonify({'message': f'Language set to {lang_code}'}), 200
    return jsonify({'message': 'Unsupported language'}), 400
