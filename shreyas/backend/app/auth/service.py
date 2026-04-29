import random
from datetime import datetime, timedelta

# In-memory OTP store (DEV MODE)
OTP_STORE = {}
OTP_EXPIRY_MINUTES = 5


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def send_otp(identifier: str):
    otp = generate_otp()
    OTP_STORE[identifier] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    }

    # 🔥 DEV MODE OTP (THIS IS EXPECTED)
    print(f"[OTP DEBUG] {identifier} -> {otp}")


def verify_otp(identifier: str, otp: str) -> bool:
    record = OTP_STORE.get(identifier)

    if not record:
        return False

    if datetime.utcnow() > record["expires_at"]:
        OTP_STORE.pop(identifier, None)
        return False

    if record["otp"] != otp:
        return False

    # OTP valid → remove after use
    OTP_STORE.pop(identifier, None)
    return True


def is_new_user(identifier: str) -> bool:
    # DEV MODE — always treat as new user
    return True
