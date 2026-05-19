---
id: block-039-ui-kit-layout
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
  - block-038-ui-kit-forms
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
    - packages/ui-kit/src/components/layout/Stack.tsx
    - packages/ui-kit/src/components/layout/Grid.tsx
    - packages/ui-kit/src/components/layout/Card.tsx
    - packages/ui-kit/src/components/layout/Sidebar.tsx
    - packages/ui-kit/src/components/layout/index.ts
    - packages/ui-kit/__tests__/layout.test.tsx
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 039 — Layout primitives

## 1. Purpose

Structural layout components that every dashboard screen composes.
Tokens-driven; no hardcoded pixel values.

## 2. Dependencies

- Block 037 — design tokens (spacing scale, breakpoints, shadow).

## 3. Scope

### `packages/ui-kit/src/components/layout/Stack.tsx`

```tsx
interface StackProps {
  direction?: 'row' | 'column';   // default: 'column'
  gap?: keyof typeof tokens.spacing; // default: '4'
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
  children: React.ReactNode;
  className?: string;
}
export const Stack: React.FC<StackProps>;
```

Thin flexbox wrapper. Gap values map to token spacing scale.

### `packages/ui-kit/src/components/layout/Grid.tsx`

```tsx
interface GridProps {
  columns?: number | string;  // CSS grid-template-columns value or column count
  gap?: keyof typeof tokens.spacing;
  children: React.ReactNode;
  className?: string;
}
export const Grid: React.FC<GridProps>;
```

### `packages/ui-kit/src/components/layout/Card.tsx`

```tsx
interface CardProps {
  padding?: keyof typeof tokens.spacing;  // default: '6'
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  children: React.ReactNode;
  className?: string;
}
export const Card: React.FC<CardProps>;
```

Rounded bordered surface from the token palette.

### `packages/ui-kit/src/components/layout/Sidebar.tsx`

```tsx
interface SidebarProps {
  nav: React.ReactNode;       // navigation slot
  children: React.ReactNode;  // main content slot
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  width?: number;             // pixels, default 240
}
export const Sidebar: React.FC<SidebarProps>;
```

Two-column layout: fixed-width sidebar + fluid main content.
`collapsed` renders sidebar at icon-only width (48 px).

### `packages/ui-kit/src/components/layout/index.ts`

Re-exports `Stack`, `Grid`, `Card`, `Sidebar` and their prop types.

### `packages/ui-kit/__tests__/layout.test.tsx`

- `Stack` renders children with correct flex direction.
- `Grid` renders children in a grid container.
- `Card` renders with and without border/shadow class names.
- `Sidebar` renders nav slot and children; `collapsed` adds collapsed class.

## 4. Validation

- `pnpm --filter @saas/ui-kit typecheck` passes.
- `pnpm --filter @saas/ui-kit lint` passes.
- `pnpm --filter @saas/ui-kit test` passes.
