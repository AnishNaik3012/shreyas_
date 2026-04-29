from fastapi import FastAPI, HTTPException, Header
from dotenv import load_dotenv
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.chat.routes import router as chat_router
from app.appointments.routes import router as appointments_router
from app.checkups.routes import router as checkups_router
from app.routes.doctor_routes import router as doctor_router
from app.routes.nurse_routes import router as nurse_router

app = FastAPI(title="Savemom Chatbot API")

# =====================
# CORS
# =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================
# ROUTERS
# =====================
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(appointments_router)
app.include_router(checkups_router)
app.include_router(doctor_router)
app.include_router(nurse_router)

# =====================
# HEALTH CHECK
# =====================
@app.get("/")
def health():
    return {"status": "ok"}

# =====================
# EXAMPLE PROTECTED ENDPOINT
# =====================
@app.post("/appointments/book")
def book_appointment(
    data: dict,
    authorization: str = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    return {"id": "1", **data}
