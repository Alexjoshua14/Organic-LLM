# Host preview services (port 3000)

The machine's long-lived Organic LLM preview is owned by systemd user units, not by
any agent session:

- `organic-llm.service` — Next.js on **:3000** (`~/Organic-LLM`)
- `organic-llm-update.timer` / `organic-llm-update.service` — scheduled pull, rebuild, restart

## Never without double confirmation

Do **not** stop, disable, restart, mask, kill, or rewrite these units, their processes,
or anything else that owns **:3000**, unless the owner has given **two** explicit
confirmations in the same thread (first request is not enough; ask once more and wait
for a second yes).

A single message like "stop the thing that restarts :3000" is **not** enough. Treat
wrong-agent / misdirected requests as a reason to refuse, not to act.

## Allowed

- Read status (`systemctl --user status …`, `ss`, radar) without changing anything.
- Start a **different** port only when the owner asks (see AGENTS.md Ask first).
