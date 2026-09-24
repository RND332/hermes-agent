"""Small, append-aware indexes for the Desktop's private context captures.

Only metadata and byte offsets are cached. Raw requests stay on disk until an
explicit detail read; an unchanged poll does not open or parse the capture file.
"""
from __future__ import annotations

from collections import deque
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import threading

from agent.request_context_snapshot import MAX_SNAPSHOTS, _path


class _SnapshotIndex:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.signature = None
        self.offset = 0
        self.rows = deque(maxlen=MAX_SNAPSHOTS)

    def refresh(self) -> None:
        try:
            stat = self.path.stat()
        except FileNotFoundError:
            self.rows.clear()
            self.offset, self.signature = 0, None
            return
        signature = (stat.st_dev, stat.st_ino, stat.st_mtime_ns, stat.st_size)
        if signature == self.signature:
            return
        if self.signature and (signature[:2] != self.signature[:2] or stat.st_size <= self.signature[3]):
            self.rows.clear()
            self.offset = 0
        with self.path.open("rb") as stream:
            stream.seek(self.offset)
            # Freeze the end for this pass so a continuously appending writer
            # cannot monopolize a polling request.
            while stream.tell() < stat.st_size:
                start = stream.tell()
                line = stream.readline(stat.st_size - start)
                if not line.endswith(b"\n"):
                    break  # Retry the partial final record after its next append.
                self.offset = stream.tell()
                try:
                    row = json.loads(line)
                except (ValueError, UnicodeDecodeError):
                    continue
                summary = {
                    "request_id": row["request_id"],
                    "user_row_id": row.get("user_row_id"),
                    "user_text": row.get("user_text", ""),
                    "blocks": [{"source": b["source"], "text": "",
                                "fingerprint": hashlib.sha256(b["text"].encode()).hexdigest()}
                               for b in row.get("blocks", [])],
                    "request": "", "truncated": row.get("truncated", False),
                    "redacted": row.get("redacted", True),
                }
                self.rows.append((summary, start, len(line)))
        self.signature = signature

    def read(self, request_id: str | None):
        with self.lock:
            self.refresh()
            if request_id is None:
                return [row for row, _, _ in self.rows], self.signature
            for row, offset, size in reversed(self.rows):
                if row["request_id"] == request_id:
                    with self.path.open("rb") as stream:
                        stream.seek(offset)
                        detail = json.loads(stream.read(size))
                    # A replacement between stat and open must not serve a
                    # different request from the cached byte offset.
                    return ([detail] if detail.get("request_id") == request_id else []), self.signature
            return [], self.signature


@lru_cache(maxsize=32)
def _index(path: Path) -> _SnapshotIndex:
    # The complete owner-home path is the key, not a process-global session id.
    return _SnapshotIndex(path)


def snapshot_response(session_ids: list[str], *, home: Path,
                      revision: str | None = None, request_id: str | None = None) -> dict:
    rows, versions = [], []
    for key in reversed(session_ids):
        found, version = _index(_path(key, home=home)).read(request_id)
        versions.append((key, version))
        rows = found + rows
        if request_id is not None and found or len(rows) >= MAX_SNAPSHOTS:
            break
    current = hashlib.sha256(json.dumps(versions).encode()).hexdigest()
    unchanged = request_id is None and revision == current
    return {"snapshots": [] if unchanged else rows[-MAX_SNAPSHOTS:],
            "revision": current, "unchanged": unchanged}
