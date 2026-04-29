from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Index

from app.db.base import Base


class OTP(Base):
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String, index=True, nullable=False)  # email or phone
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @staticmethod
    def expiry(minutes: int = 5) -> datetime:
        """Returns expiry time (default 5 minutes)"""
        return datetime.utcnow() + timedelta(minutes=minutes)


# Optional but recommended index
Index("idx_otp_identifier", OTP.identifier)
