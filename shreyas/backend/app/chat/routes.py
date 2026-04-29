from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import base64
import logging
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, List

from app.core.dependencies import get_current_user
from app.chat.orchestrator import handle_message
from app.chat.agents.flow_agent import handle_flow_step, start_flow, detect_flow_intent
from app.db.session import get_db
from app.models.user import User
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.services.report_service import analyze_report
from app.services.prescription_service import analyze_prescription

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)
# ================= SCHEMA =================

class ChatRequest(BaseModel):
    message: str
    user_id: str | None = None


class ChatResponse(BaseModel):
    message: str
    buttons: list | None = None
    source: str | None = None
    type: str | None = None
    actions: list | None = None
    summary: str | None = None
    analysis: dict | None = None


class ChatMessageRequest(BaseModel):
    message: str


def _normalize_chat_response(payload: Any) -> ChatResponse:
    if isinstance(payload, ChatResponse):
        return payload
    if isinstance(payload, dict):
        reply = payload.get("reply") or payload.get("message") or payload.get("response")
        buttons = payload.get("buttons") or payload.get("options")
        source = payload.get("source")
        message_type = payload.get("type")
        actions = payload.get("actions")
        summary = payload.get("summary")
        analysis = payload.get("analysis")
        if reply:
            return ChatResponse(
                message=reply,
                buttons=buttons,
                source=source,
                type=message_type,
                actions=actions,
                summary=summary,
                analysis=analysis,
            )
    return ChatResponse(
        message="I can help with appointments, pregnancy care, reports, and prescriptions. Please tell me what you need.",
        buttons=None,
        source=None,
    )


def _get_or_create_session(db: Session, user: User) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.user_id == user.id).first()
    if session:
        return session
    session = ChatSession(
        user_id=user.id,
        current_flow=None,
        current_step=None,
        context={},
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _store_message(db: Session, session: ChatSession, role: str, message: str) -> None:
    entry = ChatMessage(
        session_id=session.id,
        role=role,
        message=message,
    )
    db.add(entry)
    db.commit()


def _get_recent_history(db: Session, session: ChatSession, limit: int = 5) -> List[dict[str, str]]:
    items = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    history = [{"role": item.role, "content": item.message} for item in reversed(items)]
    return history


class ChatIntentRequest(BaseModel):
    intent: str


class ChatStepRequest(BaseModel):
    step: str
    value: Any


class ChatFlowResponse(BaseModel):
    message: str
    options: list | None = None
    step: str | None = None
    appointments: list | None = None
    checkups: list | None = None
    source: str | None = None


class ChatQueryRequest(BaseModel):
    message: str
    user_id: str | None = None
    mode: str | None = None  # "summary" or "chat"


class ChatQueryResponse(BaseModel):
    reply: str


# ================= CHAT =================

@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Secure chatbot endpoint with role-based access.
    """

    # ---------- LOAD USER ----------
    if data.user_id and data.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User mismatch",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not verified",
        )

    # ---------- ROLE ----------
    role = user.role

    if role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role",
        )

    # ---------- CHAT ----------
    try:
        result = await handle_message(
            message=data.message,
            role=role,
            user_id=user.id,
            db=db,
            history=[],
        )
        response = _normalize_chat_response(result)
        return ChatResponse(
            message=response.message,
            buttons=response.buttons,
            source=response.source,
            type=response.type,
            actions=response.actions,
            summary=response.summary,
            analysis=response.analysis,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chat processing failed",
        )


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    data: ChatMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not verified",
        )

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role",
        )

    session = db.query(ChatSession).filter(ChatSession.user_id == user.id).first()
    session = session or _get_or_create_session(db, user)
    history = _get_recent_history(db, session)
    _store_message(db, session, "user", data.message)
    try:
        result = await handle_message(
            message=data.message,
            role=user.role,
            user_id=user.id,
            db=db,
            history=history,
        )
    except Exception:
        result = {"message": "I'm having trouble answering right now. Please try again."}

    normalized = _normalize_chat_response(result)
    _store_message(db, session, "bot", normalized.message)
    return ChatResponse(
        message=normalized.message,
        buttons=normalized.buttons,
        source=normalized.source,
        type=normalized.type,
        actions=normalized.actions,
        summary=normalized.summary,
        analysis=normalized.analysis,
    )


@router.post("/intent", response_model=ChatFlowResponse)
async def chat_intent(
    data: ChatIntentRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not verified",
        )

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role",
        )

    intent = data.intent.lower()

    try:
        flow_intent = detect_flow_intent(intent) or intent
        if flow_intent in {
            "appointments",
            "checkups",
            "book_appointment",
            "view_appointments",
            "cancel_appointment",
            "book_checkup",
            "view_checkups",
            "cancel_checkup",
        }:
            response_payload, session = start_flow(flow_intent, db, user)
            if session:
                db.add(session)
                db.commit()
                db.refresh(session)
            return ChatFlowResponse(
                message=response_payload.get("message") or "",
                options=response_payload.get("options"),
                step=response_payload.get("step"),
                source="workflow",
            )

        result = await handle_message(
            message=intent,
            role=user.role,
            user_id=user.id,
            db=db,
            history=[],
        )
        normalized = _normalize_chat_response(result)
        return {
            "message": normalized.message,
            "options": normalized.buttons,
            "step": None,
            "source": normalized.source,
            "type": normalized.type,
            "actions": normalized.actions,
            "summary": normalized.summary,
        }
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chat processing failed",
        )


@router.post("/step", response_model=ChatFlowResponse)
async def chat_step(
    data: ChatStepRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not verified",
        )

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role",
        )

    try:
        active_session = (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user.id)
            .first()
        )
        active_session = active_session or _get_or_create_session(db, user)
        history = _get_recent_history(db, active_session)
        _store_message(db, active_session, "user", str(data.value))

        response_payload = None
        if active_session.current_flow:
            response_payload, session = handle_flow_step(
                db=db,
                user=user,
                current_flow=active_session.current_flow,
                step=data.step,
                value=data.value,
            )
            if session:
                db.add(session)
                db.commit()
                db.refresh(session)
        else:
            flow_intent = detect_flow_intent(str(data.value)) or detect_flow_intent(
                str(data.step)
            )
            if flow_intent:
                response_payload, session = start_flow(flow_intent, db, user)
                if session:
                    db.add(session)
                    db.commit()
                    db.refresh(session)
            else:
                response_payload = await handle_message(
                    message=str(data.value),
                    role=user.role,
                    user_id=user.id,
                    db=db,
                    history=history,
                )

        if isinstance(response_payload, dict):
            reply = response_payload.get("message") or response_payload.get("reply")
            _store_message(db, active_session, "bot", reply or "")
            return ChatFlowResponse(
                message=reply or "",
                options=response_payload.get("options") or response_payload.get("buttons"),
                step=response_payload.get("step"),
                appointments=response_payload.get("appointments"),
                checkups=response_payload.get("checkups"),
                source=response_payload.get("source"),
            )

        normalized = _normalize_chat_response(response_payload)
        _store_message(db, active_session, "bot", normalized.message)
        return ChatFlowResponse(
            message=normalized.message,
            options=normalized.buttons,
            step=None,
            appointments=None,
            checkups=None,
            source=normalized.source,
        )
    except Exception:
        db.rollback()
        logger.exception("Chat step failed", extra={"step": data.step})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chat processing failed",
        )


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    data: ChatQueryRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not verified",
        )

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role",
        )
    try:
        result = await handle_message(
            message=data.message,
            role=user.role,
            user_id=user.id,
            db=db,
            history=[],
        )
        normalized = _normalize_chat_response(result)
        return ChatQueryResponse(reply=normalized.message)
    except Exception as exc:
        logger.exception("Chat query failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {exc}",
        )


@router.post("/report/analyze", response_model=ChatResponse)
async def upload_report(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    session = db.query(ChatSession).filter(ChatSession.user_id == user.id).first()
    session = session or _get_or_create_session(db, user)

    file_bytes = await file.read()
    try:
        file.file.seek(0)
    except Exception:
        pass
    analysis = await analyze_report(file)
    mime_type = file.content_type or "application/octet-stream"
    file_b64 = base64.b64encode(file_bytes).decode("utf-8") if file_bytes else ""
    file_url = f"data:{mime_type};base64,{file_b64}" if file_b64 else None
    report_context = {
        "file_url": file_url,
        "file_type": mime_type,
        "summary_file": analysis.get("summary_file") if isinstance(analysis, dict) else None,
    }
    session.context = {
        **(session.context or {}),
        "report_analysis": analysis,
        "report": report_context,
    }
    db.add(session)
    db.commit()

    return ChatResponse(
        message="Your report has been analyzed successfully.",
        buttons=None,
        source="report_tool",
        type="report_result",
        summary=analysis.get("summary") if isinstance(analysis, dict) else None,
        actions=[
            {
                "label": "View Report",
                "action": "view_report",
                "file_url": file_url,
            },
            {
                "label": "Download Summary",
                "action": "download_summary",
                "summary_url": report_context.get("summary_file"),
            },
        ],
    )


@router.post("/prescription/analyze", response_model=ChatResponse)
async def upload_prescription(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    session = db.query(ChatSession).filter(ChatSession.user_id == user.id).first()
    session = session or _get_or_create_session(db, user)

    file_bytes = await file.read()
    try:
        file.file.seek(0)
    except Exception:
        pass
    analysis = await analyze_prescription(file)
    mime_type = file.content_type or "application/octet-stream"
    file_b64 = base64.b64encode(file_bytes).decode("utf-8") if file_bytes else ""
    file_url = f"data:{mime_type};base64,{file_b64}" if file_b64 else None
    prescription_context = {
        "file_url": file_url,
        "file_type": mime_type,
        "summary_file": analysis.get("summary_file") if isinstance(analysis, dict) else None,
    }
    session.context = {
        **(session.context or {}),
        "prescription_analysis": analysis,
        "prescription": prescription_context,
    }
    db.add(session)
    db.commit()

    return ChatResponse(
        message="Your prescription has been analyzed successfully.",
        buttons=None,
        source="prescription_tool",
        type="prescription_result",
        summary=analysis.get("ai_summary") if isinstance(analysis, dict) else None,
        analysis=analysis if isinstance(analysis, dict) else None,
        actions=[
            {
                "label": "View Prescription",
                "action": "view_prescription",
                "file_url": file_url,
            },
            {
                "label": "Download Summary",
                "action": "download_summary",
                "summary_url": prescription_context.get("summary_file"),
            },
        ],
    )
