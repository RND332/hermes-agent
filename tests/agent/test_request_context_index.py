"""Bounded snapshot indexes: no bodies on polls, no rereads of consumed captures."""
import json
from pathlib import Path

from agent.request_context_snapshot import _path


def test_index_reads_only_appends_and_retries_incomplete_records(tmp_path, monkeypatch):
    from agent.request_context_index import snapshot_response

    path = _path("chat", home=tmp_path)
    path.parent.mkdir(parents=True)
    def row(i):
        return json.dumps({"request_id": str(i), "user_row_id": i, "user_text": "hello",
                           "blocks": [{"source": "System prompt", "text": "large" * 20000}],
                           "request": "payload" * 50000, "redacted": True, "truncated": False}) + "\n"
    path.write_text(row(0))
    first = snapshot_response(["chat"], home=tmp_path)
    assert len(json.dumps(first)) < 2000
    original_open = Path.open
    positions = []
    class Reader:
        def __init__(self, stream): self.stream = stream
        def __enter__(self): return self
        def __exit__(self, *args): self.stream.close()
        def __getattr__(self, key): return getattr(self.stream, key)
        def readline(self, *args):
            positions.append(self.stream.tell())
            return self.stream.readline(*args)
    def tracked_open(p, *args, **kwargs):
        stream = original_open(p, *args, **kwargs)
        return Reader(stream) if p == path and args and args[0] == "rb" else stream
    monkeypatch.setattr(Path, "open", tracked_open)
    unchanged = snapshot_response(["chat"], home=tmp_path, revision=first["revision"])
    assert unchanged["unchanged"] and unchanged["snapshots"] == []
    assert positions == []
    offset = path.stat().st_size
    with original_open(path, "a") as stream: stream.write(row(1)[:-1])
    partial = snapshot_response(["chat"], home=tmp_path)
    assert [r["request_id"] for r in partial["snapshots"]] == ["0"]
    with original_open(path, "a") as stream: stream.write("\n")
    appended = snapshot_response(["chat"], home=tmp_path, revision=partial["revision"])
    assert [r["request_id"] for r in appended["snapshots"]] == ["0", "1"]
    assert positions and min(positions) >= offset
    detail = snapshot_response(["chat"], home=tmp_path, request_id="1")
    assert detail["snapshots"][0]["request"] == "payload" * 50000
    path.write_text(row(2))
    replaced = snapshot_response(["chat"], home=tmp_path)
    assert [r["request_id"] for r in replaced["snapshots"]] == ["2"]
    path.unlink()
    assert snapshot_response(["chat"], home=tmp_path)["snapshots"] == []


def test_snapshot_window_and_details_stay_session_and_home_scoped(tmp_path):
    from agent.request_context_index import snapshot_response
    from agent.request_context_snapshot import MAX_SNAPSHOTS

    for home, key, count in ((tmp_path, "a", MAX_SNAPSHOTS + 2), (tmp_path / "other", "a", 1), (tmp_path, "b", 1)):
        path = _path(key, home=home)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w") as stream:
            for i in range(count):
                stream.write(json.dumps({"request_id": str(i), "request": str(home / key), "blocks": []}) + "\n")
    index = snapshot_response(["a"], home=tmp_path)
    assert len(index["snapshots"]) == MAX_SNAPSHOTS
    assert snapshot_response(["a"], home=tmp_path, request_id="0")["snapshots"] == []
    assert snapshot_response(["a"], home=tmp_path / "other", request_id="0")["snapshots"][0]["request"] == str(tmp_path / "other" / "a")
    assert snapshot_response(["b"], home=tmp_path, request_id="0")["snapshots"][0]["request"] == str(tmp_path / "b")
    assert snapshot_response(["a"], home=tmp_path)["revision"] == index["revision"]
