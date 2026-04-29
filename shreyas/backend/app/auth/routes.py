from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.auth.schemas import SendOTPRequest, VerifyOTPRequest
from app.auth.security import create_access_token
from app.auth.otp_store import generate_otp, verify_otp
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


def _extract_identifier(email: str | None, phone: str | None) -> tuple[str, str]:
    email = email.strip() if email else None
    phone = phone.strip() if phone else None

    if bool(email) == bool(phone):
        raise HTTPException(
            status_code=400,
            detail="Provide exactly one of email or phone",
        )

    if email:
        return ("email", email)
    return ("phone", phone)


@router.post("/send-otp")
def send_otp(data: SendOTPRequest):
    _, identifier = _extract_identifier(data.email, data.phone)

    generate_otp(identifier)
    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
def verify_otp_route(
    data: VerifyOTPRequest,
    db: Session = Depends(get_db),
):
    id_type, identifier = _extract_identifier(data.email, data.phone)

    if not verify_otp(identifier, data.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    if id_type == "email":
        user = db.query(User).filter(User.email == identifier).first()
    else:
        user = db.query(User).filter(User.phone == identifier).first()

    # SIGNUP
    if not user:
        if not data.full_name or not data.role:
            raise HTTPException(
                status_code=400,
                detail="full_name and role are required for signup",
            )

        # Extra safety: enforce uniqueness even if identifier changed
        duplicate = (
            db.query(User)
            .filter((User.email == identifier) | (User.phone == identifier))
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Account already exists for this identifier",
            )

        user = User(
            full_name=data.full_name.strip(),
            email=identifier if id_type == "email" else None,
            phone=identifier if id_type == "phone" else None,
            role=data.role,
            is_verified=True,
        )
        db.add(user)
        is_new_user = True

    # LOGIN
    else:
        user.is_verified = True
        is_new_user = False

    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=str(user.id))

    return {
        "access_token": access_token,
        "role": user.role,
        "user_id": str(user.id),
        "is_new_user": is_new_user,
    }
