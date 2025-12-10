
import pytest
from src.models.user import User

def test_user_password_hashing():
    user = User(email="a@test.com")
    user.set_password("12345")
    assert user.check_password("12345") is True
