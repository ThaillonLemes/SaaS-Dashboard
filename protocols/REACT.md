# React Addendum

_Extends `./PROTOCOLS.md` + `./protocols/TYPESCRIPT.md` with React-specific rules. Loaded when working in `apps/web/` or `packages/ui-kit/`._

---

## R1 — Function components + hooks only

No class components. State via `useState` / `useReducer` / `useContext`. No
exceptions.

---

## R2 — Server / client / shared state

Choose the smallest scope that works:

| Scope | Use for |
|-------|---------|
| **URL state** (query params) | Shareable, linkable state (current filter, dashboard ID) |
| **Server state** (TanStack Query / SWR) | Anything fetched from the API |
| **Component state** (`useState`) | UI ephemeral (form input being typed, modal open) |
| **Context** (`useContext`) | Truly cross-cutting (theme, auth user, current tenant) |
| **Global store** (Zustand / Jotai) | Only with manifest authority — adding a global store is a new abstraction |

Default: try URL state first, then server state, then component state.

---

## R3 — Server state via TanStack Query

Standard for data fetching:

```ts
const { data, error, isLoading } = useQuery({
  queryKey: ['dashboard', dashboardId],
  queryFn: () => api.dashboard.get(dashboardId),
});
```

Never bare `useEffect(() => { fetch(...) })`. Manual data fetching in
components is forbidden — use the query layer.

---

## R4 — Form library

One form library across the app. Recommended: `react-hook-form` + `zod` for
validation. Validation schemas live alongside the form, NOT in the components
of UI primitives.

---

## R5 — Component file structure

```
packages/ui-kit/src/components/Button/
├── Button.tsx           ← component
├── Button.test.tsx      ← unit tests
├── Button.stories.tsx   ← Storybook (if used)
├── Button.types.ts      ← type definitions if non-trivial
└── index.ts             ← named exports
```

Or simpler (preferred for small components):

```
packages/ui-kit/src/components/Button.tsx
packages/ui-kit/src/components/Button.test.tsx
```

Don't mix patterns within a single package (C1).

---

## R6 — Styling

Choose ONE approach for the project:

| Approach | When |
|----------|------|
| **CSS modules** | Default; per-component scope, easy to reason about |
| **Tailwind CSS** | If utility-first fits the design language; consider for prototype velocity |
| **CSS-in-JS** (Emotion, styled-components) | Avoid — runtime cost, harder to optimize |

Decision: **TBD at Phase 1F start.** Whichever is chosen, it's the only one.
No mixing.

---

## R7 — Accessibility

- All interactive components have a keyboard interaction model.
- Form inputs have explicit `<label>` + `htmlFor` + `aria-describedby` for errors.
- Modal / drawer components implement focus trap.
- Use `aria-live` for dynamic content updates.
- Test with keyboard-only navigation.

`packages/ui-kit/` exports accessible primitives; `apps/web/` uses them.
Implementing custom accessibility behaviors in `apps/web/` is a flag — likely
the primitive belongs in `ui-kit/`.

---

## R8 — Component public API

For `packages/ui-kit/` components:

- Props are explicitly typed (no `React.HTMLAttributes` extension without reason).
- Default props via destructuring assignment in the signature, not `defaultProps` (deprecated).
- `ref` forwarded if the primitive wraps a focusable element.
- Composability via children (`children: ReactNode`).
- No internal styling escape hatches (no `style={...}` prop on primitives) — use variants.

---

## R9 — Performance discipline

- `React.memo` only with bench evidence (P4). Default to not memoizing.
- `useMemo` / `useCallback` only when measured to help. Premature use creates noise.
- Virtualize lists with more than ~100 items (TanStack Virtual or react-window).
- Bundle splitting: route-level by default; component-level via `React.lazy` for heavy panels (charts, editors).

---

## R10 — Routing

Decision: **TBD at Phase 1F start.** Likely React Router or TanStack Router.
Whichever is chosen, route declarations live in one place (`apps/web/src/routes/`).

---

## R11 — Data flow direction

```
UI components ← ui-kit primitives ← apps/web pages
                                     ↓
                                 query layer (TanStack Query)
                                     ↓
                                 api client (typed via contracts)
                                     ↓
                                 HTTP → apps/api → domain packages
```

Components don't call domain packages directly. Components read server state
via the query layer; the query layer wraps a typed API client; the API client
talks to the backend.

---

## R12 — No `console.log` in committed code

Use a structured logger:

```ts
import { debug } from '@/lib/debug';
debug('LoginPanel', 'login succeeded', { userId });
```

Production builds strip debug calls. CI lints for `console.*` calls outside
the debug helper.

---

## R13 — TypeScript strictness in React

- Props are explicitly typed.
- Children typed (`children: ReactNode` for arbitrary; `children: ReactElement` for single element; etc.).
- Event handlers typed (`(e: React.MouseEvent<HTMLButtonElement>) => void`).
- No bare `JSX.Element` — use `ReactElement` or `ReactNode` based on intent.
