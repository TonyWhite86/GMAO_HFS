# AGENTS.md

## Stack

React SPA (Vite + TypeScript + Tailwind CSS + Zustand + Supabase).

## Commands

- Install: `npm install`
- Dev: `npm run dev` (Vite, port 3000, host 0.0.0.0)
- Build: `npm run build`
- Typecheck: `npx tsc --noEmit` (no output = success)
- Tests: `npm test` (Vitest, 221 tests across 18 files)
- **No lint or formatter is configured.**

## Environment

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vite also reads `GEMINI_API_KEY` (exposed as `process.env.GEMINI_API_KEY`). These are loaded via `import.meta.env` and injected in `vite.config.ts`.

## Path alias

`@/` is configured to resolve to project root in both `vite.config.ts` and `tsconfig.json`, but **the codebase uses relative imports exclusively** (e.g., `../../store/useAppStore`). Stick to relative paths for consistency.

## Directory structure

- `modules/` — feature modules (Dashboard, Maintenance, Equipment, Inventory, Reports, Users, Incidents, Scheduler, Stoppages). Each has an `index.tsx` barrel export and a `components/` subfolder.
- `components/` — shared UI components (`components/ui/` has FormInput, Modal, CustomSelect, etc.; `components/users/` has the admin CRUD modals such as `CategoriesManagementModal`)
- `store/` — Zustand store (`useAppStore`) composed of slices in `store/slices/`
- `services/` — Supabase CRUD for each entity (one file per table)
- `hooks/` — shared React hooks (usePermissions, useSearchFilter, useFilteredData, useVisibleCategories, etc.)
- `utils/` — mappers (snake_case DB ↔ camelCase TS), image compression, search utilities
- `database/` — SQL schema and migration scripts (source of truth for DB structure). HFS rollout migrations are `hfs_setup.sql` → `hfs_phase_b.sql` → `hfs_phase_c.sql` → `hfs_phase_d.sql` → `hfs_phase_e.sql` → `hfs_phase_f.sql` → `hfs_phase_f2.sql` → `hfs_work_order_events.sql` → `hfs_incident_stoppage.sql`. **Read `database/README.md` before touching anything there** — `_legacy/` holds superseded MaintPro scripts that must never be re-run.
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
- **Tests**: `test/setup.ts` provides a `window.matchMedia` stub (jsdom lacks it). `usePermissions` is a React hook, so its tests mount a probe component. `modules/Scheduler/components/*` and `modules/Stoppages/components/*` are presentational and covered by tests; `utils/dateUtils.ts`, `utils/timeTracking.ts`, `utils/incidentStats.ts` and `utils/incidentVisibility.ts` have unit tests.
- **Incident categories & visibility**: `incident_categories` carries `visible_sections` / `visible_roles` (empty arrays = visible to everyone, Admin always sees all) and `is_default` (exactly one, enforced by a `BEFORE` trigger — it preselects the category in the create form; "Avería" is seeded as default). Deleting a category reassigns its incidents to "Avería" via the `BEFORE DELETE` trigger in `hfs_phase_c.sql` §7.
- **Incident scope & visibility (4 layers)**: mirror of `incident_visible_to_me(section, category_id)` in `hfs_phase_d.sql` lives in `utils/incidentVisibility.ts:canSeeIncident` / `canManageIncident`. Layers: (0) `profiles.active = false` → nothing, (1) Admin → all, (2) **comodín** → all, (3) `incidents.section` empty/`'Global'` → everyone, otherwise only that section, (4) category restriction, AND-joined with (3). Use `hooks/useVisibleCategories` for the category catalog (it does NOT filter by `isActive`; each consumer decides).
- **Secciones comodín (`sections.is_wildcard`)**: Mantenimiento e Ingeniería ven y gestionan TODAS las incidencias. En la UI se marca con el toggle "Comodín" en Usuarios → Secciones. **Un observador nunca es comodín**, aunque esté apuntado a una sección comodín (`utils/incidentVisibility.ts:isWildcardUser`).
- **Observers are the most restricted role**: no `useRestrictedItems` bypass (removed in Fase D), never comodín, RLS only gives them `incidents*` + `incident_categories` + `sections` + their own `profiles` (pending Fase E). Granting them every section makes them see everything via the normal section rule.
- **Incident scope field**: `incidents.section` empty means "visible to everyone" (UI label *"Sin sección — la ve todo el mundo"*). `CreateIncidentModal` only offers the user's own sections (Admin: all) and defaults to empty.
- **Every incident MUST have an equipment**: `incidents.equipment_id` is `NOT NULL` with `ON DELETE RESTRICT` (you cannot delete an equipment that has incidents). `create_incident_with_stoppage` raises if `p_equipment_id` is NULL. `CreateIncidentModal` labels it `Equipo Relacionado *` and blocks submit without it.
- **Stoppage reason is derived from the incident category**: `equipment_stoppages.reason_type` is **nullable** and only filled for *planned* stoppages (the `StoppageReasonType` enum). When `incident_id` is set, `reason_type` is `NULL` and the effective label comes from the incident's category via the `incident:incident_id(category:category_id(name))` join (`mapEquipmentStoppage` exposes it as `reasonLabel`). `STOPPAGE_REASON_CONFIG[s.reasonType]` must always be used with the `?? STOPPAGE_REASON_FALLBACK` fallback — custom category names are not keys of that map. `StoppageFormModal` shows the reason **read-only** when the stoppage comes from an incident.
- **Form modals must mount conditionally** (`{isOpen && <XModal />}`) so that closing them drops their `useState` and nothing leaks into the next open. Most already did; `CreateIncidentModal`, `ConvertIncidentModal`, `EquipmentModal`, `StoppageFormModal`, `CategoriesManagementModal` and `SkillsManagementModal` were the stragglers and now do too. Detail panels (`WorkOrderDetailModal`, `IncidentDetail`) behave the same way: unsaved edits are discarded on close.
- **Identity is not spoofable**: `incidents.created_by`, `work_orders.created_by`, `comments.user_id`, `incident_comments.user_id`, `inventory_movements.user_id`, `equipment_stoppages.created_by/requested_by`, `purchase_orders.requested_by` all have `DEFAULT auth.uid()` and their INSERT policies require the value to equal `auth.uid()` (or be NULL). **Never send these fields from `services/`.** `comments.user_name` / `incident_comments.user_name` are filled by the `fill_user_name()` trigger (from `profiles.name`); `is_system = true` comments keep `'Sistema'`.
- **Permission levels** (`sin_acceso < consulta < parcial < total`): resolved in SQL by `my_permission_level(module)` / `has_inventory_access(min_level)` with the same defaults as `hooks/usePermissions.ts` (Admin = `total`, Observador = `sin_acceso`, `actuaciones` = `total`, `paradas` = `consulta`, resto = `sin_acceso`). RLS for `inventory`, `inventory_movements`, `purchase_orders`, `purchase_order_items` and the RPCs `register_inventory_movement` (`parcial`+) / `merge_inventory_items` (`total`) all go through them.
- **Price / supplier masking**: `inventory` SELECT requires `parcial`+ (these users may see `price`). Everyone at `consulta` reads through the **`inventory_browse`** view, which returns `price`/`supplier` as `NULL`. `services/inventoryService.ts` reads `getAll`/`getById` from that view — writes still go to the `inventory` table.
- **Observers are blocked at the RLS layer** for every ops table via `can_read_ops_data()` (work_orders, equipment, inventory*, purchase_orders*, comments, subtasks, attachments, work_order_collaborators, preventive_plans, equipment_stoppages, skills, user_skills, user_permissions). They only reach `incidents*`, `incident_categories`, `sections`, `profiles` and `work_order_sequences`/`incident_sequences` via `can_read_catalog()`. `profiles.email` is still readable by any authenticated user (restricting it needs a view — pending).
- **Stoppages (paradas programadas)**: table `equipment_stoppages`. The `paradas` permission module defaults to `consulta` (calendar visible to all non-observers) and needs `total` to manage; the `actuaciones` module defaults to `total`. See `hooks/usePermissions.ts`.
- **Open stoppages & incident-linked stoppages** (`database/hfs_incident_stoppage.sql`): `equipment_stoppages.end_at` is **nullable** — `NULL` means the stoppage is *open* (duration unknown) and `StoppageGrid` draws it up to *now* with a pulsing amber dot. `equipment_stoppages.incident_id` links a stoppage to the incident that caused it (**exactly one**, via the partial `uq_stoppages_incident` index). Create both atomically with `create_incident_with_stoppage(...)` (returns `{incident_id, stoppage_id}`); close with `complete_stoppage(id, end_at)`. An incident reaching `Resuelta` auto-closes its open stoppage as `Completada`, reaching `Cancelada` as `Cancelada` (trigger `trg_incidents_close_stoppages`); converting the incident to a WO links the stoppage to that WO (trigger `trg_work_orders_link_stoppages`). `CreateIncidentModal` shows the *"Este equipo está parado ahora mismo"* block only when an equipment is selected.
- **Migrations**: `database/hfs_*.sql` scripts are idempotent and are run manually in the Supabase SQL Editor (no Supabase CLI in this repo). New tables must also be added to `supabase_realtime` and to the `db-changes` subscription in `store/slices/createDataSlice.ts`. **`database/hfs_setup.sql` starts with `DROP TABLE ... CASCADE`** — it is a bootstrap-only script. The old `database/_legacy/` scripts are superseded; six actively dangerous ones (`fix_incident_permissions_public.sql`, `fix_incident_update_error.sql`, `fix_unique_constraints.sql`, `create_observer_users.sql`, `setup_incident_storage.sql`, `storage_setup.sql`) were deleted from the repo, and the "MODO APP SIN SESIÓN" block that made `is_admin()` return `true` was removed from `hfs_setup.sql`.
- **`profiles.email` lives in `profile_emails`** (`database/hfs_phase_g.sql` §1, RLS admin-only + own profile). `profiles` no longer has an `email` column. `userService.getAll`/`update` read/write it through the `emails:profile_emails(email)` join; `mapProfile` falls back to `existing.email` because the realtime payload never carries the join. Never `select('*')` from `profiles` expecting an email.
- **Preventive plan engine** (`database/hfs_phase_g.sql` §2): `launch_due_preventive_plans()` fires one WO per overdue plan and **rolls `next_run` into the future** (miss 3 weeks → 1 WO, not 3). Scheduled daily at 06:30 via `pg_cron` (job `gmao-launch-preventive-plans`) when the extension is installed; otherwise call the function manually. `transition_work_order('complete')` still calls `launch_plan_next_wo` for the plan of the finished WO.
- **Reporting views** (`database/hfs_phase_g.sql` §3): `report_worker_stats`, `report_equipment_stats`, `report_part_rotation`, `report_incident_stats` — accessed through `services/reportService.ts`. `Reports.tsx` uses `report_worker_stats` for the *Personal* KPIs (source of truth over the client-side math); the other three are ready to wire when those tabs need them.
- **State machines are enforced in SQL** (`database/hfs_phase_f.sql`) by `BEFORE UPDATE` triggers: `enforce_incident_transition` (Abierta → En Revisión → Resuelta/Cancelada/Convertida a OT; Resuelta and Cancelada are terminal; En Revisión requires `reason`, Resuelta requires `reason` + `solution`, and only that path stamps `resolved_at`/`resolved_by`), `enforce_work_order_transition` (Completada is terminal, `closed_at` is sealed on completion and cannot be edited afterwards), `enforce_stoppage_transition` (Programada → En curso → Completada/Cancelada), `enforce_purchase_order_transition` (→ Pedido requires a `supplier`). Do not try to bypass them by writing `status` directly.
- **Atomic RPCs (use these instead of read-modify-write)**: `transition_incident(id, status, reason, solution, comment)`, `convert_incident_to_wo(...)` (idempotent — returns the existing WO if `related_incident_id` already matches), `transition_work_order(id, action, note, manual_minutes)` with `action ∈ start|pause|resume|complete` (pause closes the session but keeps `status = 'En Progreso'`), `assign_work_order` / `unassign_work_order` (validate that the assignee is in the WO's section and is not an observer), `create_purchase_order` (number from `purchase_order_number_seq` → `REQ-YYYY-######`, `total_amount` computed in BD), `receive_purchase_order` (accumulates `received_quantity`, picks Recibido Parcial/Recibido, seals `received_date` and moves stock in one transaction).
- **WO history/time is DB-owned**: `workOrderService.update` does **not** send `status`, `status_history`, `time_spent_minutes`, `closed_at` or `created_at`. Status transitions must go through `store/slices/createWorkOrderSlice.ts:transitionWorkOrder`, which calls `transition_work_order` and then applies an optimistic local update. The system comment is written by the RPC — do not post one from the component. `updateWorkOrder` is metadata-only and deliberately keeps the store's `status`/`statusHistory`/`timeSpentMinutes`/`closedAt` untouched.
- **WO activity lives in `work_order_events`** (`database/hfs_work_order_events.sql`): an append-only log of `create | status | pause | resume | complete | assign | unassign | priority | parts | convert`. **`work_orders.status_history` is a derived projection** maintained by the `trg_wo_events_project_history` trigger from those events — never write it by hand, and never have an RPC set it. RLS only lets the owning user read their WO's events; writes happen through `SECURITY DEFINER` functions (`log_wo_event`). Realtime appends new events to the store in `createDataSlice.ts`.
- **`ActivityTimeline`** (`components/common/ActivityTimeline.tsx`) merges `work_order_events` + `comments` sorted by timestamp and renders the time **inside** the message (`Inicio del trabajo · 02/10/2026 14:30`). It is what the *Actividad* tab of `WorkOrderDetailModal` shows (via `WOCommentsSection`).
- **`transition_work_order` quirks** (`database/hfs_phase_f2.sql` supersedes §5 of `hfs_phase_f.sql`): `complete` is idempotent (a second call is a no-op, not an error), and if the computed time is `0` while `time_spent_minutes` was already `> 0`, the stored value is **kept** — so a WO finished without ever being started does not lose a manually entered time. Always pass the manual minutes explicitly (`p_manual_minutes`) when the user types them; pass `NULL` when the user enters `0` so the RPC computes/blindajes instead of forcing zero.
- **Manual vs measured time is recorded**: `work_orders.time_source` is `'sesion'` (derived from `status_history`) or `'manual'` (typed in), plus `time_recorded_by` / `time_recorded_at`. Set by `transition_work_order` on `complete`. The UI shows a `Tiempo manual` / `Tiempo medido` badge next to the counter (`WorkOrderDetailModal`) and the system comment appends *"(tiempo registrado a mano)"*. Use it to spot workers who never press Iniciar/Finalizar.
- **`WorkLogGantt` (Parte de trabajo) draws sessions, not totals**: `extractSessions` synthesises a block from `time_source = 'manual'` + `time_spent_minutes` (ending at `closedAt`, dashed amber border) because a WO completed without pressing Iniciar has no `En Progreso` entries in `status_history`. If the WO has no assignee/collaborators, the block is attributed to `time_recorded_by` — otherwise an unassigned preventive WO would never appear in the work log.
- **Realtime does not carry joins**: `postgres_changes` sends only the `work_orders` columns. `utils/mappers.ts:mapWorkOrder` falls back to the `existing` store entry for `subtasks`, `comments` and `attachments` when the payload omits them (`undefined`), but respects a real empty array. Always pass `existing` when mapping over a store entry (see `createDataSlice.ts`).
- **Stock moves only via `register_inventory_movement`**: `inventory.quantity` is protected by `trg_inventory_protect_quantity` — any direct UPDATE raises. `services/inventoryService.ts:update` therefore does **not** send `quantity`. The two RPCs that legitimately change it (`register_inventory_movement`, `merge_inventory_items`) raise `gmao.allow_qty` with `set_config(..., true)`.
- **Build**: `vite.config.ts` uses `manualChunks` to split vendor libraries (supabase, react-vendor, motion, icons, …) out of the entry chunk so no chunk exceeds ~165 kB.
