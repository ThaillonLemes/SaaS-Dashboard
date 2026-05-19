import { useContext } from 'react';

import { ThemeContext, type Theme } from './ThemeProvider';

/**
 * Read the active theme from the nearest {@link ThemeProvider}.
 *
 * Throws when called outside a provider so callers can rely on the
 * theme being non-null without defensive checks. A silent fallback
 * would mask missing-provider bugs in apps/web; an explicit throw
 * surfaces them at the first render.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(
      'useTheme must be called inside a <ThemeProvider>. Wrap your component tree with <ThemeProvider> from @saas/ui-kit.',
    );
  }
  return theme;
}
