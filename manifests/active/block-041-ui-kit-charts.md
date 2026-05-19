---
id: block-041-ui-kit-charts
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
  - block-039-ui-kit-layout
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
    - packages/ui-kit/src/components/charts/LineChart.tsx
    - packages/ui-kit/src/components/charts/BarChart.tsx
    - packages/ui-kit/src/components/charts/PieChart.tsx
    - packages/ui-kit/src/components/charts/index.ts
    - packages/ui-kit/__tests__/charts.test.tsx
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 041 — Chart wrappers

## 1. Purpose

Thin, typed wrappers around Recharts that apply design-token colours and
sensible defaults so feature teams never import Recharts directly.

## 2. Dependencies

- Block 037 — token colour palette (used as default chart series colours).
- Recharts must be added to `packages/ui-kit/package.json` if not already present.

## 3. Scope

### `packages/ui-kit/src/components/charts/LineChart.tsx`

```tsx
export interface LineSeries {
  key: string;
  label: string;
  color?: string;      // defaults to tokens.colors.chart[n]
}

export interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: LineSeries[];
  height?: number;          // default 300
  showGrid?: boolean;       // default true
  showLegend?: boolean;     // default true
  className?: string;
}
export const LineChart: React.FC<LineChartProps>;
```

Wraps Recharts `<ComposedChart>` / `<Line>`. Responsive via `ResponsiveContainer`.

### `packages/ui-kit/src/components/charts/BarChart.tsx`

```tsx
export interface BarSeries {
  key: string;
  label: string;
  color?: string;
  stacked?: boolean;
}

export interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  layout?: 'vertical' | 'horizontal';  // default 'horizontal'
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}
export const BarChart: React.FC<BarChartProps>;
```

### `packages/ui-kit/src/components/charts/PieChart.tsx`

```tsx
export interface PieSlice {
  name: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieSlice[];
  height?: number;
  innerRadius?: number;   // > 0 → donut chart
  showLegend?: boolean;
  showLabels?: boolean;
  className?: string;
}
export const PieChart: React.FC<PieChartProps>;
```

### `packages/ui-kit/src/components/charts/index.ts`

Re-exports `LineChart`, `BarChart`, `PieChart` and their prop types.

### `packages/ui-kit/__tests__/charts.test.tsx`

Use `@testing-library/react` with Recharts mocked at module level
(`vi.mock('recharts', ...)`):
- `LineChart` renders without error given minimal `data` + `series`.
- `BarChart` renders for both `horizontal` and `vertical` layouts.
- `PieChart` renders with and without `innerRadius` (donut vs pie).
- Default token colours are applied when no `color` is specified on a series.

## 4. Validation

- `pnpm --filter @saas/ui-kit typecheck` passes.
- `pnpm --filter @saas/ui-kit lint` passes.
- `pnpm --filter @saas/ui-kit test` passes.

## 5. Constraint

Do **not** import Recharts types into `packages/ui-kit/src/index.ts` barrel.
Only the wrapper component types are public. Recharts is an implementation
detail.
