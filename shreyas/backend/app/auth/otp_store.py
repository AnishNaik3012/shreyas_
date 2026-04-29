from datetime import datetime, timedelta
from typing import Dict, Tuple

# identifier -> (otp, expiry)
_otp_store: Dict[str, Tuple[str, datetime]] = {}

OTP_EXPIRY_MINUTES = 5


def generate_otp(identifier: str) -> str:
    """
    Generate and store an OTP for the given identifier.
    DEV ONLY: fixed OTP for now.
    """
    otp = "123456"  # dev-only fixed OTP
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    _otp_store[identifier] = (otp, expires_at)

    # DEV DEBUG
    print(f"[OTP DEBUG] {identifier} -> {otp}")

    return otp


def verify_otp(identifier: str, otp: str) -> bool:
    """
    Verify OTP for identifier.
    Returns True if valid, False otherwise.
    One-time use.
    """
    record = _otp_store.get(identifier)

    if not record:
        return False

    saved_otp, expires_at = record

    if datetime.utcnow() > expires_at:
        _otp_store.pop(identifier, None)
        return False

    if saved_otp != otp:
        return False

    # One-time use
    _otp_store.pop(identifier, None)
    return True
