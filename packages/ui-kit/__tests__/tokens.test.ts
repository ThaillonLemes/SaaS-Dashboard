// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ThemeProvider,
  colors,
  spacing,
  typography,
  useTheme,
} from '../src/index';

describe('design tokens', () => {
  it('colors.brand[500] is a non-empty string', () => {
    expect(typeof colors.brand[500]).toBe('string');
    expect(colors.brand[500].length).toBeGreaterThan(0);
  });

  it('no token value is undefined', () => {
    const walk = (
      node: unknown,
      path: ReadonlyArray<string>,
    ): ReadonlyArray<readonly [string, unknown]> => {
      if (node === null || typeof node !== 'object') {
        return [[path.join('.'), node]];
      }
      return Object.entries(node as Record<string, unknown>).flatMap(
        ([key, value]) => walk(value, [...path, key]),
      );
    };
    const entries = walk({ colors, spacing, typography }, []);
    for (const [path, value] of entries) {
      expect(value, `token at ${path} should be defined`).not.toBeUndefined();
    }
  });
});

describe('useTheme', () => {
  it('returns the theme object when called inside ThemeProvider', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ThemeProvider, null, children);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.colors).toBe(colors);
    expect(result.current.spacing).toBe(spacing);
    expect(result.current.typography).toBe(typography);
    expect(result.current.mode).toBe('light');
  });

  it('throws a clear error when called outside a ThemeProvider', () => {
    // WHY: React + jsdom log thrown render errors to stderr by design;
    // silencing keeps the test output focused on the assertion.
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
    } finally {
      errSpy.mockRestore();
    }
  });
});
