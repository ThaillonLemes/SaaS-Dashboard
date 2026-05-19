---
id: block-037-ui-kit-design-tokens
tier: M
kind: implementation
phase: Phase 1F — UI-Kit
scope: phase-bound
status: Complete
domain: packages/ui-kit
risk: low
performance_critical: false
created_at: 2026-05-16
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-008-web-shell
parallel_with:
  - block-011-identity-password-auth
  - block-018-tenancy-tenant-table
  - block-025-integrations-connector-interface
  - block-031-normalization-canonical-model
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/REACT.md
    - apps/web/package.json
    - decisions/ADR-0001-monorepo.md
  modify: []
  create:
    - packages/ui-kit/package.json
    - packages/ui-kit/tsconfig.json
    - packages/ui-kit/README.md
    - packages/ui-kit/src/index.ts
    - packages/ui-kit/src/tokens/colors.ts
    - packages/ui-kit/src/tokens/spacing.ts
    - packages/ui-kit/src/tokens/typography.ts
    - packages/ui-kit/src/theme/ThemeProvider.tsx
    - packages/ui-kit/src/theme/useTheme.ts
    - packages/ui-kit/__tests__/tokens.test.ts
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 037 — Design tokens + theme provider

## 1. Purpose

Bootstrap `packages/ui-kit` with design tokens (colors, spacing, typography)
and a React `ThemeProvider` + `useTheme` hook. All UI components in
subsequent blocks consume tokens via `useTheme`, never raw CSS values.

## 2. Dependencies

- Block 001 — workspace tooling (tsconfig, eslint).
- Block 008 — `apps/web` shell (React + Vite already wired; `@saas/ui-kit` will be consumed there from Phase 2).

## 3. Scope

### Design tokens

```ts
// tokens/colors.ts
export const colors = {
  brand: { 50: '#...', 500: '#...', 900: '#...' },
  neutral: { 0: '#fff', 50: '#...', 900: '#111' },
  success: { 500: '#...' },
  warning: { 500: '#...' },
  error:   { 500: '#...' },
} as const;

// tokens/spacing.ts — 4px base grid: 0, 4, 8, 12, 16, 24, 32, 48, 64
// tokens/typography.ts — font families, sizes, weights, line-heights
```

All tokens are `as const` objects — no runtime overhead, type-safe.

### `ThemeProvider` + `useTheme`

Minimal React context providing the token object. Supports `light` / `dark`
mode toggle via a `mode` prop. No external CSS-in-JS dependency — tokens
are plain objects; consumers apply them as inline styles or Tailwind classes.

### Public surface (`src/index.ts`)

Exports: `ThemeProvider`, `useTheme`, `colors`, `spacing`, `typography`, token types.

## 4. Validation

- `pnpm --filter @saas/ui-kit typecheck` passes.
- `pnpm --filter @saas/ui-kit lint` passes.
- `pnpm --filter @saas/ui-kit test` passes:
  - Token objects are well-formed (no undefined values, correct shapes).
  - `useTheme` returns the token object when rendered inside `ThemeProvider`.
  - Renders outside `ThemeProvider` throw a clear error (not silent).

## 5. Tenant safety check

- [x] N/A — pure UI primitives, no tenant data.

## 6. Out of scope

- Form primitives (Block 038).
- Layout primitives (Block 039).
- Data primitives / Table (Block 040).
- Chart wrappers (Block 041).
- Integration with `apps/web` (Phase 2 blocks consume `@saas/ui-kit`).
