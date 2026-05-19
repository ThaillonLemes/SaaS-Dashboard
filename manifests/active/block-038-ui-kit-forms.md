---
id: block-038-ui-kit-forms
tier: M
kind: implementation
phase: Phase 1F — UI Kit
scope: phase-bound
status: Pending
domain: packages/ui-kit
risk: low
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-037-ui-kit-design-tokens
parallel_with:
  - block-039-ui-kit-layout
  - block-041-ui-kit-charts
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/REACT.md
    - packages/ui-kit/src/index.ts
    - packages/ui-kit/src/tokens.ts
  modify:
    - packages/ui-kit/src/index.ts
  create:
    - packages/ui-kit/src/components/forms/Input.tsx
    - packages/ui-kit/src/components/forms/Select.tsx
    - packages/ui-kit/src/components/forms/Checkbox.tsx
    - packages/ui-kit/src/components/forms/Button.tsx
    - packages/ui-kit/src/components/forms/index.ts
    - packages/ui-kit/__tests__/forms.test.tsx
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 038 — Form primitives

## 1. Purpose

Deliver the core interactive form components that every feature screen in
the dashboard will compose. Built on design tokens from Block 037. No
runtime form-state management is included — consumers wire their own
react-hook-form or controlled state.

## 2. Dependencies

- Block 037 — `tokens.ts` (colors, spacing, border-radius, font sizes).

## 3. Scope

### `packages/ui-kit/src/components/forms/Input.tsx`

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}
export const Input: React.FC<InputProps>;
```

- Renders `<label>` + `<input>` + optional error/helper text.
- Applies design token classes for focus ring, border, and error state.
- Forwards `ref`.

### `packages/ui-kit/src/components/forms/Select.tsx`

```tsx
interface SelectOption { label: string; value: string }
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}
export const Select: React.FC<SelectProps>;
```

### `packages/ui-kit/src/components/forms/Checkbox.tsx`

```tsx
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
export const Checkbox: React.FC<CheckboxProps>;
```

### `packages/ui-kit/src/components/forms/Button.tsx`

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;   // default: 'primary'
  size?: ButtonSize;          // default: 'md'
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}
export const Button: React.FC<ButtonProps>;
```

- `loading` shows a spinner and disables the button.
- All variants use design token colors.

### `packages/ui-kit/src/components/forms/index.ts`

Re-exports `Input`, `Select`, `Checkbox`, `Button`, and their prop types.

### `packages/ui-kit/__tests__/forms.test.tsx`

Use `@testing-library/react`:
- `Input` renders label, input, error text.
- `Input` forwards ref.
- `Button` renders children; `loading` disables button and shows spinner.
- `Select` renders options from `options` prop.
- `Checkbox` calls `onChange` when clicked.

## 4. Validation

- `pnpm --filter @saas/ui-kit typecheck` passes.
- `pnpm --filter @saas/ui-kit lint` passes.
- `pnpm --filter @saas/ui-kit test` passes.

## 5. Accessibility

- All inputs have associated `<label>` (via `htmlFor` or wrapping).
- Error messages are linked via `aria-describedby`.
- `Button[loading]` sets `aria-busy="true"`.
