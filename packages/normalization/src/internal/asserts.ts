/**
 * INVARIANT: Field-presence primitives used by per-entity `validate`
 * functions at the post-map / pre-persist boundary.
 *
 * Each helper accepts `unknown` so the validate sites pass the
 * canonical entity through without per-field type narrowing. Errors
 * are thrown as plain `Error` with messages of the form
 * `'<EntityName>.<field>: <reason>'`; a structured `NormalizationError`
 * lands with Block 033's mapping framework, when there is a per-row
 * batch boundary that wants to attach error metadata.
 *
 * Internal-only module (TS7): not re-exported from the package index.
 */

export function requireString(
  value: unknown,
  entity: string,
  field: string,
): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${entity}.${field}: missing or empty string`);
  }
}

export function requireFiniteNumber(
  value: unknown,
  entity: string,
  field: string,
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${entity}.${field}: missing or not a finite number`);
  }
}

export function requireDate(
  value: unknown,
  entity: string,
  field: string,
): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${entity}.${field}: missing or invalid Date`);
  }
}

export function requireObject(
  value: unknown,
  entity: string,
  field: string,
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${entity}.${field}: must be a plain object`);
  }
}
