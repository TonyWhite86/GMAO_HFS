# 03 — Pantallas de "Pulso · Mantenimiento"

Descripción de cada pantalla: layout, secciones e interacciones. Sirve como guía de UX al portar funcionalidades a GMAO_HFS (mapeo de módulos en `04-funcionalidades.md`).

---

## Estructura global

- **Sidebar izquierdo** (230px): logo "Pulso · Mantenimiento", nombre de la empresa configurable, navegación con badges de alerta, usuario actual y selector de temas (4 temas) al pie.
- **Topbar** (54px, con degradado de marca): badges "OTs pendientes" / "Stock bajo", reloj y acciones globales solo-admin (Exportar Excel, Backup JSON, Cargar backup, Reset 100%).
- **Navegación**: al entrar en pantallas compartidas (Órdenes, Repuestos, Solicitudes, Equipos) se recargan datos del servidor. Refresco automático cada ~12 s si cambió la versión de datos; botón "Actualizar" manual.

## Login

Lista de usuarios con buscador (tarjetas con avatar/iniciales, nombre y rol) → al elegir, campo **PIN de 4 dígitos** → botón "Entrar →" (gradiente azul, sombra). Permite "← Cambiar usuario". Aviso visible cuando la sesión caducó. El PIN se valida en servidor (no en el cliente).

## Home / Dashboard

- **Fila de KPIs clicables** (stat-cards): OTs Pendientes, OTs Activas, Horas hoy, Alertas de stock → cada tarjeta navega a la pantalla correspondiente.
- **Últimas 8 OTs** con badges de tipo/estado.
- **Tarjeta de repuestos con stock bajo**.
- **Partes de hoy** (máx. 5) con acceso rápido al Planificador.

## Planificador de partes (Gantt) — la pantalla estrella

Vista tipo Gantt **diaria**:

- **Filas = operarios** (no equipos). Filtros: equipo de trabajo, persona, búsqueda y rango de fechas. Cabecera con totales de horas y nº de operarios.
- **Columna izquierda**: lista de OTs arrastrables (id mono, tipo, fecha prevista con semántica de color: vencida=rojo, hoy=ámbar). Botón "Entrar a trabajar" directo en la tarjeta de OT.
- **Franja horaria** con zoom por rueda del ratón (base 80px/hora, botón de restablecer con %).
- **Drag & drop**: arrastrar OT a la fila de un operario crea un **parte planificado** de 1 h. Validaciones: OT cerrada, permiso por equipo de trabajo, fecha >7 días, **ausencias del operario**, solapamiento con otro parte.
- **Bloques**: verde = OT completada, azul = trabajo real, naranja = solo programado. Arrastrar mueve el bloque; asas laterales redimensionan (snap de 15 min, sin solaparse).
- **Clic en bloque** → modal "Editar Parte" (cambiar operario/fecha/horas, botón "Trabajar" en la OT, borrar parte).
- Botón de restablecer zoom; indicador de hora actual (marcador rojo con la hora).
- Los partes de OTs cerradas del día se cargan aparte para ver histórico.

## Órdenes de Trabajo

- **Tabs/filtros**: "Todas", "Pendientes" (Pendiente+Activo), "Comp."; toggle "≤ Mañana"; filtros por equipo de trabajo, tipo, fechas, búsqueda. Orden por columnas y paginación (pendientes en cliente; Todas/Comp. paginadas en servidor).
- Botones: **Nueva OT Correctiva**, **Informe PDF** con los filtros aplicados.
- **Tabla**: badges tipo/estado/criticidad, fecha prevista con botones rápidos "+7d/+15d/+30d", botones **▶ Entrar / ● Salir** (modal de trabajo), Editar (gestores), Borrar (solo admin).
- **Panel detalle de OT**: ficha completa, Entrar/Salir, repuestos usados, **partes de trabajo** con "Gestionar" y "Limpiar y cerrar partes" (admin), adjuntos (por equipo), checklist de cierre, "Editar OT".
- **Modal Nueva/Editar OT**: equipo (selector de árbol), tipo, criticidad, descripción, trabajo **externo** (empresa + precio), **periodicidad** (0/7/15/30/90/365 días), checklist de puntos, fecha, estado (Pendiente/Activo/Completado; Cancelado solo si ya lo era), equipo de trabajo, "Asignado a", repuestos consumidos.
- **Cadena preventiva**: misma equipo+descripción+tipo; botones "Activo/Parado" y "Reactivar" (solo desde la última cerrada y sin otra abierta).
- **Modal Partes**: alta/edición/borrado de partes con validación de solapamiento y parte abierto único; bloqueo de edición de horario si el parte tiene >7 días (solo admin puede forzar).

## Mis Partes (vista del operario)

- Selector de día, resumen (total horas, completados, abiertos).
- **Línea de tiempo** con bloques drag/resize (snap a huecos libres, sin solapes; bloqueado si el parte tiene >7 días).
- Lista de partes abiertos/completados → **editor de parte**: horas inicio/fin, notas, comentario y **repuestos usados** (descuenta stock y crea movimientos; consumos quedan pendientes de confirmación si el usuario no es almacén/admin), validación de solapamiento.

## Equipos (árbol)

- **Árbol jerárquico** (agrupación/línea/equipo/componente) con drag para reordenar, editar, ocultar, buscador y panel de **grupos de equipos**.
- **Detalle del equipo** con **QR** clicable (copia etiqueta QR + código + nombre) y botón "Nueva OT" (abre Órdenes con la OT preseleccionada).
- **Pestañas**: Info, Historial (OTs del subárbol), Repuestos vinculados, Archivos, **Aceptación** (solo máquinas), **💰 Costes** (solo admin: mano de obra, repuestos y trabajos externos agregados por subárbol).
- **Modal de equipo**: ID, tipo, padre, ubicación/zona, estado (producción/mantenimiento/parado), fabricante/modelo/serie/año/puesta en marcha, y editor de **aceptación de máquina** integrado.
- **Aceptación de máquina**: vistos buenos por departamento, formaciones impartidas, manuales OK, documentación de conformidad OK — con detalle imprimible y enlace a archivos por categoría.

## Repuestos / Almacén

- Tabla con **stock disponible** (físico − comprometido en OTs), control min/max, filtros (texto, proveedor, grupo, pendientes de confirmar), orden y paginación.
- Panel de detalle con **QR de stock** y acciones: **+ Entrada / − Salida / ⇄ Estado / 🔧 Reparar**.
- **Movimientos**: entrada (compra con precio/proveedor), salida, cambio de estado (nuevo/usado/reparado), envío a reparación y recepción (reparada → Reparado; sin reparar → Usado), baja/tirada. Unidades trackeadas por nº de serie/lote (modo avanzado).
- **Consumos pendientes**: los consumos de operarios quedan pendientes y almacén/admin los confirma.
- **Lista de la compra** con copia al portapapeles; panel global "En reparación"; **informe valorado** Excel/PDF; **grupos de repuestos** con drag&drop.
- Form de repuesto: precio unitario, proveedor habitual, regularización de stock con motivo.

## Archivos

- **Repositorio global**: buscador por texto/máquina/OT, filtros de categoría (procedimientos, manuales, conformidad, revisiones/calibraciones, planos), foto/archivo, incluir subequipos.
- **Subida** con compresión de imágenes (máx. 1600px) y confirmación (categorías + relación con OTs).
- **Archivos por equipo** (reutilizado en Equipos y OT): subida, editar/reasignar/borrar (admin), añadir a otro equipo, abrir/descargar.

## Plan de Mantenimiento (preventivos)

- Solo gestores. Vista **semana/mes** de planes (clave plan = equipo + descripción).
- **Tarjetas por ejecución** que se alargan según la periodicidad, coloreadas por estado (vencida/pendiente/completada/cancelada).
- Navegación por periodos, filtro por equipos de trabajo, búsqueda, ocultar/mostrar planes, periodicidad manual por plan (preferencia local).
- **Día del plan** (modal): marcar día como **festivo** y/o nota.
- Clic en tarjeta → **detalle de ejecución** (abre la OT correspondiente).

## Solicitudes

- Cualquier usuario crea solicitudes tipo **"Orden de trabajo"** o **"Compra"** (descripción + comentarios). Tabs Pendientes/Resueltas.
- Gestión (gestores): **Aprobar** → si es "orden" genera una OT Correctiva Pendiente; si es "compra" genera un repuesto → estado "aprobada". **Rechazar** → "rechazada".
- Detalle con edición (solo mientras está pendiente y por creador/gestor) y **comentarios**.
- Badge de pendientes en el sidebar.

## Administración (solo gestores; almacén solo ve Proveedores)

- **Pestañas**: General, Usuarios, Equipos de Trabajo, Proveedores.
- **General**: nombre de la empresa (aparece en el sidebar) y botón "Reparar estados de OTs" (repara índice interno del servidor).
- **Usuarios**: alta/edición (nombre, rol, PIN, especialidad, equipos de trabajo principal + secundarios, activo, **coste/hora**, visible en Gantt), activos/inactivos, borrado (la cuenta admin reservada no se borra), **precio/hora genérico**, **ausencias** por usuario (vacaciones/salud/otros con rango de fechas, control de solapes y aviso si ya tiene partes), y "Cerrar partes" masivo.
- **Equipos de trabajo**: con encargado asignado.
- **Proveedores**: contacto, teléfono, categoría, activo.
- **Topbar admin**: Exportar Excel (hojas: OTs, Partes, Equipos, Repuestos, Movimientos, Usuarios, Equipos Trabajo, Proveedores), Backup JSON (incluye OTs cerradas), Cargar backup (sobrescribe todo, ajusta contador de OTs), **Reset 100%** (exige escribir "BORRAR TODO").

## Importar Lumina (solo admin)

- Importación masiva desde otro GMAO ("Lumina"): 8 CSV reconocidos por contenido (agents, areas, equipment, group_definitions, plan_tasks, plans, relationships, work_orders) + Excel de inventario de repuestos opcional.
- Flujo: detectar → **"1. Calcular vista previa"** (fusión con datos existentes; los datos importados ganan conflictos pero no se borran datos manuales) → resumen por colección → **"2. Importar"** en lotes con barra de progreso y ajuste del contador de OTs.
- Mapeo de estados: `completed→Completado`, `in_progress→Activo`, `cancelled→Cancelado`, `scheduled→Pendiente`. Periodicidad inferida del nombre del plan ("(DIARIO)", "TRIMESTRAL"…). Fin de partes calculado en jornadas de 8 h por operario.
