# Hindsight Page Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the active Hindsight bank's knowledge page names and short descriptions as a bounded, session-stable system-prompt index.

**Architecture:** The installed Hindsight plugin resolves its active bank during initialization, performs one authenticated tree read, and formats a data-only, redacted index into its existing `system_prompt_block()`. The new code lives in a small module alongside the plugin; no Hermes core changes. Runtime failures leave the original prompt untouched and report a warning.

**Tech Stack:** Python 3.13, urllib, pytest, Hermes MemoryProvider plugin.

**Spec:** `docs/superpowers/specs/2026-09-24-hindsight-context-inspector-design.md` (Catalog design, Verification 1–2).

**Implementation status:** The catalog, provider startup wiring, and replayable overlay are implemented. The installed provider suite and the live `master` page-tree probe pass. Separately, the Desktop request inspector, gateway contract, renderer disclosures and focused tests are implemented in this branch; the current running Desktop/gateway has not been restarted for a manual end-to-end GUI check. This plan's checkboxes below retain the original TDD sequence, not the final status.

## Global Constraints

- Leave `$HERMES_HOME/SOUL.md` and Hindsight bank/page data unchanged.
- Read `/v1/default/banks/{bank_id}/knowledge-base/tree` with the provider's own URL and scoped API key, after bank-template resolution.
- Fetch once per initialized session, bounded by a short timeout; no refetch inside a turn; prompt cache stays stable.
- List names and shortened descriptions only, never bodies, IDs, secret values, or implicit claims of loaded page content.
- Existing plugin is external to the Hermes git repository; explicitly preserve local changes across catalog-plugin upgrades.

---

### Task 1: Fetch and format one bank's page catalog

**Files:**
- Create: `$HERMES_HOME/plugins/hindsight/page_catalog.py` (HTTP tree read, safe deterministic formatter).
- Create: `$HERMES_HOME/plugins/hindsight/tests/test_page_catalog.py` (HTTP fixture and contract tests).

**Interfaces:**
- `fetch_page_tree(api_url: str, bank_id: str, api_key: str | None, timeout: float = 2.0) -> dict`: authenticated GET, no mutation.
- `render_page_index(tree: dict, *, max_chars: int = 4000, description_chars: int = 140) -> str`: deterministic data-only index, empty when no pages.

- [ ] **Step 1: Write a failing test** for a local HTTP server receiving `/v1/default/banks/team/knowledge-base/tree` and Bearer key, returning two nested pages; assert deterministic sorted names/descriptions, no `body`, `id` or newline-containing uncontrolled text. Test an empty tree, over-budget tree and a credential-tagged page (its name is retained, its description hidden).
- [ ] **Step 2: Run** `pytest -q /home/rnd332/.hermes/plugins/hindsight/tests/test_page_catalog.py`; confirm failure due to missing module/function.
- [ ] **Step 3: Implement** `fetch_page_tree` with `urllib.request.Request`, `urllib.parse.quote(bank_id, safe='')`, JSON decoding and timeout; `render_page_index` walks `roots/children`, formats `- folder/name — short one-line description`, excludes `memory_type:credential` descriptions and uses Hermes's `agent.redact.redact_sensitive_text(..., force=True)` for ordinary descriptions; caps per item and total, adds `… (catalog truncated)` when needed.
- [ ] **Step 4: Re-run** targeted tests; add a failing test for HTTP errors/timeouts and validate exceptions remain available to the caller (it owns the warning).
- [ ] **Step 5: Re-run** all plugin tests under `$HERMES_HOME/plugins/hindsight/tests/`.

### Task 2: Wire the immutable index into Hindsight startup

**Files:**
- Modify: `$HERMES_HOME/plugins/hindsight/__init__.py` (`initialize`, `system_prompt_block`, startup state).
- Modify: `$HERMES_HOME/plugins/hindsight/tests/test_provider.py` (session, profile and failure tests).
- Modify: `$HERMES_HOME/plugins/hindsight/tests/conftest.py` (only if stubs need `agent.redact`).
- Modify: `$HERMES_HOME/plugins/hindsight/README.md` (new behavior and limits).

**Interfaces:**
- Consumes `fetch_page_tree` and `render_page_index` from Task 1.
- Produces `HindsightMemoryProvider._page_index: str`, initialized to empty and set once in `initialize` after `_apply_connection_settings`.

- [ ] **Step 1: Add a failing test**: mock only `fetch_page_tree` at the HTTP seam, initialize provider with bank `team`, assert `system_prompt_block()` contains the list and remains identical after the fake tree changes; a second provider reflects newer tree. Assert failure keeps the original Hindsight header and invokes `warning_callback` without leaking credentials.
- [ ] **Step 2: Run** `pytest -q $HERMES_HOME/plugins/hindsight/tests/test_provider.py -k page_index` and confirm the expected feature absence.
- [ ] **Step 3: Implement** one bounded fetch inside `initialize` after connection settings; store the formatted string on the instance, append only if nonempty; fail open with a warning callback and logger. Skip inactive/disabled provider. Keep `system_prompt_block` pure and network-free.
- [ ] **Step 4: Run** targeted test, then entire plugin suite. Update README with the session boundary and the no-body promise.
- [ ] **Step 5: Exercise real `master` bank** with a fresh provider instance (without retaining or writing): confirm all live page names are accounted for or an explicit truncation marker appears, and confirm the original SOUL prefix remains unchanged.

### Task 3: Durability and verification

**Files:**
- Create: `$HERMES_HOME/hindsight/local-page-catalog.patch` (replayable patch for the externally managed plugin) or preferably a forked plugin source under a user-owned git repository, then install that source; do not store credentials.

- [ ] **Step 1: Preserve** the plugin changes outside the catalog-managed install path, so a `hermes plugins update hindsight` cannot silently remove them. Use a local git repository or a patch file with its own SHA check.
- [ ] **Step 2: Run** the full plugin tests and an actual fresh-session prompt probe; report exact results and any unsupported page access affordance separately.
