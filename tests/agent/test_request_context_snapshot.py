import json
from types import SimpleNamespace
from unittest.mock import patch

from agent.api_request_hooks import ApiRequestHooksMixin
from agent import request_context_snapshot as context


class Agent(ApiRequestHooksMixin):
    platform = "desktop"
    session_id = "session-a"


def test_request_assembly_captures_post_middleware_payload(tmp_path, monkeypatch):
    from agent.turn_api_request import build_api_request

    original_path = context._path
    monkeypatch.setattr(context, "_path", lambda session_id, home=None: original_path(session_id, home=home or tmp_path))
    agent = Agent()
    agent.tools = [{"name": "web_search"}]
    agent.api_mode = "chat_completions"
    agent.provider = "mock"
    agent.model = "mock-model"
    agent.base_url = "http://127.0.0.1:1"
    agent._empty_content_retries = 0
    agent._is_copilot_url = lambda: False
    agent._is_openrouter_url = lambda: False
    agent._reset_stream_delivery_tracking = lambda: None
    agent._reapply_reasoning_echo_for_provider = lambda messages: None
    agent._build_api_kwargs = lambda messages: {"messages": messages, "tools": agent.tools}
    middleware = lambda payload, **kwargs: SimpleNamespace(
        payload={**payload, "instructions": "added by middleware"}, original_payload=payload, trace=[]
    )
    with patch("agent.conversation_loop._redecorate_prompt_cache_for_provider", side_effect=lambda _agent, messages, **kwargs: (messages, None, agent.tools)), \
         patch("agent.turn_api_request.strip_images_for_rejecting_model"), \
         patch("agent.turn_api_request.sanitize_outbound_kwargs"), \
         patch("hermes_cli.middleware.apply_llm_request_middleware", side_effect=middleware):
        result = build_api_request(
            agent, api_messages=[{"role": "user", "content": "hello"}], _moa_prepared_request=None,
            tools_for_api=agent.tools, system_message={}, messages=[{"role": "user", "content": "hello", "_row_id": 12}],
            original_user_message="hello", approx_tokens=3, total_chars=5, retry_count=0,
            api_call_count=1, api_request_id="actual:api:1", api_start_time=0,
            effective_task_id="task", turn_id="actual",
        )
    assert result.api_kwargs["instructions"] == "added by middleware"
    rows = context.read_snapshots(agent.session_id)
    assert len(rows) == 1
    assert json.loads(rows[0]["request"])["instructions"] == "added by middleware"
    assert rows[0]["user_row_id"] == 12


def test_captured_system_prompt_labels_exact_soul_and_memory_sections(tmp_path, monkeypatch):
    soul = "Original SOUL\n\nAppended OMP rules"
    (tmp_path / "SOUL.md").write_text(soul)
    monkeypatch.setattr(context, "get_hermes_home", lambda: tmp_path)
    system = (soul + "\n\nOther system instructions\n\n"
              "══════════════\nMEMORY (your personal notes) [20%]\n══════════════\nPersonal note\n\n"
              "# Hindsight Memory\nRelevant memories are automatically injected.\n\n"
              "# Hindsight knowledge pages (index only)\n- workflow editor\n\n"
              "# Hermes runtime environment\nHost: Linux")
    blocks = context._blocks({"instructions": system})
    assert [block["source"] for block in blocks] == ["SOUL.md", "System prompt", "Memory", "System prompt"]
    assert blocks[0]["text"] == soul
    assert "workflow editor" in blocks[2]["text"]
    assert "MEMORY" not in blocks[1]["text"]
    assert "Host: Linux" in blocks[3]["text"]
    via_messages = context._blocks({"messages": [{"role": "system", "content": system}]})
    assert via_messages == blocks


def test_captures_final_request_and_scopes_to_session(tmp_path, monkeypatch):
    original_path = context._path
    path = original_path("session-a", home=tmp_path)
    monkeypatch.setattr(context, "_path", lambda session_id, home=None: original_path(session_id, home=home or tmp_path))
    agent = Agent()
    secret = "sk-" + "A" * 30
    payload = {
        "instructions": "soul and catalog",
        "input": [{"role": "user", "content": "question\n\n<memory-context>recalled</memory-context>"}],
        "tools": [{"name": "web_search", "description": "search"}],
        "extra_headers": {"Authorization": "Bearer " + secret},
    }
    context.capture_request(agent, payload, api_request_id="turn:api:1", messages=[{"role": "user", "content": "question", "_row_id": 42}])
    rows = context.read_snapshots("session-a")
    assert len(rows) == 1
    assert rows[0]["user_row_id"] == 42
    assert rows[0]["redacted"] is True
    assert rows[0]["blocks"][0] == {"source": "System prompt", "text": "soul and catalog"}
    assert {block["source"] for block in rows[0]["blocks"]} == {"System prompt", "Memory recall", "Tools"}
    assert secret not in json.dumps(rows)
    assert context.read_snapshots("session-b") == []
    assert context.read_snapshots("session-a", home=tmp_path / "other-profile") == []
    assert path.stat().st_mode & 0o777 == 0o600
    with path.open("a", encoding="utf-8") as stream:
        stream.write("{incomplete")
    assert len(context.read_snapshots("session-a")) == 1
