from datetime import datetime, timedelta
import random

# in-memory OTP store (DEV ONLY)
# identifier -> (otp, expiry)
_otp_store: dict[str, tuple[str, datetime]] = {}


def generate_otp(identifier: str) -> str:
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    _otp_store[identifier] = (otp, expires_at)
    return otp


def verify_otp(identifier: str, otp: str) -> bool:
    record = _otp_store.get(identifier)

    if not record:
        return False

    saved_otp, expires_at = record

    if datetime.utcnow() > expires_at:
        _otp_store.pop(identifier, None)
        return False

    if saved_otp != otp:
        return False

    # one-time use
    _otp_store.pop(identifier, None)
    return True
