---
id: block-008-web-shell
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: apps/web
risk: low
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/REACT.md
    - decisions/ADR-0001-monorepo.md
    - decisions/ADR-0004-deploy.md
    - templates/domain-doc.md
  modify: []
  create:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/vite.config.ts
    - apps/web/index.html
    - apps/web/src/main.tsx
    - apps/web/src/routes/login.tsx
    - apps/web/Dockerfile
    - apps/web/README.md
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 008 — `apps/web` shell with login route stub

## 1. Purpose

Land the React frontend shell using Vite. Single visible route: `/login`
renders a non-functional login form (form posts nowhere yet — Phase 1A
Block 014 wires real auth). The shell establishes routing, styling
baseline, and a Dockerfile that builds a static artifact servable from
any CDN-friendly container.

## 2. Dependencies

- Block 001 (workspace + root tsconfig + ESLint).

## 3. Stack

- **Build tool:** Vite (per [REPOSITORY_STRATEGY.md:57](../../REPOSITORY_STRATEGY.md:57)).
- **Framework:** React 18+ with function components + hooks.
- **Routing:** `react-router` v6+ (data-router mode).
- **Styling:** CSS Modules baseline; `packages/ui-kit` will own design
  tokens + theme provider in Phase 1F. Block 008 ships zero design tokens
  itself — placeholder inline styles only.
- **State:** none yet — no global state lib chosen until Phase 1+
  forces the decision.

## 4. Public surface (`apps/web/src/main.tsx`)

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage } from './routes/login';

const router = createBrowserRouter([
  { path: '/', element: <div>SaaS — Phase 0 shell. Visit <a href="/login">/login</a>.</div> },
  { path: '/login', element: <LoginPage /> },
]);

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');
createRoot(root).render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>);
```

## 5. `routes/login.tsx`

- Simple form with email + password inputs and a "Sign in" button.
- On submit: shows a placeholder message "Auth not implemented yet —
  Phase 1A Block 014."
- No state library; component-local `useState` only.
- No styling beyond browser defaults (UI-Kit lands in Phase 1F).

## 6. Dockerfile

Per ADR-0004:
- Multi-stage: build with `node:22-alpine`, output static assets.
- Runtime: `nginx:alpine` (or `caddy:alpine`) serving `apps/web/dist/`.
- Listen on `PORT` env (default 8080).
- HEALTHCHECK hits `/`.
- No PaaS-specific deps.

## 7. README

Per `templates/domain-doc.md`. Identity (React frontend), public surface
(routes + page components), dependencies (none from `@saas/*` yet —
Phase 1F adds `@saas/ui-kit`, Phase 1+ adds typed API client from
`@saas/contracts`), how to run locally (`pnpm dev --filter @saas/web`),
how to build (`pnpm build --filter @saas/web`).

## 8. Validation

- `pnpm --filter @saas/web typecheck` passes (TSX strict mode).
- `pnpm --filter @saas/web lint` passes (no default exports per
  TYPESCRIPT.md TS8 — exception for the Vite-required `vite.config.ts`
  default export, documented).
- `pnpm --filter @saas/web dev` boots; `http://localhost:5173` renders
  the placeholder page; `/login` renders the form.
- `pnpm --filter @saas/web build` produces `apps/web/dist/` with
  hashed assets.
- `docker build -f apps/web/Dockerfile .` succeeds.
- `docker run --rm -p 8080:8080 <image>` starts and `/` responds 200.

## 9. Rollback signals

- React 18 strict mode catches a render loop in the shell.
- Vite build fails on the strict `tsconfig.base.json`.
- `dist/` output is bigger than ~200 KB gzipped (sanity check — empty
  shell shouldn't be heavy).

## 10. Expected outcomes

After integration:
- `apps/web` runs locally and as a container.
- Phase 1A Block 014 (login UI) replaces the placeholder login form
  with a real auth flow.
- Phase 1F Blocks 037-042 ship `packages/ui-kit` and `apps/web` consumes
  it for theme + primitives.
- The Frontend App Agent (per [AGENT_OPERATING_MODEL.md:237-262](../../AGENT_OPERATING_MODEL.md:237))
  is the sole writer to `apps/web/` going forward.

## 11. Tenant safety check

- [x] N/A — shell has no tenant context. Login form posts nowhere.
- [x] Phase 1A wires real auth + Phase 1B wires real tenant selection.

## 12. Cross-domain check

- [x] No deep imports across packages (D1) — Block 008 imports only
      external deps (React, react-router, Vite).
- [x] Cross-domain types live in `packages/contracts/` (D2) — none used
      yet.
- [x] No utility duplication (C3) — single frontend app.

## 13. Risks

- **Risk:** Vite default-export requirement for `vite.config.ts` violates TS8 (no-default-export). **Mitigation:** ESLint override scoped to `vite.config.ts` per the TS8 exception clause.
- **Risk:** react-router v6 data-mode learning curve. **Mitigation:** Block 008 uses the simplest possible routes; Phase 1A expands.
- **Risk:** nginx-vs-caddy choice in Dockerfile affects ops. **Mitigation:** Either works; block agent picks; not load-bearing for Phase 0.

## 14. Out of scope

- Real authentication (Phase 1A Block 014).
- Design system (Phase 1F).
- API client / data fetching (Phase 1+ when first real endpoint lands).
- Routing beyond `/` and `/login` (Phase 1A+).
- i18n (Phase 3+ if needed).
- E2E tests with Playwright (Phase 1+ when there's a real flow).

## 15. New abstraction

None. Standard React + Vite + react-router idioms.
