/**
 * INVARIANT: Spacing scale on a 4px base grid. Keys are multipliers of
 * 4px; values are pixels. Components compose layout from this scale —
 * raw pixel values in `apps/web` are a lint flag.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;
