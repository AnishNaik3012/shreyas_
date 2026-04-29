from __future__ import annotations

from typing import Any, Dict, List
import time

from sqlalchemy.orm import Session

from app.ai.client import generate_response
from app.chat.agents.flow_agent import start_flow, detect_flow_intent
from app.chat.agents.internal_rag_agent import internal_rag_agent
from app.chat.agents.medical_ai_agent import medical_ai_agent
from app.chat.agents.report_agent import report_summary_tool
from app.chat.agents.prescription_agent import prescription_summary_tool
from app.chat.agents.smalltalk_agent import smalltalk_agent
from app.chat.agents.fallback_agent import fallback_agent
from app.chat.router import classify_intent, is_emergency
from app.chat.safety import check_risk
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.user import User


def load_agent_state(
    db: Session,
    user_id: str,
    history: List[Dict[str, str]] | None,
) -> Dict[str, Any]:
    session = db.query(ChatSession).filter(ChatSession.user_id == user_id).first()
    agent_state: Dict[str, Any] = {
        "history": history or [],
        "medical_context": {
            "symptoms": [],
            "conditions": [],
            "medications": [],
        },
        "last_tool": None,
    }

    if session and isinstance(session.context, dict):
        stored = session.context.get("medical_context")
        if isinstance(stored, dict):
            for key in ("symptoms", "conditions", "medications"):
                if isinstance(stored.get(key), list):
                    agent_state["medical_context"][key] = list(stored.get(key))
        report_analysis = session.context.get("report_analysis")
        if isinstance(report_analysis, dict):
            agent_state["report_analysis"] = report_analysis
        report_ctx = session.context.get("report")
        if isinstance(report_ctx, dict):
            agent_state["report"] = report_ctx
        prescription_analysis = session.context.get("prescription_analysis")
        if isinstance(prescription_analysis, dict):
            agent_state["prescription_analysis"] = prescription_analysis
        prescription_ctx = session.context.get("prescription")
        if isinstance(prescription_ctx, dict):
            agent_state["prescription"] = prescription_ctx

    return agent_state


def emergency_handler(message: str) -> str:
    result = check_risk(message)
    if result:
        return result
    return (
        "This sounds like an emergency. Please call 911 or go to the nearest "
        "emergency room immediately."
    )


async def handle_message(
    message: str,
    role: str,
    user_id: str,
    db: Session,
    history: List[Dict[str, str]] | None = None,
) -> Dict[str, str | None]:
    t0 = time.perf_counter()
    # Load last 10 messages from the current session (oldest -> newest)
    conversation_history: List[Dict[str, str]] = []
    session = db.query(ChatSession).filter(ChatSession.user_id == user_id).first()
    if session:
        items = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
            .all()
        )
        for item in reversed(items):
            raw_role = (item.role or "user").lower()
            normalized_role = "assistant" if raw_role in {"assistant", "bot"} else "user"
            conversation_history.append(
                {"role": normalized_role, "content": item.message}
            )

    current_user = db.query(User).filter(User.id == user_id).first()
    agent_state = load_agent_state(db, user_id, conversation_history)
    if current_user:
        agent_state["role"] = current_user.role
    print("AGENT STATE:", agent_state)

    t_intent_start = time.perf_counter()
    if is_emergency(message):
        intent = "emergency"
    else:
        intent = await classify_intent(message, agent_state)
    t_intent_end = time.perf_counter()
    print("ROUTER INTENT:", intent)
    agent_state["last_tool"] = intent

    tool_result = ""
    source = "assistant"
    buttons = None

    t_tool_start = time.perf_counter()
    if intent == "emergency":
        tool_result = emergency_handler(message)
        source = "emergency"
    elif intent == "clinical_info":
        result = await medical_ai_agent(
            message=message,
            role=role,
            history=agent_state["history"],
            state=agent_state,
        )
        tool_result = result.get("message") or ""
        source = result.get("source") or "medical_ai"
    elif intent == "medical_query":
        result = await medical_ai_agent(
            message=message,
            role=role,
            history=agent_state["history"],
            state=agent_state,
        )
        tool_result = result.get("message") or ""
        source = result.get("source") or "medical_ai"
    elif intent == "hospital_info":
        department = (current_user.department if current_user else None) or "general medicine"
        result = await internal_rag_agent(
            message=message,
            role=role,
            department=department,
            history=agent_state["history"],
            state=agent_state,
        )
        tool_result = result
        source = result.get("source") or "internal_rag"
    elif intent == "report_analysis":
        result = report_summary_tool(agent_state)
        tool_result = result
        source = result.get("source") or "report_tool"
    elif intent == "prescription_analysis":
        result = prescription_summary_tool(agent_state)
        tool_result = result
        source = result.get("source") or "prescription_tool"
    elif intent == "workflow_admin":
        if not current_user:
            return {"message": "User not found.", "source": "error"}
        flow_intent = detect_flow_intent(message) or "book_appointment"
        response_payload, _ = start_flow(flow_intent, db, current_user)
        tool_result = response_payload.get("message") or response_payload.get("reply") or ""
        buttons = response_payload.get("options") or response_payload.get("buttons")
        source = "workflow"
    elif intent == "workflow":
        if not current_user:
            return {"message": "User not found.", "source": "error"}
        flow_intent = detect_flow_intent(message) or "book_appointment"
        response_payload, _ = start_flow(flow_intent, db, current_user)
        tool_result = response_payload.get("message") or response_payload.get("reply") or ""
        buttons = response_payload.get("options") or response_payload.get("buttons")
        source = "workflow"
    elif intent == "smalltalk":
        tool_result = await smalltalk_agent(message)
        source = "smalltalk"
    else:
        result = await fallback_agent(message, agent_state)
        tool_result = result.get("message") or ""
        source = result.get("source") or "fallback"

    t_tool_end = time.perf_counter()
    print("TOOL RESULT:", tool_result)

    if isinstance(tool_result, dict) and tool_result.get("type") == "report_result":
        if session:
            session.context = {
                **(session.context or {}),
                "medical_context": agent_state["medical_context"],
            }
            db.add(session)
            db.commit()
        return {
            "message": tool_result.get("message")
            or "Your report has been analyzed successfully.",
            "type": "report_result",
            "summary": tool_result.get("summary"),
            "actions": tool_result.get("actions") or [],
            "source": source,
        }

    if isinstance(tool_result, dict) and tool_result.get("type") == "prescription_result":
        if session:
            session.context = {
                **(session.context or {}),
                "medical_context": agent_state["medical_context"],
            }
            db.add(session)
            db.commit()
        return {
            "message": tool_result.get("message")
            or "Your prescription has been analyzed successfully.",
            "type": "prescription_result",
            "summary": tool_result.get("summary"),
            "actions": tool_result.get("actions") or [],
            "source": source,
        }

    if isinstance(tool_result, dict) and tool_result.get("status") == "no_data":
        return {
            "message": (
                "I don’t have information about this yet in the hospital knowledge base. "
                "Please contact admin or try another query."
            ),
            "buttons": buttons,
            "source": source,
        }

    if isinstance(tool_result, dict):
        tool_result = tool_result.get("content", "")
    print("FINAL TOOL RESULT STRING:", tool_result)

    t_llm_start = time.perf_counter()
    if intent in {"workflow", "workflow_admin"}:
        response_text = tool_result or "What would you like to do?"
    else:
        system_prompt = "You are SaveMom assistant. Answer ONLY using tool_result."
        user_message = f"Tool Result:\n{tool_result}\n\nUser Question:\n{message}"
        try:
            final_response = await generate_response(
                system_prompt,
                user_message,
                messages=None,
            )
            print("LLM RESPONSE RAW:", final_response)
        except Exception as e:
            print("🔥 LLM ERROR:", str(e))
            raise e
        response_text = final_response["choices"][0]["message"]["content"]
        if not response_text:
            response_text = "I'm still learning. Could you rephrase or ask another question?"
        else:
            lowered = response_text.lower()
            if lowered.startswith("tool_result:"):
                response_text = response_text[len("tool_result:") :].strip()
    t_llm_end = time.perf_counter()

    if session:
        session.context = {
            **(session.context or {}),
            "medical_context": agent_state["medical_context"],
        }
        db.add(session)
        db.commit()

    total_ms = (time.perf_counter() - t0) * 1000
    intent_ms = (t_intent_end - t_intent_start) * 1000
    tool_ms = (t_tool_end - t_tool_start) * 1000
    llm_ms = (t_llm_end - t_llm_start) * 1000
    print(
        f"TIMINGS ms - total:{total_ms:.1f} intent:{intent_ms:.1f} tool:{tool_ms:.1f} llm:{llm_ms:.1f}"
    )

    return {
        "message": response_text or "I'm having trouble answering right now. Please try again.",
        "buttons": buttons,
        "source": source,
    }
