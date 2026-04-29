from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import uuid

from app.auth.security import SECRET_KEY, ALGORITHM

# Used only for OpenAPI docs
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/verify-otp")


def get_current_user(token: str = Depends(oauth2_scheme)) -> uuid.UUID:
    """
    Extract and validate the current user from JWT.
    Returns user_id (subject).
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return uuid.UUID(user_id)

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
