"""Owner-scoped, redacted observations of requests actually submitted to the model.

The inspector is opt-in and never changes provider kwargs. Snapshots are private
local files; an authorized session RPC is the only route to the Desktop.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from collections import deque
from pathlib import Path
from typing import Any

from hermes_constants import get_hermes_home
from agent.redact import redact_sensitive_text

log = logging.getLogger(__name__)
MAX_REQUEST_CHARS = 400_000
MAX_BLOCK_CHARS = 100_000
MAX_SNAPSHOTS = 256


def _path(session_id: str, *, home: Path | None = None) -> Path:
    if not session_id:
        raise ValueError("session id required")
    # Never interpolate an untrusted session id into a filesystem path.
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    return (home or get_hermes_home()) / "sessions" / "context_snapshots" / f"{digest}.jsonl"


def _safe_text(value: Any) -> str:
    return redact_sensitive_text(str(value), force=True)


def _model_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(_model_text(part.get("text") or part.get("content") or "") for part in value if isinstance(part, dict))
    return ""


def _system_blocks(content: str) -> list[dict[str, str]]:
    """Label sections only when their bytes occur in the outbound prompt."""
    result = []
    soul_path = get_hermes_home() / "SOUL.md"
    if soul_path.is_file():
        soul = soul_path.read_text(encoding="utf-8").strip()
        if soul and content.startswith(soul):
            result.append({"source": "SOUL.md", "text": _safe_text(soul)})
            content = content[len(soul):]
    memory = re.search(r"\n\n(?=═+\nMEMORY \(|# Hindsight Memory(?:\n|$))", content)
    if memory:
        prefix, content = content[:memory.start()], content[memory.start():]
        if prefix.strip():
            result.append({"source": "System prompt", "text": _safe_text(prefix)})
        end = content.find("\n\n# Hermes runtime environment")
        if end >= 0:
            result.append({"source": "Memory", "text": _safe_text(content[:end])})
            content = content[end:]
        else:
            result.append({"source": "Memory", "text": _safe_text(content)})
            content = ""
    if content.strip():
        result.append({"source": "System prompt", "text": _safe_text(content)})
    return result


def _blocks(payload: dict, user: dict | None = None) -> list[dict[str, str]]:
    """All non-chat content, extracted from the *post-middleware* request."""
    blocks: list[dict[str, str]] = []
    system = payload.get("instructions") or payload.get("system")
    if system:
        blocks.extend(_system_blocks(_model_text(system)))
    messages = payload.get("messages") or payload.get("input") or []
    for message in messages if isinstance(messages, list) else []:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        content = _model_text(message.get("content"))
        if role in ("system", "developer"):
            blocks.extend(_system_blocks(content) if role == "system" else [{"source": "Developer context", "text": _safe_text(content)}])
    # Only the *current* user's delta is an injection. Historical user turns
    # already have their own cards; don't replay them on every tool iteration.
    current = next((m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"), None) if isinstance(messages, list) else None
    if current and user:
        content = _model_text(current.get("content"))
        authored = _model_text(user.get("content"))
        if authored and content.startswith(authored) and len(content) > len(authored):
            suffix = content[len(authored):].strip()
            if suffix.startswith("<memory-context>"):
                end = suffix.find("</memory-context>")
                if end >= 0:
                    end += len("</memory-context>")
                    blocks.append({"source": "Memory recall", "text": _safe_text(suffix[:end])})
                    suffix = suffix[end:].strip()
            if suffix:
                blocks.append({"source": "Other context", "text": _safe_text(suffix)})
        elif "<memory-context>" in content:
            start = content.rfind("<memory-context>")
            end = content.find("</memory-context>", start)
            if end >= 0:
                blocks.append({"source": "Memory recall", "text": _safe_text(content[start:end + len("</memory-context>")])})
        elif authored and content != authored:
            # A middleware may replace the current user text. The transcript
            # cannot explain those outbound bytes; show them as unknown context.
            blocks.append({"source": "Other context", "text": _safe_text(content)})
    tools = payload.get("tools")
    if tools:
        blocks.append({"source": "Tools", "text": _safe_text(json.dumps(tools, ensure_ascii=False, default=str))})
    return [
        {**block, "text": block["text"][:MAX_BLOCK_CHARS] + ("\n… [block truncated]" if len(block["text"]) > MAX_BLOCK_CHARS else "")}
        for block in blocks if block["text"]
    ]


def capture_request(agent: Any, api_kwargs: dict, *, api_request_id: str, messages: Any) -> None:
    """Fail open: observability must never fail or delay a model call."""
    try:
        if getattr(agent, "platform", "") != "desktop" or not getattr(agent, "session_id", None):
            return
        # Existing secret-key filtering and object normalization; use larger limits
        # than the hook's 50k diagnostic payload, with an explicit truncation flag.
        payload = agent._hook_jsonable(
            {key: value for key, value in api_kwargs.items()
             if key not in {"http_client", "timeout", "extra_headers", "headers"}},
            max_depth=20, max_string=MAX_REQUEST_CHARS, max_sequence=10000,
        )
        if not isinstance(payload, dict):
            return
        safe = _safe_text(json.dumps(payload, ensure_ascii=False, default=str))
        truncated = (len(safe) > MAX_REQUEST_CHARS or "...[truncated " in safe
                     or '"_truncated_items"' in safe or " depth limit>" in safe)
        safe = safe[:MAX_REQUEST_CHARS] if truncated else safe
        user = next((m for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"), {})
        snapshot = {
            "request_id": str(api_request_id),
            "user_row_id": user.get("_row_id") if isinstance(user.get("_row_id"), int) else None,
            "user_text": _safe_text(_model_text(user.get("content")))[:500],
            "blocks": _blocks(payload, user),
            "request": safe,
            "truncated": truncated,
            "redacted": True,
        }
        path = _path(agent.session_id)
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "a", encoding="utf-8") as stream:
            stream.write(json.dumps(snapshot, ensure_ascii=False) + "\n")
    except Exception:
        log.warning("Could not capture redacted model request", exc_info=True)


def read_snapshots(session_id: str, *, home: Path | None = None) -> list[dict]:
    path = _path(session_id, home=home)
    try:
        with path.open(encoding="utf-8") as stream:
            tail = deque((line for line in stream if line.strip()), maxlen=MAX_SNAPSHOTS)
        rows = []
        for line in tail:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue  # concurrent append may leave an incomplete final line
        return rows
    except FileNotFoundError:
        return []
