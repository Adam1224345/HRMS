import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwtsecretkey")
    JWT_ACCESS_TOKEN_EXPIRES = 900        # 15 mins
    JWT_REFRESH_TOKEN_EXPIRES = 2592000   # 30 days

    # Neon PostgreSQL Config
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Rate limiting (Flask-Limiter)
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_STORAGE_URL = os.getenv("REDIS_URL", "memory://")

config = Config()
