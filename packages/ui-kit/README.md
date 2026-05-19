# `packages/ui-kit` — design tokens + ThemeProvider

## Identity

The UI primitives layer for the SaaS frontend. Block 037 ships the
foundation: **design tokens** (colors, spacing, typography) and a
**`ThemeProvider` + `useTheme`** pair that exposes them to React
consumers via context.

All visual primitives in subsequent blocks (forms, layout, table,
charts) read tokens via `useTheme` — never via raw hex / px literals.
Components in `apps/web` follow the same rule (see
[protocols/REACT.md §R8](../../protocols/REACT.md)).

---

## What this owns

- Token objects: `colors`, `spacing`, `typography` (immutable, `as const`).
- The `Theme` and `ThemeMode` type contracts.
- The `ThemeProvider` React component + `useTheme` hook.

## What this does NOT own

- Form primitives (Button, Input, Select) — lives in Block 038.
- Layout primitives (Stack, Grid, Box) — lives in Block 039.
- Data primitives / Table — lives in Block 040.
- Chart wrappers — lives in Block 041.
- App-level theming choices (light/dark toggle UI, persistence) — lives in `apps/web`.

Per D1, this package never reaches into other packages' internals.

---

## Public surface (`src/index.ts`)

```ts
export { colors, spacing, typography } from './tokens/*';
export { ThemeProvider, useTheme } from './theme/*';
export type { Theme, ThemeMode } from './theme/ThemeProvider';
```

Tokens are plain objects — no CSS-in-JS runtime. Consumers apply them
as inline styles, Tailwind class composition, or via primitives
introduced in later blocks.

---

## Internal structure

```
packages/ui-kit/
├── src/
│   ├── index.ts                ← public surface
│   ├── tokens/
│   │   ├── colors.ts           ← brand / neutral / success / warning / error
│   │   ├── spacing.ts          ← 4px base grid
│   │   └── typography.ts       ← fontFamily, fontSize, fontWeight, lineHeight
│   └── theme/
│       ├── ThemeProvider.tsx   ← React context provider
│       └── useTheme.ts         ← hook (throws outside provider)
├── __tests__/
│   └── tokens.test.ts          ← token shape + useTheme behavior
├── package.json
├── tsconfig.json
└── README.md                   ← this file
```

---

## Dependencies

- **Runtime peers:** `react@18.3.1`, `react-dom@18.3.1` — the consuming app provides them.
- **Dev:** `typescript`, `vitest`, `@testing-library/react`, `jsdom`, `@types/react`, `@types/react-dom`, `@types/node`.

No deep imports from any `@saas/*` package (D1). The package consumes
no cross-domain contracts — UI primitives are upstream of business
logic.

---

## Database tables

None. UI-only package, zero I/O, zero tenant data (the tenant safety
check in the block manifest is therefore N/A).

---

## Cross-cutting concerns

- **Tenancy:** N/A — pure UI primitives.
- **Observability:** none in Block 037; future interactive primitives will emit instrumentation per [protocols/REACT.md §R12](../../protocols/REACT.md).
- **Errors:** `useTheme` throws a plain `Error` when called outside `<ThemeProvider>`. No custom error class — the message is the contract.
- **Styling approach:** TBD at Phase 1F start (see [protocols/REACT.md §R6](../../protocols/REACT.md)). Tokens are styling-agnostic.

---

## Testing

```
pnpm --filter @saas/ui-kit test
```

Block 037 covers:

- `colors.brand[500]` is a non-empty string.
- No token value is `undefined` (recursive walk over `colors`, `spacing`, `typography`).
- `useTheme` inside `<ThemeProvider>` returns the resolved theme with token identity preserved.
- `useTheme` outside `<ThemeProvider>` throws an error whose message names the provider.

Tests use `@testing-library/react`'s `renderHook` under `jsdom`. The
`// @vitest-environment jsdom` directive at the top of the test file
keeps the env opt-in per file — no shared `vitest.config.ts`.

---

## Current state

Block 037 (this block) is the only landed block. Phase 1F continues:

- **Block 038** — form primitives (Button, Input, Select, Field).
- **Block 039** — layout primitives (Stack, Grid, Box).
- **Block 040** — Table primitive + virtualization.
- **Block 041** — chart wrappers.

---

## How to add to this domain

1. Read this file + [`PROTOCOLS.md`](../../PROTOCOLS.md) + [`protocols/TYPESCRIPT.md`](../../protocols/TYPESCRIPT.md) + [`protocols/REACT.md`](../../protocols/REACT.md).
2. Author a block manifest from [`templates/manifest-M.md`](../../templates/manifest-M.md).
3. Components consume tokens via `useTheme` — never raw literals.
4. Validate: `pnpm --filter @saas/ui-kit typecheck && pnpm --filter @saas/ui-kit lint && pnpm --filter @saas/ui-kit test`.
5. Open PR; tag for Governor review.
