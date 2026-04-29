from datetime import datetime, timedelta
from jose import jwt

# ======================
# JWT CONFIG (DEV)
# ======================

SECRET_KEY = "SUPER_SECRET_CHANGE_ME"  # move to env later
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day


# ======================
# TOKEN CREATION
# ======================

def create_access_token(subject: str) -> str:
    """
    Create a JWT access token.
    `subject` should be the user ID.
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": subject,
        "exp": expire,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
