# 04 — Funcionalidades de "Pulso" → módulos de GMAO_HFS

Catálogo de funciones de Pulso con sus **reglas de comportamiento** (lo que hay que replicar si se porta) y su **módulo equivalente** en GMAO_HFS. Usa este documento para decidir qué incluir y qué conservar de tu app.

Leyenda de recomendación:
- **PORTAR** — Pulso tiene algo que GMAO_HFS no tiene o es claramente mejor; candidato directo.
- **ADAPTAR** — GMAO_HFS ya tiene algo equivalente; portar solo la mejora de comportamiento/diseño.
- **N/A** — específico del despliegue de Pulso (backend PHP, importación Lumina…), no aplica.

---

## 1. Órdenes de trabajo (OT)

**Equivalente GMAO_HFS**: `modules/Maintenance`, `components/CreateWorkOrderModal.tsx`, `WorkOrderDetailModal.tsx`, `components/workOrder/`, `services/workOrderService.ts`, tipos `WorkOrder`/`WOStatus`/`WOType` en `types.ts`. → **ADAPTAR**

### Ciclo de vida (reglas de Pulso)

1. **Estados**: `Pendiente → Activo → Completado` (+ `Cancelado` solo si ya lo estaba). Número correlativo tipo `OT-000001` reservado de forma atómica en servidor.
2. **Creación**: desde botón "Nueva OT Correctiva", desde Equipos ("Nueva OT" con equipo preseleccionado), desde aprobación de una solicitud, o por recurrencia de preventivos.
3. **Trabajo con partes** (ver §2): entrar a trabajar pone la OT en `Activo`; registrar salida puede "cerrar solo mi parte" o **cerrar la OT**.
4. **Cierre con checklist**: si la OT tiene checklist de puntos, cerrarla exige responder todos (Sí/No/valor). Cerrada → `Completado`, fecha realizada = hoy, se eliminan partes planificados no realizados.
5. **Campos destacados**: tipo (Correctivo/Preventivo/Mejora/Predictivo), criticidad (baja/media/alta), fecha prevista con ajustes rápidos (+7d/+15d/+30d), equipo de trabajo, "Asignado a", trabajo **externo** (empresa + precio), repuestos consumidos, adjuntos por equipo.
6. **Cadena preventiva**: las OTs preventivas se agrupan (equipo+descripción+tipo); se pueden **parar** (cierra la OT con flag "parado") y **reactivar** (crea nueva OT desde una fecha), solo desde la última cerrada de la cadena y sin otra abierta.
7. **Filtros de pantalla**: tabs "Todas / Pendientes / Completadas", toggle "≤ Mañana", filtros por equipo de trabajo/tipo/fechas/búsqueda, orden por columnas, paginación en servidor para el histórico.
8. **Informe PDF** de las OTs filtradas.

### Diferencias con GMAO_HFS (conservar lo tuyo)

- Tu modelo tiene `title`, `priority` (Baja→Crítica), `section`, `collaborators`, `subtasks`, `comments`, `events` (histórico append-only), `relatedIncidentId` — **todo esto se conserva**; Pulso no lo tiene.
- Estados distintos: tú usas `Pendiente/Programada/En Progreso/Completada`; Pulso `Pendiente/Activo/Completado/Cancelado`. Decide si añadir "Cancelada" (Pulso la usa y es útil).
- Pulso no tiene "Programada" ni asignación por grupos; tú sí (Scheduler + `assignedGroupId`).

**Ideas a portar (recomendado)**: checklist de cierre con respuestas; ajustes rápidos de fecha prevista (+7d/+15d/+30d); trabajo externo con precio; parar/reactivar cadena preventiva; informe PDF filtrado; tipo "Mejora/Predictivo" si te encaja.

---

## 2. Partes de trabajo (el concepto estrella de Pulso)

**Equivalente GMAO_HFS**: parcial — `components/LiveTimer.tsx` (cronómetro de sesión) y `timeSpentMinutes`/`timeSource` en `WorkOrder`. Pulso tiene un modelo de **partes** mucho más rico. → **PORTAR** (si quieres control horario de operarios)

### Reglas de comportamiento

- Un **parte** = intervalo de trabajo de un usuario en una OT: `fechaInicio`, `fechaFin`, notas, comentario, repuestos usados, `terminado`, `otId`, `usuarioId`.
- **"▶ Entrar a trabajar"**: crea parte abierto, pone la OT en `Activo`, borra el parte planificado del día. Exige cerrar un parte abierto previo (solo uno a la vez).
- **"● Registrar salida"**: hora de salida editable, notas, repuestos consumidos, y opción "Cerrar solo mi parte" o "Cerrar OT".
- **Partes planificados** (creados desde el Gantt): tienen hora inicio/fin pero aún no se han trabajado.
- **Parte "con problema"** = sin fin, fin < inicio o sin inicio → herramienta admin "Limpiar y cerrar partes" masiva.
- **Bloqueo de 7 días**: pasado ese plazo, el horario de un parte solo lo puede editar un admin.
- Validación de **solapamiento**: un operario no puede tener dos partes a la vez; al editar/mover se recalcula.
- Cada parte puede consumir repuestos (→ §4).

---

## 3. Planificador Gantt / "Mis Partes"

**Equivalente GMAO_HFS**: `modules/Scheduler/` (`Scheduler.tsx`, `useScheduler.ts`). → **ADAPTAR / PORTAR interacciones**

### Reglas de comportamiento (ver también `03-pantallas.md`)

- Vista diaria por operario; drag&drop de OT → parte planificado de 1 h; mover/redimensionar bloques con snap de 15 min; zoom por rueda del ratón.
- Colores: verde = OT completada, azul = trabajo real, naranja = solo programado.
- Validaciones al planificar: OT cerrada, permiso por equipo de trabajo, fecha >7 días, ausencias, solapamiento.
- Encargados solo planifican operarios de su equipo de trabajo (admin, cualquiera).
- Operarios "observadores" no aparecen en el Gantt.
- **"Mis Partes"** (vista móvil del operario): timeline del día con drag/resize + editor de parte (horas, notas, repuestos).

**Ideas a portar**: colores por estado del bloque, validación de ausencias al planificar, snap de 15 min, zoom horario, vista "Mis Partes" para el operario (encaja con rol Técnico).

---

## 4. Repuestos / stock

**Equivalente GMAO_HFS**: `modules/Inventory/`, `Inventory.tsx`, `components/inventory/`, `services/inventoryService.ts`, tipos `InventoryItem`/`InventoryMovement`/`PurchaseOrder`. → **ADAPTAR**

### Reglas de comportamiento de Pulso

- **Stock disponible** = stock físico − comprometido en OTs abiertas (distinción visible en tabla).
- Stock mínimo/máximo con alertas ("Alertas stock" en dashboard y badge en topbar).
- **Estados del repuesto**: `nuevo` / `usado` / `reparado` (modo avanzado con precios estimados por % o fijos por estado).
- **Unidades trackeadas** por nº de serie/lote (cada unidad con estado, reparaciones, baja).
- **Reparaciones**: envío a taller (lote con reparador/precio) → recepción: "reparada" pasa a `Reparado`, "sin reparar" pasa a `Usado`; posibilidad de tirar/baja con motivo.
- **Movimientos** (`movimientosStock`): entrada (compra con precio/proveedor), salida, regularización con motivo, reparación, traslado. Cada movimiento registra usuario, fecha, OT asociada, precio.
- **Consumos pendientes de confirmación**: el operario consume repuestos desde su parte; si no es almacén/admin, el consumo queda `pendienteConfirmacion` y almacén lo confirma o ajusta.
- **Lista de la compra** generada de stock bajo, con copia al portapapeles.
- **Grupos de repuestos** (drag&drop) y **informe valorado** Excel/PDF.
- **QR por repuesto** con el stock actual impreso en la etiqueta.

### Diferencias con GMAO_HFS (conservar lo tuyo)

- Tú ya tienes `sku`, `suppliers` (histórico de precios por proveedor), `linkedEquipmentIds`, `PurchaseOrder` con estados (Solicitado→Recibido), escáner QR (`QRScannerModal`), `critic`. **Todo se conserva**.
- Tus movimientos son `IN/OUT` simples; Pulso añade estados de material y reparaciones.

**Ideas a portar**: distinción stock físico vs comprometido; estados nuevo/usado/reparado; flujo de reparaciones; consumos pendientes de confirmación; lista de la compra; QR con stock.

---

## 5. Mantenimiento preventivo

**Equivalente GMAO_HFS**: `services/preventivePlanService.ts`, tipo `PreventivePlan`, módulo `modules/Maintenance` / `Scheduler`. → **ADAPTAR**

### Reglas de Pulso

- Periodicidad por OT (0/7/15/30/90/365 días; 0 = mismo día). Al **completar** una OT Preventivo/Predictivo con periodicidad, se **genera automáticamente la siguiente** (Pendiente, fecha = fecha real + periodicidad) y se **heredan los adjuntos** de la anterior.
- Vista de **plan semanal/mensual** con tarjetas por ejecución cuya longitud refleja la periodicidad; colores: vencida/pendiente/completada/cancelada.
- Días marcados como **festivos** con notas (los planes no se planifican en festivos).
- Periodicidad manual por plan (preferencia local del usuario).
- Parar/reactivar una cadena de preventivos (§1).

**Diferencias**: tu `PreventivePlan` tiene `tasks` (subtareas), `lastRun`/`nextRun` y grupo asignado — se conserva. Pulso agrupa por "clave de plan" (equipo+descripción) en vez de entidad Plan.

**Ideas a portar**: auto-generación de la siguiente OT al completar + herencia de adjuntos; vista de calendario de planes; festivos.

---

## 6. Equipos (árbol, aceptación, costes)

**Equivalente GMAO_HFS**: `modules/Equipment/`, `components/EquipmentSelector.tsx`, `services/equipmentService.ts`, tipo `Equipment` (ya con `parentId` para árbol, `qrCode`, `documents`). → **ADAPTAR**

### Reglas de Pulso

- Árbol jerárquico con tipos: agrupación / línea / equipo / componente; drag para reordenar; ocultar nodos.
- Estados de equipo: producción / mantenimiento / parado.
- Ficha: fabricante, modelo, nº serie, año, fecha de puesta en marcha, descripción larga, 3 características libres.
- **Aceptación de máquina** (solo equipos, no componentes): vistos buenos por departamento (nombre, usuario, fecha), formaciones (receptor, impartido por, fecha), manuales OK, documentación de conformidad OK. Detalle con vistas de impresión y enlaces a archivos por categoría (procedimientos/manuales/conformidad).
- **Costes por equipo** (solo admin): horas de mano de obra (con coste/hora por operario o genérico) + repuestos + trabajos externos, agregado por subárbol; inventario valorado de repuestos.
- **QR por equipo** con etiqueta (código + nombre) copiable como imagen.

### Diferencias (conservar lo tuyo)

- Tu `Equipment` ya tiene `documents`, `photoUrl`, `sections`, `SupplierInfo`, estados ('Nuevo'…'Baja') — se conserva; la aceptación de máquina de Pulso es adicional.

**Ideas a portar**: aceptación de máquina (vistos buenos/formaciones/manuales/conformidad) — muy útil en puestas en marcha; costes por subárbol; estados de equipo producción/mantenimiento/parado si te encajan.

---

## 7. Solicitudes

**Equivalente GMAO_HFS**: `modules/Incidents` + `components/PurchaseRequestModal.tsx`/`PurchaseProcessModal.tsx` (solicitudes de compra). → **ADAPTAR**

### Reglas de Pulso

- Cualquier usuario crea solicitudes de tipo "Orden de trabajo" o "Compra" con descripción y comentarios.
- Gestión por gestores: **Aprobar** genera una OT Correctiva Pendiente (tipo orden) o un repuesto (tipo compra); **Rechazar** con estado final. Historial de resolución (quién/cuándo).
- Comentarios colaborativos en la solicitud.

**Diferencias**: tu flujo de `PurchaseOrder` (Solicitado→Recibido con líneas y recepción parcial) es más completo — **consérvalo**. La idea de Pulso de "solicitud aprobada → OT" se parece a tus incidencias → OT (`relatedIncidentId`).

---

## 8. Usuarios, roles y ausencias

**Equivalente GMAO_HFS**: `modules/Users.tsx`, `components/users/`, `services/userService.ts`, `hooks/usePermissions.ts`, tipos `User`/`UserRole`/`UserPermission`. → **ADAPTAR / PORTAR ausencias**

### Roles

| Pulso | GMAO_HFS (conservar el tuyo) |
|---|---|
| admin | Admin |
| encargado / segundo_encargado | Responsable Sección |
| operario | Técnico |
| almacen | (nuevo si quieres el rol almacén para stock) |
| observador | Observador N1 / N2 |

Permisos Pulso: gestores (admin/encargado) editan OTs y planifican; solo admin borra OTs/usuarios, edita partes >7 días, importa y resetea; almacén gestiona repuestos y confirma consumos; observadores solo lectura (fuera del Gantt).

### Funciones de usuario en Pulso

- PIN de 4 dígitos por usuario (login). Tú usas email/contraseña con perfil — se conserva lo tuyo.
- Campos: especialidad, **coste/hora** (para costes de OT), equipos de trabajo principal + secundarios, visible en Gantt, activo.
- **Ausencias** por usuario: vacaciones / salud / otros, con rango de fechas, control de solapes, aviso si ya tiene partes planificados. **Bloquean la planificación en el Gantt**.
- Precio/hora genérico configurable (para usuarios sin coste propio).
- "Cerrar partes" masivo desde administración (higiene de datos).

**Ideas a portar (recomendado)**: ausencias con bloqueo de planificación; coste/hora por usuario para informes de coste.

---

## 9. Archivos y adjuntos

**Equivalente GMAO_HFS**: `EquipmentDocument` en equipos, `Attachment` en OTs/incidencias. → **ADAPTAR**

### Reglas de Pulso

- Repositorio global de archivos (fotos y PDF) asociados a equipos y OTs, con **categorías**: procedimientos, manuales, conformidad, revisiones/calibraciones, planos.
- Subida con **compresión de imagen** (máx. 1600px, JPEG 0.82) y PDFs tal cual.
- Al subir: elegir categorías y **relacionar con OTs**; editar/reasignar relaciones después; añadir un archivo a varios equipos.
- **Herencia de adjuntos**: al generar la siguiente OT preventiva, se copian los adjuntos de la anterior.

**Ideas a portar**: categorías de documento (encaja con tus `EquipmentDocument`), compresión de imagen, herencia de adjuntos en preventivos.

---

## 10. Dashboard y alertas

**Equivalente GMAO_HFS**: `modules/Dashboard`, `components/DashboardSkeleton.tsx`. → **ADAPTAR**

- KPIs clicables (OTs pendientes, OTs activas, horas hoy, alertas stock) que navegan a la pantalla correspondiente.
- Badges persistentes en topbar/sidebar: OTs pendientes (rojo), stock bajo (ámbar), solicitudes pendientes.

**Ideas a portar**: KPIs navegables y badges de alerta (si aún no los tienes).

---

## 11. QR

**Equivalente GMAO_HFS**: ya tienes `qrcode.react` + `QRScannerModal` + `qrCode` en tipos. → **ADAPTAR**

Pulso genera **miniaturas QR clicable** en Equipos y Repuestos que copian al portapapeles una **etiqueta imagen** (QR + código + nombre [+ stock]) lista para imprimir. Sin escáner (solo generación).

**Ideas a portar**: etiqueta con stock para repuestos; copiar etiqueta como imagen.

---

## 12. Informes y exportación

**Equivalente GMAO_HFS**: `modules/Reports.tsx`, `services/reportService.ts`. → **ADAPTAR**

- **Excel** multi-hoja (OTs, Partes, Equipos, Repuestos, Movimientos, Usuarios, Equipos de trabajo, Proveedores) — Pulso usa la librería SheetJS.
- **Informe PDF de OTs filtradas** (maquetación propia con bloques por OT).
- **Inventario valorado** de repuestos (Excel/PDF) y costes por equipo (solo admin).

---

## 13. Sincronización multi-dispositivo

→ Ver `06-api-cliente.md`. GMAO_HFS usa Supabase realtime (ya resuelto), pero hay **patrones de robustez** de Pulso que merece la pena copiar (cola de guardado, salvaguarda anti-borrado masivo). → **PORTAR ideas**

---

## 14. Multi-tema (4 temas)

**Equivalente GMAO_HFS**: dark mode con clase. → **PORTAR** (diseño)

Pulso tiene 4 temas conmutables desde el sidebar (azul/claro/oscuro/suave) aplicados con variables CSS. Ver `01-sistema-visual.md` para la implementación con Tailwind. Si quieres conservar solo claro/oscuro, usa los tokens de los temas azul y oscuro.

---

## 15. N/A para GMAO_HFS

| Función de Pulso | Por qué no aplica |
|---|---|
| Importar Lumina (CSV/Excel masivo) | Es una migración puntual desde otro producto; no necesitas importador |
| Backup JSON / Cargar backup / Reset 100% | Supabase gestiona la persistencia; equivalente = respaldos de la BD |
| Login por PIN con `authHeaders` | Tú usas perfiles + Supabase RLS |
| "Reparar estados de OTs" | Reíndice interno del backend PHP; sin equivalente |
| Almacén de archivos con API key propia | Usa Storage de Supabase o URLs existentes de `EquipmentDocument` |
