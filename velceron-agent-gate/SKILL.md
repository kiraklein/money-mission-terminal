---
name: velceron-agent-gate
description: Pre-flight governance gate for autonomous actions. Use before external data transfers, production changes, monetary actions, regulated decisions, or irreversible actions.
---

# Velceron Agent Gate

Call Velceron before executing a consequential action.

REST endpoint:
`POST https://runwayzero-aegis-1435.vercel.app/api/velceron/v1/evaluate`

MCP endpoint:
`https://runwayzero-aegis-1435.vercel.app/api/velceron/mcp`

Send a JSON object containing at least `action`. Useful fields include `destination`, `environment`, `data_categories`, `jurisdiction`, `amount_usd`, `has_human_approval`, and `reversible`.

Interpret the response:
- `allow`: action may proceed under the supplied policy context.
- `review`: pause execution and obtain the listed controls/approval.
- `block`: do not execute until the blocking condition is removed.

Velceron is a policy engine, not a legal opinion or regulatory certification.
