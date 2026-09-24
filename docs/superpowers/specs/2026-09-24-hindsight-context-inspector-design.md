# Hindsight page catalog and visible context in Hermes Desktop

## Goal and scope

Keep the existing global `$HERMES_HOME/SOUL.md` text unchanged; the OMP `APPEND_SYSTEM.md` lines remain appended after it. At session start, offer a compact index of the active Hindsight bank's knowledge pages in the model's system prompt, analogous to the skills index. In Hermes Desktop, let the user inspect every non-chat input that reaches the model as collapsed, source-labelled blocks near the turn where it first applies. Also offer an on-demand, redacted view of the actual model request for exact diagnostics.

This is a local Hermes customization, not a Hindsight server change. Do not mutate any bank, page, or existing SOUL text. Other Hermes surfaces need not render the new cards, but must continue to work with the same session and transport data.

## Catalog design

- The installed Hindsight provider is the owner of its own page index. On provider initialization, fetch the active bank's `/v1/default/banks/{bank_id}/knowledge-base/tree` using the provider's existing endpoint and scoped credentials. Resolve the bank *after* any `bank_id_template` expansion. Traverse folders and pages; display page name plus a short, whitespace-normalized excerpt of its description. Descriptions are Hindsight's `source_query` specs, not page bodies; omit bodies and internal IDs from the model-facing index.
- Bound the index by per-page description length and total characters. Sort deterministically by folder path and title. Give a truncated-catalogue notice if the complete list exceeds the budget, rather than implying completeness. Treat page names/descriptions as untrusted data and never promote them to instructions; use a clear data-only catalog wrapper and the existing prompt redaction/guard where appropriate. Avoid credential values even if a source description contains one.
- Append this index to the Hindsight `system_prompt_block()` only when the provider is active and a fetch succeeds. Failure or timeout leaves the normal Hindsight prompt intact, surfaces a visible warning, and never blocks agent startup. Fetch once per agent/session, not on each turn; the system prompt remains byte-stable for prompt caching. A new session sees newer pages; a running session does not silently change its catalog.
- The index tells the model that the entries identify available knowledge pages, not that their bodies were loaded. A page read/search is a separate operation; do not claim `hindsight_recall` reads page bodies directly. A follow-up page-access affordance may use the existing authenticated API, but is outside this feature's write scope.

## Desktop visibility design

- DSH-style rows: a collapsed **System prompt** block for the complete system text; collapsed **Context injection** blocks for named producers (Hindsight prefetch, project/context files, skills, hooks and any other actual injected material); and a **Tools** disclosure for tool schemas when they first appear or change. Rows appear next to the corresponding turn, not as assistant messages, and preserve source labels. Expanding a row shows line breaks and text with bounded scrolling and copy affordance. There is no injection block for an empty or failed injection; error/warning state is distinct from model-visible data.
- An on-demand **Model request** detail shows the post-middleware payload actually submitted to the model, including message roles and tools, not a reconstruction from current configuration. It is secondary to the concise transcript blocks and is never automatically expanded. The entire request and all blocks are redacted with Hermes's existing secret-redaction boundary before they cross to Desktop or land on disk. Label redacted content explicitly; a masked request is not byte-identical to what the model received.
- Capture at the existing request-assembly boundary after middleware, using the same payload the model call uses. Reuse the existing pre-request observer/debug-dump seam where feasible, rather than duplicating prompt assembly. Attribute blocks by producer from the assembling path; if attribution is unavailable, show `Other context` containing the actual text rather than silently dropping it. Do not show prior chat turns twice in the transcript: history is already visible; it remains inspectable in Model request detail.
- Persist redacted per-request snapshots scoped to profile, session and turn so blocks survive reconnect, resume and app restart. Store only snapshots that correspond to an attempted model call; do not infer them from a later `/context` estimate. Follow existing append-only session ordering and compression lineage. A large request is bounded for UI delivery; when its detail is too large, mark truncation and offer the owner-only local debug artifact rather than displaying an incomplete view as complete. Prune with the session's existing lifecycle. Do not broadcast to other profiles or expose through an unauthenticated endpoint.
- Deliver snapshot metadata and body via typed JSON-RPC (or an existing session-history extension if that is already the owning seam); the desktop hydrates historical rows and receives live rows without duplicate cards. Older backends lack this capability: hide the UI affordance rather than simulating it from stale config. Do not alter the request sent to the provider to support presentation.

## UX decisions

- Keep system prompt and skill-like page catalog in the initial system block, and turn-varying Hindsight recall in an injection row. A tooltip/empty state explains the difference between an index entry and loaded page content.
- The chat stays quiet by default: block titles and source are visible, content collapsed. Full request detail is one deliberate click away and carries a local-sensitive-data notice.
- `$HERMES_HOME/SOUL.md` is not replaced by an OMP prompt. The existing default text stays first; appended OMP lines stay after it.

## Verification

1. With a fake Hindsight tree containing folders, pages, overlong descriptions and a credential-like token, test ordering, budgets, redaction, no body leakage and bank/profile isolation. Exercise missing auth, timeout and empty tree: agent startup continues and reports the failure.
2. Through a real agent request path, assert the model receives the catalog on the first turn; a page change during the conversation does not change that system prompt, and a new session sees it. Assert prefetch text and any other injection card match the corresponding redacted request segment; failed injection emits no false content card.
3. Exercise live streaming, reconnect, resume, compaction and profile switch through the gateway and Desktop: no lost/duplicated blocks, no cross-profile reads, and older backend fallback. Test UI collapse/expand/copy and request-detail truncation/redaction.
4. Run focused Hindsight plugin tests, gateway contract generation/tests and Desktop component/build checks. Verify against the live local `master` bank with an actual page-tree read and a fresh Hermes session request; read back the captured context rather than trusting a success return.

## Out of scope

No change to Hindsight page generation/refresh, no automatic full-page ingestion into every turn, no new core model-facing tool, no forced cache-invalidating updates within a conversation, no remote publication of prompt dumps, and no change to other profiles unless requested.
