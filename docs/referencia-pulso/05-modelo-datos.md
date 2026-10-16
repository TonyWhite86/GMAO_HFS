# 05 — Modelo de datos: Pulso vs GMAO_HFS

Entidades de la app Pulso (extraídas de `seed()` y su uso) contrastadas con los tipos de GMAO_HFS (`types.ts`). Útil al portar funciones para saber qué campos añadir a tus tablas Supabase.

Convención Pulso: IDs legibles (`U-001`, `ET-1`, `OT-000001`, `PROV-1`, `GRP-…`, `SOL<ts>`, `MS<ts>`, `P<ts>`). Colecciones del estado global: `usuarios`, `equiposTrabajo`, `equipos`, `ordenes`, `repuestos`, `movimientosStock`, `proveedores`, `gruposEquipo`, `solicitudes`, `diasPlan` + escalares `otCounter`, `nombreEmpresa`, `precioHoraGenerico`. Las **OTs cerradas viven en un "archivo" aparte** en el servidor (no en el dataset activo).

---

## 1. Usuarios

**Pulso** (`usuarios`):

| Campo | Notas |
|---|---|
| `id`, `nombre`, `rol` | roles: admin, encargado, segundo_encargado, operario, almacen, observador |
| `pin` | 4 dígitos (login) |
| `equipoTrabajoId`, `equiposSecundariosIds[]` | pertenencia a equipos de trabajo |
| `especialidad`, `costeHora` (null → genérico) | coste/hora para informes |
| `mostrarEnGantt`, `activo` | |
| `ausencias[]` | embebidas: `{id, tipo: vacaciones\|salud\|otros, desde, hasta, obs}` |

**GMAO_HFS** (`User`): `name`, `email` (en `profile_emails`), `role` (Admin, Responsable Sección, Técnico, Observador N1/N2), `sections[]`, `active`, `avatar`. Permisos por módulo en `UserPermission` (`sin_acceso/consulta/parcial/total`).

**A portar**: `ausencias` (nueva tabla o relación), `costeHora`, `mostrarEnGantt`, `equipoTrabajoId`. Conservar: email, sections, permisos por módulo.

---

## 2. Equipos de trabajo

**Pulso** (`equiposTrabajo`): `{id "ET-x", nombre, zona, encargadoId, activo}`.

**GMAO_HFS**: equivalente semántico = `Section` (`name`, `isSpecial`, `isWildcard`) + asignación `assignedGroupId` en OTs. No hay entidad "equipo de trabajo con encargado" — se podría mapear a `Section` + un `managerUserId` o crear tabla propia.

---

## 3. Equipos (árbol de máquinas)

**Pulso** (`equipos`):

| Grupo | Campos |
|---|---|
| Identidad | `id`, `nombre`, `tipo` (equipo/componente/agrupacion), `categoria`, `parentId`, `orden` (manual entre hermanos) |
| Ubicación | `ubicacion`, `zona`, `equipoTrabajoId`, `equipoTrabajoResponsableId`, `estado` (produccion/mantenimiento/parado), `oculto` |
| Ficha técnica | `fabricante`, `modelo`, `numSerie`, `anyoFabricacion`, `fechaPuestaMarcha`, `descripcionLarga`, `caracteristica1..3` |
| Relaciones | `repuestosIds[]` |
| **Aceptación** (embebida) | `{vistosBuenos:[{nombre, usuarioId, departamento, fecha}], formaciones:[{receptor, receptorId, impartidoPor, impartidoPorId, fecha}], manualesOk, conformidadOk}` |

**GMAO_HFS** (`Equipment`): `name`, `manufacturer`, `serialNumber`, `location`, `status` ('Nuevo'…'Baja'), `sections[]`, `parentId`, `photoUrl`, `qrCode`, `code`, `documents[]`.

**A portar**: `aceptación` (vistos buenos/formaciones/manuales/conformidad), `zona`, `estado` prod/mant/parado, `orden` entre hermanos, `categoria`, campos de ficha (año, puesta en marcha, características). Conservar: documents, photoUrl, status propio, sections.

---

## 4. Órdenes de trabajo

**Pulso** (`ordenes`, solo abiertas):

| Grupo | Campos |
|---|---|
| Identidad | `id` "OT-000001", `num`, `tipo` (Correctivo/Preventivo/Mejora/Predictivo) |
| Estado | `estado` (Pendiente/Activo/Completado/Cancelado), `parado` (preventivo parado) |
| Fechas | `previsto`, `realizado`, `fechaCreacion` |
| Contenido | `descripcion`, `criticidad` (baja/media/alta), `comentario`, `checklist:[{id,texto}]`, `checklistRespuestas:{[id]:{sel,val}}` |
| Asignación | `equipoId` (nullable), `equipoTrabajoId`, `realizadoPor`, `creadoPor` |
| Repuestos | `repuestosUsados:[{repuestoId, cantidad}]` |
| Preventivo | `periodicidad` (días; 0 válido), `esExterna`, `empresaExterna`, `precioExterno` |
| Partes | `partes[]` embebidos (ver §5) |
| Archivo | OTs cerradas fuera del dataset activo, consultadas paginadas (`fetchArchivo`) |

**GMAO_HFS** (`WorkOrder`): `title`, `description`, `type` (Correctivo/Preventivo/Actuación Programada), `status` (Pendiente/Programada/En Progreso/Completada), `priority` (Baja→Crítica), `equipmentId`, `assignedUserId`, `collaborators[]`, `assignedGroupId`, `section`, `timeSpentMinutes` + `timeSource`, `attachments[]`, `usedParts[]`, `comments[]`, `subtasks[]`, `events[]` (histórico append-only), `relatedPlanId`, `relatedIncidentId`, `scheduledDate`, `closedAt`, `audioNoteUrl`, `pendingReason`.

**A portar**: `checklist` de cierre + respuestas, `periodicidad` + `parado`, trabajo externo (`esExterna/empresaExterna/precioExterno`), `criticidad` si quieres además de `priority`, tipo Mejora/Predictivo, `previsto` con ajustes rápidos. Conservar: events, comments, subtasks, incidents, time tracking.

---

## 5. Partes de trabajo

**Pulso** (embebidos en `orden.partes`): `{id "P<ts>", otId, usuarioId, fechaInicio "YYYY-MM-DDTHH:mm", fechaFin, notas, comentario, terminado, repuestosUsados[], cerradoPorAdmin}`. Estados implícitos: abierto / terminado / planificado.

**GMAO_HFS**: no existe entidad equivalente (solo `timeSpentMinutes` + `LiveTimer`). Si se porta, crear tabla `work_parts` (o `work_logs`) con FK a `work_orders` y `profiles`.

---

## 6. Repuestos y stock

**Pulso** (`repuestos`):

| Modo | Campos |
|---|---|
| Básico | `id`, `nombre`, `descripcion`, `categoria`, `stock`, `stockMin`, `stockMax`, `ubicacion`, `unidad`, `activo`, `precioUnitario`, `proveedorId` |
| Estados | `conEstados`, `stockUsado`, `stockReparado`, `estadosCfg:{usado:{modo,pct,precio}, reparado:{…}}` |
| Unidades | `seguimiento`, `unidades:[{n, estado, reparacion:{envio,reparador,precio}, ultimaReparacion, baja, tirada, bajaMotivo}]`, `contUnidades` |
| Reparaciones | `enviosRep:[{id, cant, envio, reparador, precio}]` (lotes a taller) |

**GMAO_HFS** (`InventoryItem`): `name`, `sku`, `manufacturer`, `quantity`, `minStock`, `category`, `location`, `price`, `supplier`, `qrCode`, `critic`, `status`, `image`, `suppliers[]` (histórico), `linkedEquipmentIds[]`.

**A portar**: estados nuevo/usado/reparado, unidades seriadas, reparaciones, stock comprometido vs disponible, `stockMax`. Conservar: sku, suppliers con histórico, critic, linkedEquipmentIds.

---

## 7. Movimientos de stock

**Pulso** (`movimientosStock`): `{id "MS<ts>", repuestoId, tipo: entrada|salida|regularizacion|reparacion, reparacion: envio|recepcion|devuelta, cantidad, estado (nuevo/usado/reparado), unidades[], fecha, usuarioId, motivo, otId, proveedorId, precioUnitario, confirmadoPor, pendienteConfirmacion, tirada, destino:"tirar", valorUnit, traslado, reparador, precioReparacion}`.

**GMAO_HFS** (`InventoryMovement`): `itemId`, `type: IN|OUT`, `quantity`, `reason`, `userId`, `createdAt`.

**A portar**: tipos `regularizacion`/`reparacion`, flag `pendienteConfirmacion` + `confirmadoPor`, vinculación `otId`, `precioUnitario`/`valorUnit`.

---

## 8. Proveedores, grupos, solicitudes, días de plan

| Entidad Pulso | Campos | Equivalente GMAO_HFS |
|---|---|---|
| `proveedores` | `nombre, contacto, telefono, categoria, activo` | `SupplierInfo` (parcial) + campo `supplier` libre — **portar entidad completa** si quieres historial |
| `gruposEquipo` (2 ámbitos) | Grupos de equipos: `{nombre, descripcion, equipoTrabajoId, equiposIds[], repuestosIds[]}`; Grupos de repuestos: `{ambito:"repuestos", repIds[], equiposIds[]}` | No existe — candidato si usas Pulso §4/§6 |
| `solicitudes` | `{tipo: orden\|repuesto, descripcion, creadoPor, estado: pendiente\|aprobada\|rechazada, resueltoPor, fechaResolucion, otId, repuestoId, comentarios[]}` | Incidents + PurchaseRequest — conservar lo tuyo |
| `diasPlan` | `{fecha, festivo, nota}` | No existe — portar con PreventivePlan/Calendar |

---

## 9. Archivos

**Pulso** (API aparte, no en el dataset): `{ruta, fichero, nombre, tipo (mime), descripcion, categorias[] (procedimientos/manuales/conformidad/revisiones/planos), equiposIds[], equipoIdOrigen, origenOT, otsIds[], subidoPor}`.

**GMAO_HFS**: `EquipmentDocument` (name/type/url/parentId) + `Attachment` (name/url/type). **Portar**: `categorias` y relaciones múltiples con OTs/equipos.

---

## 10. Preferencias locales (localStorage) de Pulso

| Clave | Uso | Idea equivalente |
|---|---|---|
| `gmao_datos` | snapshot local del dataset | innecesario con Supabase realtime |
| `pulso_session_user` | usuario recordado | ya lo tienes (AuthSlice) |
| `pulso_preventivos_ocultos` | planes ocultos en la vista | preferencias de UI por usuario |
| `pulso_preventivos_periodicidad` | periodicidad manual por plan | mejor en BD si es compartida |
