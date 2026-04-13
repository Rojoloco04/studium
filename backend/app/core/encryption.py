import base64
from cryptography.fernet import Fernet
from app.core.config import get_settings


def _get_fernet() -> Fernet:
    key = get_settings().canvas_token_encryption_key
    return Fernet(key.encode())


def encrypt_token(token: str) -> str:
    f = _get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    f = _get_fernet()
    return f.decrypt(encrypted.encode()).decode()
