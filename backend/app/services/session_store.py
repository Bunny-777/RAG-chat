import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from backend.app.models.responses import ResearchResponse


class ChatTurn(BaseModel):
    turn_id: str
    role: str  # "user" | "assistant"
    query: Optional[str] = None
    content: str
    report: Optional[ResearchResponse] = None
    mode: Optional[str] = None
    timestamp: float = Field(default_factory=time.time)


class ChatSession(BaseModel):
    session_id: str
    title: str
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    turns: List[ChatTurn] = Field(default_factory=list)


class SessionStore:
    """In-memory store managing multi-turn chat sessions and conversation history."""

    def __init__(self):
        self._sessions: Dict[str, ChatSession] = {}

    def get_or_create_session(self, session_id: Optional[str] = None, title: Optional[str] = None) -> ChatSession:
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]

        sid = session_id or f"sess_{uuid.uuid4().hex[:10]}"
        new_session = ChatSession(
            session_id=sid,
            title=title or "New Research Session",
            created_at=time.time(),
            updated_at=time.time(),
            turns=[],
        )
        self._sessions[sid] = new_session
        return new_session

    def add_turn(
        self,
        session_id: str,
        query: str,
        report: ResearchResponse,
    ) -> ChatSession:
        session = self.get_or_create_session(session_id)
        # Update title based on first query if title is default
        if session.title == "New Research Session" and query:
            session.title = query[:45] + ("..." if len(query) > 45 else "")

        user_turn = ChatTurn(
            turn_id=f"turn_{uuid.uuid4().hex[:8]}",
            role="user",
            query=query,
            content=query,
            timestamp=time.time(),
        )

        assistant_turn = ChatTurn(
            turn_id=f"turn_{uuid.uuid4().hex[:8]}",
            role="assistant",
            query=query,
            content=report.executive_summary or (report.analysis[0] if report.analysis else "Response completed."),
            report=report,
            mode=report.mode,
            timestamp=time.time(),
        )

        session.turns.extend([user_turn, assistant_turn])
        session.updated_at = time.time()
        return session

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        return self._sessions.get(session_id)

    def list_sessions(self) -> List[ChatSession]:
        return sorted(self._sessions.values(), key=lambda s: s.updated_at, reverse=True)

    def delete_session(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def clear(self) -> None:
        self._sessions.clear()

    def format_history_for_prompt(self, session_id: Optional[str], max_turns: int = 6) -> str:
        """Returns formatted conversation history to inject into prompt context."""
        if not session_id or session_id not in self._sessions:
            return ""

        session = self._sessions[session_id]
        recent_turns = session.turns[-max_turns:] if len(session.turns) > max_turns else session.turns
        if not recent_turns:
            return ""

        history_lines = []
        for t in recent_turns:
            prefix = "User" if t.role == "user" else "Assistant"
            text = t.content.strip()
            if len(text) > 300:
                text = text[:300] + "..."
            history_lines.append(f"{prefix}: {text}")

        return "Recent Conversation History:\n" + "\n".join(history_lines)


session_store = SessionStore()
