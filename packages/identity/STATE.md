# `packages/identity` — Package State

_Local state for the identity domain. Maintained by the Identity Agent._
_Last updated: 2026-05-16 (Block 005 — skeleton)._

---

## Current status

**Skeleton.** Public surface frozen by Block 005. No real
authentication yet — every public function rejects with
`AuthError('NOT_IMPLEMENTED')`.

## Active block

- **Block 005 — identity skeleton** (this block). Lands `package.json`,
  `tsconfig.json`, `src/index.ts`, `src/types.ts`,
  `__tests__/skeleton.test.ts`, `README.md`, and this `STATE.md`.

## Next block (Phase 1A, after block-010 PASS)

- **Block 011 — identity core auth.** Replaces stub bodies for
  `authenticate` and `revokeSession`. Lands `users` table (via the
  Database Agent's matching migration block), password hashing, session
  storage.

Further Phase 1A work:
- **Block 013** — `validateSession` with cache lookup.
- **Block 015** — password reset flow.
- **Block 016** — optional MFA enrollment.

## Public-surface freeze

The signatures below are contractually stable. Phase 1A may add fields
*additively* (e.g. `mfaCode?: string` on `Credentials`); breaking
changes require an L-tier manifest.

```ts
function authenticate(creds: Credentials): Promise<Session>;
function validateSession(token: string): Promise<UserContext>;
function revokeSession(sessionId: string): Promise<void>;
```

## Open questions deferred to Phase 1A

- Session storage: in-process map vs. Postgres-backed vs. Redis. Decided
  at block-011 author time.
- Token format: opaque random vs. signed (JWT). Default leaning opaque
  random + DB lookup for revocability; JWT-style would skip the DB
  round-trip but complicates revoke. ADR to be authored in block-011.
- Password hash: argon2id at default tuning (per OWASP ASVS L2). Pinned
  in block-011's `Dependencies` field.
