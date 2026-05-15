# Cross-Domain Features

_Governor-maintained. Lists features that span multiple domain packages and the integration order that makes them work end-to-end._
_Updated as new features emerge or existing ones progress._

A block manifest participating in a feature names it via `Feature:` field.
The Governor uses this file to coordinate cross-domain dependencies and
unblock work.

---

## Active features

_(none yet — initial template)_

When features are active, entries look like:

### Feature: Top customers KPI

**Goal:** Show top N customers by revenue on the main dashboard.

**Domains involved:** `analytics`, `dashboard`, `ui-kit`, `contracts`.

**Contributing blocks:**
- `block-051` — contract types `TopCustomersKpiResult`, `TopCustomersWidget` in `packages/contracts` ✅
- `block-052` — KPI compute in `packages/analytics` (pending)
- `block-053` — Widget definition in `packages/dashboard` (pending, parallel-with 052)
- `block-054` — Chart visualization in `packages/ui-kit` (pending, parallel-with 052 and 053)
- `block-055` — Integration in `apps/web` (pending, depends-on 052, 053, 054)

**Status:** in progress

**Critical path:** block-052 (analytics) typically takes longest; others parallel.

---

## Planned features (not yet started)

_(none yet)_

---

## Completed features (archived for reference)

_(none yet)_

---

## Schema

Each feature entry:
- **Goal** — one-sentence outcome
- **Domains involved** — which packages contribute
- **Contributing blocks** — list per domain with status
- **Status** — overall readiness (planning, in progress, blocked, complete)
- **Critical path** — what currently blocks the feature

When a feature ships, it moves to "Completed features." Old features are not
deleted — they're the historical record of why the system looks the way it does.
