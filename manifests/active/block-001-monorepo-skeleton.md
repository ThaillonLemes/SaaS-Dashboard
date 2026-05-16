---
id: block-001-monorepo-skeleton
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: infrastructure/monorepo
risk: medium
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies: []
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - REPOSITORY_STRATEGY.md
    - protocols/TYPESCRIPT.md
    - decisions/ADR-0001-monorepo.md
    - decisions/ADR-0004-deploy.md
  modify:
    - .gitignore
  create:
    - pnpm-workspace.yaml
    - turbo.json
    - package.json
    - tsconfig.base.json
    - .eslintrc.cjs
    - .prettierrc
    - .nvmrc
benchmarks: []
flags: []
metrics: []
---

# Block 001 — Monorepo skeleton

## 1. Purpose

Land the root tooling that every later block depends on: pnpm workspaces,
turborepo task graph, shared TypeScript config, ESLint with D1
enforcement, Prettier, Node version pin, and the empty `apps/`,
`packages/`, `infrastructure/` directories.

## 2. Dependencies

None. This is the first block.

## 3. Scope (per ADR-0001 and ADR-0004)

### `package.json` (root)

- `"name": "saas"`
- `"private": true`
- `"packageManager": "pnpm@9.x"`
- Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `format`,
  `governor` (wraps `pnpm --filter @saas/orchestrator governor`).
- Block-001 ships **all** root scripts that any later Phase 0 block
  needs, so no later block has to modify `package.json` (single-writer
  per file enforced by `governor conflicts`). Database commands run via
  `npx drizzle-kit <cmd>` directly per Block 002's README — no `db:*`
  script aliases needed at root.
- `devDependencies`: turbo, typescript, eslint + plugins, prettier.

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'orchestrator'
```

### `turbo.json`

Tasks: `build`, `typecheck`, `lint`, `test`, `dev` (persistent, no cache).
`^build` chain for cross-package builds.

### `tsconfig.base.json`

Per [protocols/TYPESCRIPT.md:13-25](../../protocols/TYPESCRIPT.md:13):
`strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride` +
`exactOptionalPropertyTypes` + `noFallthroughCasesInSwitch` +
`noImplicitReturns` + `noPropertyAccessFromIndexSignature`.
Module resolution `bundler`. `target: ES2022`. `moduleDetection: force`.

### `.eslintrc.cjs`

Extends `@typescript-eslint/strict-type-checked`. Enforces:
- `no-restricted-imports` blocking `@saas/*/src/*` (D1).
- `import/order` with alphabetical sort + group newlines.
- `no-default-export: error`.
- `@typescript-eslint/no-explicit-any: error`.
- `@typescript-eslint/no-non-null-assertion: error`.
- `no-console: ['error', { allow: ['warn', 'error'] }]`.

### `.prettierrc`

Minimal config: `semi: true`, `singleQuote: true`, `trailingComma: 'all'`,
`printWidth: 100`.

### `.nvmrc`

`22` (Node 22 LTS).

### `.gitignore` modification

Add common Node.js + workspace artifacts: `node_modules/`, `dist/`,
`.turbo/`, `*.log`, `.env`, `.env.local`, `.DS_Store`, `coverage/`,
`.vitest-cache/`. The existing `.gitignore` content is preserved.

### Directory placeholders

None. Subsequent blocks land real files in `apps/`, `packages/`, and
`infrastructure/`; `.gitkeep` is unnecessary churn (and pushes block-001
over the Tier-M 8-file cap).

## 4. Validation

- `pnpm install` at root succeeds with zero warnings.
- `pnpm typecheck` runs (will be a no-op until packages exist, but turbo
  must accept the task and exit 0).
- `pnpm lint .eslintrc.cjs` self-lints clean.
- `cd orchestrator && npx tsx bin/governor.ts doctor` still PASS 10/10
  (orchestrator deps installable via root `pnpm install`).
- ESLint smoke: create a throwaway `packages/_test/src/deep.ts` that does
  `import { foo } from '@saas/contracts/src/internal/foo'` — ESLint
  reports the no-restricted-imports violation. Remove the throwaway.

## 5. Rollback signals

- `pnpm install` fails on any supported platform (Windows / macOS / Linux).
- ESLint can't load (config error).
- `turbo` exits non-zero on the empty `typecheck` task.

## 6. Expected outcomes

After integration:
- Root `pnpm install` brings up the full workspace.
- Empty `apps/`, `packages/`, `infrastructure/` exist and are
  workspace-scanned by pnpm.
- Every later Phase 0 block (002-009) can create files in its target
  directory and `pnpm install` picks up the new package.
- ESLint's D1 enforcement is live (will start mattering once Block 005+
  create packages).

## 7. Tenant safety check

- [x] N/A — block doesn't touch tenant-scoped data. No tables, no
      runtime code. Pure tooling configuration.

## 8. Cross-domain check

- [x] No deep imports across packages (D1) — configures the lint rule
      that enforces D1 going forward.
- [x] Cross-domain types live in `packages/contracts/` (D2) — none yet;
      Block 004 lands the first.
- [x] No utility duplication (C3) — none introduced.

## 9. Risks

- **Risk:** pnpm version drift between developer machines and CI. **Mitigation:** `packageManager` field in root `package.json` + `.nvmrc` for Node.
- **Risk:** Turborepo remote cache token not configured. **Mitigation:** Block 009 (CI) wires the token; local builds work without it (just less cached).
- **Risk:** ESLint config conflicts with Prettier formatting. **Mitigation:** Use `eslint-config-prettier` (turns off ESLint's formatting rules) — declared as a devDep in this block.

## 10. Out of scope

- CI workflow (Block 009).
- Postgres tooling (Block 002).
- Any package source (Blocks 003-008).
- Production Dockerfiles (Blocks 007, 008).

## 11. New abstraction

None. All choices are off-the-shelf (pnpm, turbo, TS, ESLint, Prettier).
