---
id: block-040-ui-kit-data-table
tier: M
kind: implementation
phase: Phase 1F — UI Kit
scope: phase-bound
status: Pending
domain: packages/ui-kit
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-037-ui-kit-design-tokens
  - block-038-ui-kit-forms
  - block-039-ui-kit-layout
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/REACT.md
    - packages/ui-kit/src/index.ts
    - packages/ui-kit/src/tokens.ts
    - packages/ui-kit/src/components/forms/index.ts
    - packages/ui-kit/src/components/layout/index.ts
  modify:
    - packages/ui-kit/src/index.ts
  create:
    - packages/ui-kit/src/components/data/DataTable.tsx
    - packages/ui-kit/src/components/data/index.ts
    - packages/ui-kit/__tests__/data-table.test.tsx
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 040 — Data table

## 1. Purpose

A generic `DataTable` component with client-side sort, column visibility,
and pagination. Used by every data-heavy screen (products, customers, orders).

## 2. Dependencies

- Block 037 — tokens (colors, spacing).
- Block 038 — `Input` (search filter box), `Button` (pagination controls).
- Block 039 — `Card` (table wrapper surface).

## 3. Scope

### `packages/ui-kit/src/components/data/DataTable.tsx`

```tsx
export interface ColumnDef<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string | number;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T) => string;

  // Pagination
  pageSize?: number;           // default 20
  pageSizeOptions?: number[];  // default [10, 20, 50]

  // Search
  searchable?: boolean;        // default false
  searchPlaceholder?: string;

  // State callbacks (for controlled usage)
  onRowClick?: (row: T) => void;

  // Empty state
  emptyMessage?: string;

  className?: string;
}

export function DataTable<T extends Record<string, unknown>>(
  props: DataTableProps<T>
): React.ReactElement;
```

Internal client-side state:
- `sortColumn` + `sortDirection` — toggled by clicking a sortable column header.
- `currentPage` — reset to 1 when sort or search changes.
- `searchQuery` — filters rows by string match across all visible columns.

### `packages/ui-kit/src/components/data/index.ts`

Re-exports `DataTable`, `ColumnDef`, `DataTableProps`.

### `packages/ui-kit/__tests__/data-table.test.tsx`

- Renders `data` rows with correct column values.
- Clicking a sortable column header toggles asc → desc → asc.
- Pagination: page 2 shows the correct rows slice.
- Search: typing "abc" filters rows to those matching "abc".
- `onRowClick` fires with the correct row object.
- Empty state: renders `emptyMessage` when `data` is `[]`.

## 4. Validation

- `pnpm --filter @saas/ui-kit typecheck` passes (generic `T` must not
  produce `any` or `unknown` in column render path).
- `pnpm --filter @saas/ui-kit lint` passes.
- `pnpm --filter @saas/ui-kit test` passes.

## 5. Performance note

Client-side sort/filter is acceptable for Phase 1 (≤ 500 rows). Server-side
pagination is a Phase 2 concern. Do not pre-optimize.
