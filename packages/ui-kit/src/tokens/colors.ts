/**
 * INVARIANT: All color tokens are non-empty hex strings. Components
 * consume `colors` via {@link useTheme}, never as raw literals.
 */
export const colors = {
  brand: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a8a' },
  neutral: {
    0: '#ffffff',
    50: '#f9fafb',
    200: '#e5e7eb',
    600: '#4b5563',
    900: '#111827',
  },
  success: { 500: '#22c55e' },
  warning: { 500: '#f59e0b' },
  error: { 500: '#ef4444' },
} as const;
