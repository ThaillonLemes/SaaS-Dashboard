/**
 * INVARIANT: Domain-error base for `packages/integrations`.
 *
 * Every connector operation that fails raises this class with a stable
 * `code` discriminant. The four codes partition the error space:
 *
 * - `CONNECTION_FAILED` — TCP / TLS / DNS failure reaching the ERP.
 * - `AUTH_FAILED` — credentials rejected by the ERP.
 * - `PULL_FAILED` — request reached the ERP but returned a non-success
 *   response (4xx other than 401/429, 5xx).
 * - `RATE_LIMITED` — ERP throttled the request (HTTP 429 or equivalent).
 *
 * Per TS4, thrown inside the package; cross-domain consumers (the pull
 * scheduler in block-028) convert to a typed `Result` shape at the
 * package boundary.
 */
export class IntegrationError extends Error {
  constructor(
    public readonly code:
      | 'CONNECTION_FAILED'
      | 'AUTH_FAILED'
      | 'PULL_FAILED'
      | 'RATE_LIMITED',
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}
