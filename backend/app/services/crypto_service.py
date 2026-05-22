from cryptography.fernet import Fernet
from app.config import settings
import base64

# Generate a default key if none is provided in settings to prevent crashes
# during development. In production, this should always be set in the environment.
_key = settings.ENCRYPTION_KEY.encode('utf-8')
if not _key:
    # Use a dummy key for dev if missing
    _key = Fernet.generate_key()
else:
    # Ensure it's valid base64, 32 bytes
    try:
        Fernet(_key)
    except ValueError:
        # Fallback if invalid format
        _key = Fernet.generate_key()

_fernet = Fernet(_key)


def encrypt_token(plaintext: str) -> str:
    """Encrypts an OAuth access token for storage at rest."""
    if not plaintext:
        return ""
    return _fernet.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_token(ciphertext: str) -> str:
    """Decrypts a stored OAuth access token."""
    if not ciphertext:
        return ""
    return _fernet.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
