# `apps/web` — React frontend shell

## Identity

The customer-facing web app for the SaaS workspace. Phase 0 lands a
minimal shell: a placeholder root page plus a non-functional `/login`
form. Phase 1A Block 014 wires real authentication; Phase 1F Blocks
037-042 introduce `@saas/ui-kit` for design primitives.

---

## What this owns

- The browser-side entry point (`src/main.tsx`).
- Route declarations (`src/routes/`).
- The production Dockerfile that builds a static artifact and serves it
  via Caddy.
- The Vite build configuration.

## What this does NOT own

- Authentication logic — Phase 1A `packages/identity` + Block 014.
- Design primitives — Phase 1F `packages/ui-kit`.
- API client / data fetching — added in Phase 1+ once the first real
  endpoint lands; client types will come from `@saas/contracts`.

Per D1, this app never reaches into other packages' internals.

---

## Public surface

This is an application, not a library — there is no `index.ts` public
surface. The user-visible surface is the route tree wired in
`src/main.tsx`:

| Path | Component | Behavior |
|------|-----------|----------|
| `/` | inline element | Placeholder pointing at `/login`. |
| `/login` | `LoginPage` | Email + password form; submit shows a "not implemented" notice. |

---

## Internal structure

```
apps/web/
├── src/
│   ├── main.tsx              ← entry, mounts RouterProvider
│   └── routes/
│       └── login.tsx         ← LoginPage component
├── index.html                ← Vite HTML entry
├── vite.config.ts            ← Vite + React plugin config
├── tsconfig.json             ← extends tsconfig.base.json
├── package.json
├── Dockerfile                ← multi-stage; ADR-0004 portable
└── README.md                 ← this file
```

---

## Dependencies

External (pinned, per TS13):

- `react` 18.3.1 — function components + hooks (R1).
- `react-dom` 18.3.1.
- `react-router-dom` 6.28.0 — data-router mode (R10).
- `vite` 5.4.11 + `@vitejs/plugin-react` 4.3.4 (dev) — bundler.
- `typescript` 5.9.3 (dev) — matches workspace root.

No `@saas/*` dependencies yet. Phase 1F adds `@saas/ui-kit`; Phase 1+
adds an API client whose types come from `@saas/contracts`.

---

## How to run

Local dev:

```
pnpm install
pnpm --filter @saas/web dev
# open http://localhost:5173
```

Build:

```
pnpm --filter @saas/web build
# emits apps/web/dist/
```

Container (from repo root):

```
docker build -f apps/web/Dockerfile -t saas-web .
docker run --rm -p 8080:8080 saas-web
# open http://localhost:8080
```

---

## Cross-cutting concerns

- **Tenancy:** N/A in Phase 0 — the shell has no tenant context. Phase
  1A wires real auth; Phase 1B wires real tenant selection.
- **Observability:** TBD — Phase 1+ introduces the frontend logger.
- **Errors:** Render-time errors surface via React 18 StrictMode in dev;
  production error boundaries land with Phase 1A.

---

## Current state

See [`STATE.md`](../../STATE.md) at the workspace root for cross-domain
state. No local `STATE.md` until active work resumes.

---

## How to add to this app

1. Read [`PROTOCOLS.md`](../../PROTOCOLS.md),
   [`protocols/TYPESCRIPT.md`](../../protocols/TYPESCRIPT.md),
   [`protocols/REACT.md`](../../protocols/REACT.md).
2. Read [`decisions/ADR-0004-deploy.md`](../../decisions/ADR-0004-deploy.md)
   if touching the Dockerfile.
3. Author a block manifest from
   [`templates/manifest-M.md`](../../templates/manifest-M.md).
4. Implement within manifest scope (C2).
5. Validate: `typecheck`, `lint`, `dev`, `build`, container.
6. Open PR; tag for Governor review.
