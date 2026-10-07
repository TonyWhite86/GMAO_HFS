# `database/` — esquema y migraciones de la BD

Este directorio es la **fuente de verdad del esquema**. No hay Supabase CLI en este
repo: los scripts se ejecutan a mano en el **SQL Editor** de Supabase.

---

## TL;DR — un solo archivo

**`hfs_all.sql`** concatena toda la cadena (b → c → d → e → f → f2 →
`work_order_events` → `incident_stoppage` → g → g2) en un script único,
**idempotente** y con diagnóstico al final. Es lo que hay que ejecutar cuando
se duda de qué está aplicado: borra las sobrecargas de RPCs (evita `PGRST203`)
y re-crea todo lo que falte.

**No incluye `hfs_setup.sql`** porque ése hace `DROP TABLE ... CASCADE` y borra
todos los datos. Sólo se ejecuta al levantar una BD nueva.

---

## Cómo levantar una BD desde cero

Ejecuta estos 11 scripts **en este orden** (son idempotentes):

| # | Script | Qué hace |
|---|---|---|
| 1 | `hfs_setup.sql` | Esquema completo (20 tablas), seed HFS (secciones, admin), triggers de IDs, RPCs base (`create_user_with_role`, `register_inventory_movement`, `merge_inventory_items`), buckets de Storage. **⚠️ Empieza con `DROP TABLE ... CASCADE` de las 20 tablas: borra todos los datos.** |
| 2 | `hfs_phase_b.sql` | Supabase Auth real: `is_admin()` / `is_staff()` leen el JWT, RLS endurecido por rol, RPCs de usuarios |
| 3 | `hfs_phase_c.sql` | Categorías de incidencia (`incident_categories`) con visibilidad por sección/rol, campos `reason`/`solution`/`resolved_*`, tabla `equipment_stoppages`, `incident_visible_to_me()` |
| 4 | `hfs_phase_d.sql` | Ámbito por sección de la incidencia (`incidents.section` vacío = la ve todo el mundo), **secciones comodín** (`sections.is_wildcard`), observadores bloqueados en el cliente, `incident_categories.is_default` |
| 5 | `hfs_phase_e.sql` | Sectorización RLS real (`work_orders`, `equipment`, `inventory`, `purchase_orders`…), niveles de permiso (`my_permission_level`, `has_inventory_access`), vista `inventory_browse` con precio/proveedor enmascarados, identidad no falsificable, UNIQUEs restaurados |
| 6 | `hfs_phase_f.sql` | RPCs atómicas (`transition_incident`, `convert_incident_to_wo`, `transition_work_order`, `assign_work_order`, `create_purchase_order`, `receive_purchase_order`…) y máquinas de estados |
| 7 | `hfs_phase_f2.sql` | `transition_work_order` corregido (idempotente al completar, no pisa con 0 un tiempo ya guardado) + columnas `time_source` / `time_recorded_by` / `time_recorded_at` |
| 8 | `hfs_work_order_events.sql` | **`work_order_events`** — log append-only del histórico de la OT. `work_orders.status_history` pasa a ser una proyección derivada por trigger. Es la versión **definitiva** de `transition_work_order` |
| 9 | `hfs_incident_stoppage.sql` | Paradas abiertas (`equipment_stoppages.end_at` nullable), vínculo 1:1 `incidents ↔ equipment_stoppages`, RPCs `create_incident_with_stoppage` / `complete_stoppage`, auto-cierre al resolver la incidencia, `incidents.equipment_id NOT NULL` |
| 10 | `hfs_phase_g.sql` | `profile_emails` (email fuera de `profiles`, RLS sólo-Admin), motor de planes preventivos (`launch_due_preventive_plans` + cron diario a las 06:30) y vistas de reporting (`report_worker_stats`, `report_equipment_stats`, `report_part_rotation`, `report_incident_stats`) |
| 11 | `hfs_phase_g2.sql` | Ajustes a las vistas de reporting: `report_equipment_stats` gana `total_count` y se añade `report_incident_stats_by_category` para la pestaña de Incidencias |

> **Regla de orden**: cada script puede supersedir a un anterior. En concreto
> `hfs_work_order_events.sql` reemplaza `transition_work_order` de `hfs_phase_f2.sql`,
> que a su vez reemplaza la de `hfs_phase_f.sql` §5. Siempre ejecuta **todos** en orden.

---

## Advertencias

- **`hfs_setup.sql` es destructivo**: borra las 20 tablas con `CASCADE`. Solo se
  ejecuta en una BD nueva o cuando quieras resetear.
- Los scripts **no se ejecutan solos**. Cada fase nueva de la app viene con su
  script que hay que aplicar a mano en el SQL Editor.
- No se puede cambiar una columna de firma sin soltar antes las políticas que la
  referencian (`DROP POLICY` antes que `DROP FUNCTION`, si no Postgres falla con
  `2BP01`).
- Los `SECURITY DEFINER` hacen bypass de RLS: revisa siempre qué usuario ejecutan.

---

## `_legacy/` — **no ejecutar**

Ahí vive el material de la app anterior (MaintPro) y de la fase de migración hacia
HFS. **Ninguno de esos scripts debe ejecutarse sobre la BD actual**: o están
suplantados por la cadena `hfs_*`, o son activamente peligrosos.

Incluye:

- `database_schema.sql` — el "Full Database Schema" original de MaintPro (mismas 20
  tablas que `hfs_setup.sql`, sin el branding HFS ni las fases posteriores)
- `migrations/` (001–006) — migraciones intermedias, ya absorbidas
- `migration_*.sql` — columnas y RPCs que hoy están en `hfs_setup.sql` y `hfs_phase_e.sql`
- `fix_*.sql`, `movements.sql`, `orders.sql`, `skills.sql`, `refactor_wo_comments.sql`,
  `policies_preventive_plans.sql`, …
- `supabase_rules_dump.json` — dump de introspección de la BD en un momento dado,
  no es un script

Se han **borrado del repositorio** (no movido) 6 scripts que permitían abrir la BD
en falso:

| Borrado | Por qué |
|---|---|
| `fix_incident_permissions_public.sql` | `Acceso total incidencias` con `USING (true)` → lectura/escritura para cualquiera, incluso `anon` |
| `fix_incident_update_error.sql` | `Permitir todo a autenticados` `FOR ALL` sobre `incidents` / `incident_comments` |
| `fix_unique_constraints.sql` | **Borraba** los UNIQUE de `work_orders.related_incident_id` e `incidents.work_order_id` → permitía convertir la misma incidencia en dos OTs |
| `create_observer_users.sql` | Usuarios demo |
| `setup_incident_storage.sql` | `POLICY "Allow All" ... USING (true)` sobre el bucket `incident-files` |
| `storage_setup.sql` | INSERT de Storage para `anon` ("modo demo") |

También se ha eliminado de `hfs_setup.sql` el bloque **"MODO APP SIN SESIÓN SUPABASE
AUTH"** (su antigua sección 14), que sobreescribía `is_admin()` / `is_staff()` con
`RETURN true` — es decir, **cualquiera era Admin**. Esas funciones ya se definen
correctamente en la sección 3 del mismo script, leyendo el rol del JWT.

Si necesitas recuperar algo de lo borrado, está en el historial de git.

---

## Tabla de equivalencias (legacy → actual)

| Antes (legacy) | Hoy vive en |
|---|---|
| `database_schema.sql` | `hfs_setup.sql` |
| `migrations/001_work_order_sequence.sql` | `hfs_setup.sql` (`generate_work_order_id`) |
| `migrations/002_incident_sequence.sql` | `hfs_setup.sql` (`generate_incident_id`) |
| `migrations/003_incident_section_nullable.sql` | `hfs_setup.sql` |
| `migrations/004_enforce_work_order_created_at_role.sql` | `hfs_setup.sql` (`check_work_order_created_at`) |
| `migrations/005_rls_jwt_role_claims.sql` | `hfs_phase_b.sql` |
| `migrations/006_user_permissions.sql` | `hfs_setup.sql` (`user_permissions`) |
| `migration_register_movement_rpc.sql` | `hfs_setup.sql` §13 + endurecido en `hfs_phase_f.sql` §13 |
| `migration_merge_inventory_rpc.sql` | `hfs_setup.sql` + endurecido en `hfs_phase_f.sql` §13 |
| `migration_collaborators.sql` | `hfs_setup.sql` (`work_order_collaborators`) |
| `migration_add_tasks_to_plans.sql` / `_description_` / `_section_` | `hfs_setup.sql` (`preventive_plans.tasks`, `.description`, `.section`) |
| `migration_inventory_drafts.sql` | `hfs_setup.sql` (`inventory.status`, `.manufacturer`) |
| `policies_preventive_plans.sql` | `hfs_phase_e.sql` §10 |
| `refactor_wo_comments.sql` | `hfs_setup.sql` (`comments.attachments`) |
| `movements.sql` | `hfs_setup.sql` (`inventory_movements`) |
| `orders.sql` | `hfs_setup.sql` (`purchase_orders`, `purchase_order_items`) |
| `skills.sql` | `hfs_setup.sql` (`skills`, `user_skills`) |
| `storage_setup.sql` / `setup_incident_storage.sql` | `hfs_setup.sql` (buckets + políticas de Storage) |
| `enable_realtime.sql` / `fix_realtime_*.sql` | `hfs_phase_c.sql` §6 + `hfs_work_order_events.sql` §1 |
| `fix_unique_constraints.sql` | **Invertido** en `hfs_phase_e.sql` §4 (se restauran los UNIQUE) |

---

## Convenciones

- Los scripts `hfs_*` son **idempotentes**: `CREATE OR REPLACE`,
  `IF NOT EXISTS`, `DROP … IF EXISTS` + `CREATE`. Se pueden re-ejecutar.
- Los nombres de tabla/columna en BD van en **snake_case**; el código TypeScript
  usa **camelCase** y la conversión vive en `utils/mappers.ts`.
- Toda tabla nueva debe añadirse también a `supabase_realtime` y a la suscripción
  `db-changes` de `store/slices/createDataSlice.ts`.
