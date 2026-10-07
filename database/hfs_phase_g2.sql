-- ============================================================================
-- GMAO HFS — Fase G2: ajustes a las vistas de reporting
-- ============================================================================
--  1. report_equipment_stats gana `total_count` (todas las OTs, no sólo las
--     correctivas) — lo pide la pestaña "Equipos" de Informes.
--  2. report_incident_stats_by_category: mismas métricas que
--     report_incident_stats pero agrupadas por categoría, para que la pestaña
--     "Incidencias" pueda mostrar tanto "Todas las categorías" como una suelta.
-- ============================================================================

-- 1. Equipos ------------------------------------------------------------------

DROP VIEW IF EXISTS public.report_equipment_stats CASCADE;
CREATE VIEW public.report_equipment_stats AS
WITH part_usage AS (
  SELECT
    w.equipment_id AS equipment_id,
    nullif(part->>'partId', '')::uuid AS item_id,
    (part->>'quantity')::numeric AS qty
  FROM public.work_orders w
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.used_parts, '[]')) AS part
)
SELECT
  e.id AS equipment_id,
  e.name AS equipment_name,
  count(w.id) AS total_count,
  count(w.id) FILTER (WHERE w.type = 'Correctivo') AS corrective_count,
  coalesce(sum(w.time_spent_minutes), 0) AS total_minutes,
  coalesce(sum(pu.qty * coalesce(i.price, 0)), 0) AS parts_cost
FROM public.equipment e
LEFT JOIN public.work_orders w ON w.equipment_id = e.id
LEFT JOIN part_usage pu ON pu.equipment_id = e.id
LEFT JOIN public.inventory i ON i.id = pu.item_id
WHERE public.can_read_catalog()
GROUP BY e.id, e.name;

GRANT SELECT ON public.report_equipment_stats TO authenticated;
REVOKE ALL ON public.report_equipment_stats FROM anon;

-- 2. Incidencias por categoría ------------------------------------------------

DROP VIEW IF EXISTS public.report_incident_stats_by_category CASCADE;
CREATE VIEW public.report_incident_stats_by_category AS
SELECT
  category_id,
  count(*) AS total,
  count(*) FILTER (WHERE status = 'Abierta') AS open_count,
  count(*) FILTER (WHERE status = 'En Revisión') AS in_review_count,
  count(*) FILTER (WHERE status = 'Resuelta') AS resolved_count,
  count(*) FILTER (WHERE status = 'Cancelada') AS cancelled_count,
  count(*) FILTER (WHERE status = 'Convertida a OT') AS converted_count,
  count(*) FILTER (WHERE reason IS NOT NULL AND trim(reason) <> '') AS reasons_filled,
  count(*) FILTER (WHERE solution IS NOT NULL AND trim(solution) <> '') AS solutions_filled,
  -- Postgres no tiene round(double precision, integer): castear a numeric
  round(
    ((count(*) FILTER (WHERE status = 'Resuelta'))::numeric
     / greatest(count(*), 1)) * 100, 1
  ) AS resolution_rate,
  round(
    (avg(date_part('epoch', resolved_at - created_at) / 86400.0)
      FILTER (WHERE status = 'Resuelta' AND resolved_at > created_at))::numeric,
    2
  ) AS avg_resolution_days
FROM public.incidents
WHERE public.incident_visible_to_me(section, category_id)
GROUP BY category_id;

GRANT SELECT ON public.report_incident_stats_by_category TO authenticated;
REVOKE ALL ON public.report_incident_stats_by_category FROM anon;