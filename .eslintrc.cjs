'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always',
      },
    ],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@saas/*/src/*'],
            // WHY: D1 — inter-package deep imports break domain isolation; import from the package index instead.
            message:
              'Deep imports are forbidden (D1). Import from the package public index instead.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
      extends: [
        'plugin:@typescript-eslint/strict-type-checked',
        'plugin:import/typescript',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
      },
    },
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  ignorePatterns: ['dist/', 'node_modules/', '.turbo/', 'coverage/', '.vitest-cache/'],
};
