# AGENTS.md

## Stack

React SPA (Vite + TypeScript + Tailwind CSS + Zustand + Supabase).

## Commands

- Install: `npm install`
- Dev: `npm run dev` (Vite, port 3000, host 0.0.0.0)
- Build: `npm run build`
- Typecheck: `npx tsc --noEmit` (no output = success)
- Tests: `npm test` (Vitest, 102 tests across 10 files)
- **No lint or formatter is configured.**

## Environment

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vite also reads `GEMINI_API_KEY` (exposed as `process.env.GEMINI_API_KEY`). These are loaded via `import.meta.env` and injected in `vite.config.ts`.

## Path alias

`@/` is configured to resolve to project root in both `vite.config.ts` and `tsconfig.json`, but **the codebase uses relative imports exclusively** (e.g., `../../store/useAppStore`). Stick to relative paths for consistency.

## Directory structure

- `modules/` — feature modules (Dashboard, Maintenance, Equipment, Inventory, Reports, Users, Incidents, Scheduler). Each has an `index.tsx` barrel export and a `components/` subfolder.
- `components/` — shared UI components (`components/ui/` has FormInput, Modal, CustomSelect, etc.)
- `store/` — Zustand store (`useAppStore`) composed of slices in `store/slices/`
- `services/` — Supabase CRUD for each entity (one file per table)
- `hooks/` — shared React hooks (usePermissions, useSearchFilter, useFilteredData, etc.)
- `utils/` — mappers (snake_case DB ↔ camelCase TS), image compression, search utilities
- `database/` — SQL schema and migration scripts (source of truth for DB structure)
- `lib/supabase.ts` — Supabase client singleton
- `types.ts` — all TypeScript enums and interfaces
- `constants.ts` — UI config objects for statuses, priorities, types
- `branding.ts` — app name/logo config ("MaintPro")

## Architecture notes

- All feature modules are **lazy-loaded** via `React.lazy()` in `App.tsx:14-21`.
- Global state lives in a single Zustand store with 10 slices. The `DataSlice` (`store/slices/createDataSlice.ts`) handles initial data fetch and Supabase realtime subscriptions for all tables.
- Supabase realtime listens on `db-changes` channel. If you add a new table, subscribe to it there.
- DB columns are snake_case; the `utils/mappers.ts` file converts to camelCase for TypeScript types. If you add a new table, add a mapper and wire it into `createDataSlice`.
- **All TypeScript code uses camelCase exclusively** — interfaces, variables, props, state. Only DB queries in `services/` use snake_case for column references. Never define new TS interfaces with snake_case fields.
- Auth is a simple user-profile switch (no Supabase Auth). `LoginPage` selects a profile from the `profiles` table; `currentUser` is stored in the AuthSlice.

## Language

All UI strings, status values, and labels are in **Spanish** (e.g., `WOStatus.PENDING = 'Pendiente'`). Follow this convention for any new UI text.

## Roles

Five roles defined in `types.ts:UserRole`: Admin, Responsable Seccion, Tecnico, Observador N1, Observador N2. Observers are locked to the Incidents module (`App.tsx:118-122`). Permissions are in `hooks/usePermissions.ts`.

## Gotchas

- `dist/` is gitignored but present locally. Don't commit build output.
- `.env.local` is gitignored. Do not commit secrets.
- `html5-qrcode` is loaded via unpkg CDN in `index.html` (not npm).
- Dark mode uses Tailwind's `class` strategy — toggle adds/removes `dark` on `<html>`.
- Verify changes manually via `npm run dev` and `npx tsc --noEmit`.
- **Time tracking**: elapsed time derives **only** from `status_history` via `utils/timeTracking.ts` (`computeActiveSeconds`, `extractTimeSessions`, `hasActiveSession`). Never mix `time_spent_minutes` into the count when history exists. Pausing adds `PENDING` to history but keeps `wo.status = IN_PROGRESS` — use `hasActiveSession()` to tell "running" (open session) from "paused" (closed session), not the status alone.
- **Tests**: `test/setup.ts` provides a `window.matchMedia` stub (jsdom lacks it). `usePermissions` is a React hook, so its tests mount a probe component. `modules/Scheduler/components/*` are presentational and covered by tests; `utils/dateUtils.ts` and `utils/timeTracking.ts` have unit tests.
- **Build**: `vite.config.ts` uses `manualChunks` to split vendor libraries (supabase, react-vendor, motion, icons, …) out of the entry chunk so no chunk exceeds ~165 kB.
