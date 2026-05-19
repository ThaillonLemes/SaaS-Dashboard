import { createContext, type ReactElement, type ReactNode } from 'react';

import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

export type ThemeMode = 'light' | 'dark';

/**
 * INVARIANT: The resolved theme exposed to consumers via {@link useTheme}.
 *
 * Token objects are references (not copies) — `theme.colors === colors`.
 * Block 037 ships a single token set; light/dark divergence is tracked
 * by `mode` only. Phase 2 may swap palettes per mode without changing
 * this contract's shape.
 */
export interface Theme {
  readonly mode: ThemeMode;
  readonly colors: typeof colors;
  readonly spacing: typeof spacing;
  readonly typography: typeof typography;
}

/**
 * INVARIANT: Read via {@link useTheme} only, which throws when the
 * provider is missing. `null` is the sentinel for "no provider above"
 * and is never a valid theme value.
 */
export const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly mode?: ThemeMode;
}

/**
 * Provide the design-token theme to a React subtree.
 *
 * Tokens are plain objects (no CSS-in-JS runtime). Consumers apply them
 * as inline styles, Tailwind class composition, or via downstream
 * theming primitives introduced in later blocks.
 */
export function ThemeProvider({
  children,
  mode = 'light',
}: ThemeProviderProps): ReactElement {
  const theme: Theme = { mode, colors, spacing, typography };
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}
