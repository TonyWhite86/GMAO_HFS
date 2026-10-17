# `database/` — esquema y migraciones de la BD

Este directorio es la **fuente de verdad del esquema**. No hay Supabase CLI en este
repo: los scripts se ejecutan a mano en el **SQL Editor** de Supabase.

---

## Solo hay dos scripts

| Script | Para qué sirve | ¿Cuándo se ejecuta? |
|---|---|---|
| `hfs_setup.sql` | Esquema completo (20 tablas), seed HFS (secciones, admin), triggers de IDs, RPCs base (`create_user_with_role`, `register_inventory_movement`, `merge_inventory_items`), buckets de Storage. **⚠️ Empieza con `DROP TABLE ... CASCADE` de las 20 tablas: borra todos los datos.** | Solo al levantar una **BD nueva** (o al querer resetear todo). |
| `hfs_all.sql` | **Todo lo demás**: RLS, secciones comodín, visibilidad de incidencias, RPCs atómicas, máquinas de estados, `work_order_events`, paradas, planes preventivos, vistas de reporting… **Idempotente** (reescribe funciones/políticas/triggers sin duplicar). | En cada actualización de la BD. Es el script que se ejecuta cuando se duda de qué está aplicado. |

**Levantar una BD desde cero** = `hfs_setup.sql` y después `hfs_all.sql`. Nada más.

## Convención de parches temporales

Cuando se añade o cambia una función/trigger puntual:

1. El cambio se escribe en **`hfs_all.sql`** (fuente de verdad).
2. Se crea temporalmente **`patch_temporal.sql`** en este directorio con **solo** los
   `CREATE OR REPLACE FUNCTION` / triggers afectados (también idempotentes), para no
   tener que ejecutar el `hfs_all.sql` completo.
3. Se ejecuta `patch_temporal.sql` en el SQL Editor, se confirma que aplica, y **se
   borra el fichero** (no se commitea).

## Advertencias

- **`hfs_setup.sql` es destructivo**: borra las 20 tablas con `CASCADE`. Solo se
  ejecuta en una BD nueva o cuando quieras resetear.
- Los scripts **no se ejecutan solos**. Cada fase nueva de la app viene con su
  cambio en `hfs_all.sql` + parche temporal que hay que aplicar a mano.
- No se puede cambiar una columna de firma sin soltar antes las políticas que la
  referencian (`DROP POLICY` antes que `DROP FUNCTION`, si no Postgres falla con
  `2BP01`). `hfs_all.sql` ya lo hace en el orden correcto.
- Los `SECURITY DEFINER` hacen bypass de RLS: revisa siempre qué usuario ejecutan.
- `hfs_all.sql` termina con un bloque de diagnóstico que imprime qué hay instalado.
