from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# =====================
# DATABASE
# =====================

from app.db.engine import engine
from app.db.base import Base
from app.db.session import SessionLocal

# 🔥 IMPORT MODELS BEFORE create_all
from app.models.user import User  # IMPORTANT
from app.models.hospital import Hospital  # IMPORTANT
from app.models.doctor import Doctor  # IMPORTANT
from app.models.doctor_availability import DoctorAvailability  # IMPORTANT
from app.models.appointment import Appointment  # IMPORTANT
from app.models.checkup import Checkup  # IMPORTANT
from app.models.chat_session import ChatSession  # IMPORTANT
from app.models.chat_message import ChatMessage  # IMPORTANT
from app.models.patient_vital import PatientVital  # IMPORTANT
from app.seed import seed_doctors
from app.rag.indexer import index_knowledge_base
from pathlib import Path
import os
import threading

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

Base.metadata.create_all(bind=engine)

# =====================
# APP INIT
# =====================

app = FastAPI(title="Savemom Chatbot API")
uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# =====================
# CORS (DEV CONFIG)
# =====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,  # safer with localhost
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================
# ROUTERS
# =====================

from app.auth.routes import router as auth_router
from app.chat.routes import router as chat_router
from app.appointments.routes import router as appointment_router
from app.checkups.routes import router as checkup_router
from app.rag.search import router as rag_router
from app.routes.nurse_routes import router as nurse_router
from app.routes.doctor_routes import router as doctor_router

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(appointment_router)
app.include_router(checkup_router)
app.include_router(rag_router)
app.include_router(nurse_router)
app.include_router(doctor_router)

# =====================
# STARTUP SEEDS
# =====================

@app.on_event("startup")
def seed_database():
    db = SessionLocal()
    try:
        seed_doctors(db)
        db.commit()
    finally:
        db.close()
    if os.getenv("RAG_AUTO_INDEX") == "1":
        thread = threading.Thread(
            target=index_knowledge_base,
            args=(Path("knowledge_base"),),
            daemon=True,
        )
        thread.start()

# =====================
# HEALTH CHECK
# =====================

@app.get("/")
def health():
    return {"status": "ok"}
