# Local Hindsight page catalog overlay

`hindsight-page-catalog.patch` is a replayable overlay for the catalog-installed Hindsight provider at upstream commit `176f8c2de1369f569c489b831d143b78128b5535` (`hindsight-integrations/hermes`). It changes the provider's startup prompt, adds bounded metadata-only knowledge-page fetches, and includes tests. The runtime config `$HERMES_HOME/hindsight/config.json` must set `page_index_enabled: true`; this config and API credentials are **not** in Git.

The active installation lives outside this repository at `$HERMES_HOME/plugins/hindsight`. Before updating that catalog plugin, check its pinned upstream version; rebase the overlay if it changed. On the pinned version, from the plugin's directory:

```sh
git apply --check /path/to/hermes-agent/integrations/hindsight-page-catalog.patch
git apply /path/to/hermes-agent/integrations/hindsight-page-catalog.patch
```

`git apply --check` was verified against the pinned upstream tree. Do not reinstall the catalog plugin over the modified copy without reapplying this overlay. Run its `tests/` after applying.

## Desktop request inspector

The Hermes core/renderer changes in this branch capture post-middleware **model-facing body** payloads from Desktop sessions only (transport headers, client objects and timeouts are omitted). In the transcript, each matched user turn gains collapsed System prompt, Memory recall/Other context and Tools rows when those inputs first appear or change, plus an on-demand Model requests detail. Snapshots are stored as profile-local mode-0600 JSONL under `$HERMES_HOME/sessions/context_snapshots/`, never in Git; `session.context_snapshots` reads the current session's compression lineage through its authorized gateway session. Only the last 256 request attempts are delivered, so a very long session can omit older cards. A per-request detail is capped at 400,000 characters and marked truncated; blocks over 100,000 characters carry their own truncation label. Redaction is best-effort using Hermes's secret filter; avoid opening or copying the inspector in an untrusted environment. Existing running gateways/Desktop windows need a restart to load the new code, and a new agent session to pick up a refreshed Hindsight catalog.
