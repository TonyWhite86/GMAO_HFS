# 06 — Capa de cliente / sincronización de "Pulso"

Cómo se comunicaba la app Pulso con su backend PHP+MySQL. GMAO_HFS usa **Supabase** (con realtime), por lo que el API en sí **no se porta**; lo valioso aquí son los **patrones de robustez** que conviene replicar o adaptar.

> Sin secretos: no aparecen claves, tokens ni URLs privadas.

---

## 1. Arquitectura de comunicación de Pulso

- SPA React + backend PHP propio sobre MySQL (Hostinger). Cada elemento se guarda como **fila independiente** (no bloques), lo que minimiza conflictos entre dispositivos.
- Auth en dos capas:
  1. **Clave de la app** (identifica "esta aplicación") en cada petición — header `X-Api-Key`.
  2. **Token de sesión por usuario** (login usuario+PIN → token) — header `X-Session-Token`. Caduca en servidor (respuestas `401` → vuelta al login).
- Escrituras en lote: `POST` con `{ops:[{coleccion, id, accion:"set"|"delete", data}]}`.

## 2. Superficie de la API (cliente)

| Endpoint | Función |
|---|---|
| `GET /` | `hydrate()`: descarga todo el dataset activo (colecciones §10 de `05`) |
| `POST {ops:[…]}` | `persist()`: escritura por lotes (set/delete por elemento) |
| `?action=version` | versión barata para sondear cambios sin descargar datos |
| `?action=archivo&…` | `fetchArchivo()`: OTs cerradas paginadas con filtros (equipo, operario, fechas, texto, orden) |
| `?action=nextOtId` | reserva atómica del nº de OT |
| `?action=login` / `logout` / `userlist` | sesión y lista de usuarios para el selector de login |
| `?action=costesPorEquipo` | agregado de horas+repuestos+externos por equipo (solo admin) |
| `?action=setOtCounter` / `setNombreEmpresa` / `setPrecioHoraGenerico` | ajustes puntuales |
| `?action=repararEstados` | repara índice interno del servidor |
| `?action=partesProblema` | partes abiertos/mal cerrados de un usuario |
| `?action=resetTotal` | borrado total (solo admin; valida también en servidor) |

Almacén de archivos: API aparte con `upload/list/delete/setMeta/heredarOT` y visualización por `?f=<ruta>`.

## 3. Flujo de estado (cliente)

1. **Arranque**: el estado global (`window.__GMAO_DATA__`) se inicializa con `hydrate()`; fallback a copia local (localStorage) si no hay servidor.
2. **Guardado**: `persist(d)` calcula **diffs** contra una caché local (`_lastSync`: `{coleccion: {id: JSON}}`) y envía solo lo cambiado (`set`) y los ids ausentes (`delete`).
3. **Sondeo multi-dispositivo**: cada ~12 s se consulta `version`; si cambió, `hydrate()` de nuevo (con aviso "Actualizar" manual y refresco al entrar en pantallas compartidas). El refresco automático no interrumpe modales abiertos.

## 4. Patrones de robustez (recomendables para GMAO_HFS)

### 4.1. Cola de guardado
Cada `persist()` espera a que el anterior termine antes de ejecutarse. Evita que dos guardados casi simultáneos (cerrar parte y luego la OT) lleguen en orden invertido y el lento "deshaga" el reciente.
**Adaptación**: en Supabase, aplicar cola en el `DataSlice` si haces escrituras compuestas; o usar transacciones/`rpc` para operaciones multi-tabla (p. ej. cerrar OT + insertar evento + descontar stock).

### 4.2. Salvaguarda anti-borrado masivo
Si un guardado vaciaría ≥50% de una colección con ≥20 elementos, **no se ejecuta** y se avisa (probable backup incompleto). Borrado real solo con acción explícita "Reset 100%".
**Adaptación**: proteger operaciones de borrado en lote con confirmación + umbral en tu lógica de servicios.

### 4.3. Diff incremental
Caché del último JSON por elemento → solo se envía lo que cambió. Reduce carga y conflictos.
**Adaptación**: Supabase realtime ya te da eficiencia; pero si haces importaciones masivas, envía por lotes con progreso (como el importador de Pulso).

### 4.4. Sesión con expiración explícita
Cualquier `401` dispara un único mecanismo: limpiar token → evento global → pantalla de login con aviso "sesión caducada".
**Adaptación**: patrón equivalente con Supabase Auth (`onAuthStateChange`) — tu `AuthSlice` puede mostrar el mismo aviso.

### 4.5. Fallback local
Si el servidor falla, se trabaja sobre la copia local y se reintenta guardar; aviso claro al usuario ("guardado local, vuelve a intentarlo").
**Adaptación**: opcional; con Supabase podrías usar optimistic updates + cola de reintento.

### 4.6. Reserva atómica de numeración
`nextOtId` se reserva en servidor (transaccional) para que dos dispositivos no generen el mismo número; si falla, fallback local.
**Adaptación**: contador en tabla con `rpc`/`increment`, o UUID si no necesitas correlativo visible.

### 4.7. Operaciones fuera del dataset
Las OTs cerradas no viajan en el dataset activo: se consultan paginadas (`fetchArchivo`) con filtros. Evita descargar el histórico completo.
**Adaptación**: buen patrón para tablas grandes — paginación en servidor en tus listados (ya usas `PaginationParams`/`PaginatedResponse`).

## 5. Lo que NO se debe portar

- Endpoints PHP, claves API (`X-Api-Key`), esquema MySQL, "reparar estados" y reset total por SQL: son internos del backend de Pulso. Tu fuente de verdad es Supabase (RLS, servicios en `services/`, migraciones en `database/`).
