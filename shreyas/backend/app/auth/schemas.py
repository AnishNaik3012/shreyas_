from pydantic import BaseModel
from typing import Literal, Optional


class SendOTPRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


class VerifyOTPRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    otp: str
    full_name: Optional[str] = None
    role: Optional[Literal["parent", "doctor", "nurse"]] = None


class AuthResponse(BaseModel):
    access_token: str
    role: Literal["parent", "doctor", "nurse"]
    user_id: str
    is_new_user: bool
