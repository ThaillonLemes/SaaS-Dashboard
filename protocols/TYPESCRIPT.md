# TypeScript Addendum

_Extends `./PROTOCOLS.md` with TypeScript-specific rules. Loaded for any TS code (all packages and apps in this project)._

These rules implement the universal axioms (P/Q/C/D/T) for TypeScript.

---

## TS1 — Strict mode mandatory

`tsconfig.base.json` carries:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

Every package's `tsconfig.json` extends this. Per-package opt-outs require an
`Axiom override:` in the manifest.

---

## TS2 — No `any`, no `as`, no `@ts-ignore`

- **`any`** is forbidden outside declared FFI boundaries (e.g., third-party libraries with bad types). When unavoidable, use `unknown` and refine.
- **Type assertions (`as`)** require a comment explaining why the type system can't prove the assertion. Bare `as` is forbidden.
- **`@ts-ignore`** and **`@ts-expect-error`** require a comment naming the issue and a tracked TODO (Tier C):
  ```ts
  // @ts-expect-error: react-query v5 generic signature changed — fix in block-099 (https://issue/123)
  ```

---

## TS3 — Branded types for invariants

Per Q2, encode invariants in types. Use branded types for primitive-shaped
values that carry semantic meaning:

```ts
// In packages/contracts/src/identity/
export type UserId = string & { readonly __brand: 'UserId' };
export type TenantId = string & { readonly __brand: 'TenantId' };
export type Email = string & { readonly __brand: 'Email' };

// Constructors validate, then brand:
export function asEmail(raw: string): Email {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) throw new InvalidEmailError(raw);
  return raw as Email;
}
```

A function accepting `Email` is guaranteed by the type system that the value
is validated. No internal `if (isValidEmail(x))` checks.

---

## TS4 — Errors are values

Per P4 + Q2, errors are explicit. Choose ONE error strategy and stick to it
within a package (C1).

**Style A — Result type (preferred for libraries, contracts):**

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export async function authenticate(creds: Credentials): Promise<Result<Session, AuthError>> {
  // ...
}
```

**Style B — Thrown errors (acceptable for app code, async handlers):**

```ts
export async function authenticate(creds: Credentials): Promise<Session> {
  if (!validCredentials) throw new AuthError('invalid credentials');
  return session;
}
```

Pick one per package. Cross-package contracts in `packages/contracts/` always
use Style A (no thrown errors crossing package boundaries — they don't survive
serialization).

---

## TS5 — Discriminated unions over inheritance

For variants, use discriminated unions:

```ts
export type SyncResult =
  | { kind: 'success'; recordsProcessed: number }
  | { kind: 'partial'; recordsProcessed: number; errors: SyncError[] }
  | { kind: 'failure'; error: SyncError };
```

No class hierarchies for variant types. `switch (x.kind)` is exhaustive when
`strict: true`.

---

## TS6 — Async patterns

- `async` / `await` everywhere; no `.then().catch()` chains in committed code.
- Errors caught at boundaries (HTTP handlers, queue consumers, top-level CLI commands), not at every call site.
- Concurrent work via `Promise.all` for fan-out; `p-map` or similar for bounded parallelism.

---

## TS7 — Module imports

- Path aliases for cross-package (`@saas/identity`, `@saas/contracts`).
- Relative imports only within the same package's `src/`.
- Sort: external → internal aliases → relative. Alphabetical within group. Enforced by ESLint `import/order`.
- Public surface of a package is `index.ts` — barrel exports only there.
- Internal modules under `src/internal/` are not re-exported.

---

## TS8 — No default exports

Named exports only. Default exports break refactoring, dual-name imports, and
make tree-shaking less reliable.

Exception: React component entry points where the bundler convention expects
a default export (page components in Next.js, for instance). Document in
manifest.

---

## TS9 — Function vs class

Prefer functions and modules over classes. Use classes when:
- The thing has clear identity and lifecycle (e.g., `Connection`, `Cache`).
- The thing has state that must be encapsulated.

Don't use classes for:
- Pure data transformation (use functions).
- "Service" wrappers around a few functions (use a module).
- Grouping unrelated utilities.

---

## TS10 — No mutation of inputs

Function arguments are read-only by convention. Use `readonly` on parameter
types where helpful:

```ts
export function summarize(records: ReadonlyArray<Record>): Summary { ... }
```

If a function needs to mutate, it returns the mutated value (or the function
is a method on a class with explicit state).

---

## TS11 — Lint bar: ESLint + Prettier, both `-D`

Both enforced with `--max-warnings 0`. ESLint config:

```js
// Root .eslintrc.cjs
{
  extends: [
    'eslint:recommended',
    '@typescript-eslint/strict-type-checked',
    'plugin:import/typescript',
  ],
  rules: {
    'no-default-export': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'import/order': ['error', { 'newlines-between': 'always' }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
}
```

No formatting churn in commits. Format-on-save.

---

## TS12 — Tests colocated

- Unit tests in `*.test.ts` next to the file under test, OR in `src/__tests__/<name>.test.ts`.
- Integration tests in `tests/` at the package root.
- E2E tests in `apps/web/e2e/` (Playwright).
- Test names: `it('<behavior>', ...)` with sentences, not snake_case.

---

## TS13 — Dependency hygiene

- Workspace dependencies: `"@saas/identity": "workspace:*"`.
- External deps pinned to exact versions (`"react": "18.3.1"`) — no `^` or `~`.
- New external dep requires manifest authority (new dependency = new abstraction surface).

---

## Patterns specific to backend (apps/api, packages/*)

- HTTP framework: TBD (Fastify recommended for performance + types; alternatives: Hono, Express).
- DB driver: TBD per Database protocol. Likely `pg` + a query builder (`drizzle`, `kysely`) or `prisma`.
- Logging: via `packages/observability` — never `console.log`.
- Background jobs: bullmq / pg-boss / sql-based queue — to be decided in Phase 1.

---

## Patterns specific to frontend (apps/web, packages/ui-kit)

See `protocols/REACT.md`.
