# MaintPro — Auditoría 2026-07-23

> Anteriores: 40/40 resueltos ✅ · Tests 102/102 (10 archivos) · Typecheck ✅
> **Pendientes: 0 issues · 49/49 resueltos · 2 sin fix (1 falso positivo, 1 by design)**

---

## 🔴 Críticos (7 · ✅ 0 pendientes)

1. **`workOrderService.ts:100-101`** — `created_at` incluido en payload de `update()`. Envío redundante (no corrupto porque el frontend siempre manda el mismo valor). El modal permite editarlo como admin (WorkOrderDetailModal.tsx:756), así que NO se debe eliminar. **No requiere fix — falso positivo de la auditoría.**
2. **[FIXED]** `workOrderService.ts:150` — Borrado de attachments por URL sin filtrar `parent_id`. Si dos WOs (u otras entidades) comparten fichero, se borran attachments ajenos → **pérdida de datos**. Fix: añadir `.eq('parent_id', wo.id).eq('parent_type', 'work_order')` al delete.
3. **[FIXED]** `inventoryService.ts:95-103` — `registerMovement` inserta movimiento pero **no actualiza `inventory.quantity`**. Fix: nuevo RPC `register_inventory_movement` en PostgreSQL. `inventoryService.ts` llama al RPC. Eliminados ajustes manuales de stock en `Inventory.tsx`. **Requería ejecutar `database/migration_register_movement_rpc.sql` en Supabase — ejecutado por el usuario.**
4. **[FIXED]** `modules/Inventory.tsx:119-195` — `handleCheckoutConfirm` tenía dos bloques `if (woId)` separados, y `onUpdateItem` escribía `inventory.quantity` en DB después de que el RPC ya lo hubiera hecho → doble write a DB. Fix: consolidado en un solo `if/else`; `registerMovement` dentro del mismo bloque que `onUpdateWorkOrder`; el store se actualiza localmente vía `setInventory` sin tocar DB.
5. **[FIXED]** `modules/Inventory.tsx:636` — `receivedList.forEach(async rec => {...})` promesas fire-and-forget. Nunca se esperaban. Además: doble write a DB (mismo patrón #4). Fix: `Promise.allSettled` + actualización store vía `setInventory` + toast resumen. El modal no se cierra hasta terminar.
6. **[FIXED]** `createUISlice.ts:18` — Listener `matchMedia('change')` añadido al crear el store y **nunca removido**. En HMR se acumulan listeners. Fix: movido a `useEffect` en `App.tsx` con `removeEventListener` en cleanup.
7. **[FIXED]** `store/slices/createWorkOrderSlice.ts` + `createPreventivePlanSlice.ts` + `createDataSlice.ts` + `createIncidentSlice.ts` — `StateCreator<any, ...>` sin type safety. Fix: extraído `AppState` a `store/appState.ts`, los 4 slices ahora usan `StateCreator<AppState, ...>`. El tipado estricto reveló 4 bugs ocultos en `createPreventivePlanSlice.ts` (missing `id`, `comments`, `WOType`, subtask `id`).

## 🟡 Altos (12)

8. **[FIXED]** `createPreventivePlanSlice.ts:99-117` — WO creado en DB y store, pero si `updateDates` fallaba, el plan NO actualizaba `lastRun`/`nextRun` en DB → recarga generaba WO duplicado. Fix: invertir orden (`updateDates` antes que crear WO) y unificar ambos `set()` en uno solo. Si `updateDates` falla no se crea WO. Si WO falla tras fechas, se pierde 1 ciclo (menos grave que duplicados).
9. **[FIXED]** `createIncidentSlice.ts:85-136` — Stale closure: `incident` capturado en línea 86, pero entre líneas 86 y 137 había operaciones async. Fix: re-leer incidente de `get()` justo antes del check de duplicados, eliminando la dependencia de la variable stale.
10. **[FIXED]** `createIncidentSlice.ts:116` — Fallback 409 usa `woData.id` (UUID cliente, no server). Si no encuentra WO en store, enlazaba incidente a ID inexistente. Fix: nuevo método `workOrderService.getByRelatedIncidentId()` que consulta DB directamente. Si no existe en DB, lanza error en vez de enlazar a UUID fantasma.
11. **[FIXED]** `incidentService.ts:39-46` — Falsy check (`if (updates.title)`) impedía limpiar campos. Fix: todos los checks cambiados a `!== undefined`, igual que `equipmentId` y `workOrderId` ya tenían.
12. **[FIXED]** `LiveTimer.tsx:10-31` vs `WorkOrderDetailModal.tsx:105` — `calculateActiveSeconds` en LiveTimer NO ordenaba cronológicamente el history (el modal sí). Fix: añadido `sort` por timestamp al inicio de la función en LiveTimer.
13. **[FIXED]** `hooks/useWorkOrderFilters.ts:103-119` — `useEffect` dependía de `[initialFilters]` (objeto, comparación por referencia). Si el padre pasaba nueva referencia cada render, efecto en bucle. Fix: `JSON.stringify(initialFilters)` en lugar del objeto directo, comparación por valor.
14. **[FIXED]** `modules/Maintenance/components/MaintenancePreventivePlans.tsx:38-52` — `.sort()` mutaba el array dentro de `useMemo`. Fix: `result = [...result].sort(...)` para no mutar el array memoizado.
15. **[FIXED]** `Scheduler.tsx` (768L) — Refactor a `modules/Scheduler/`: `useScheduler.ts` (hook con toda la lógica), `Scheduler.tsx` (contenedor, 131L), componentes (`SchedulerToolbar`, `SchedulerGrid`, `SchedulerCard`, `UnassignedSidebar`, `SubtaskAssignmentModal`) y helpers en `utils/dateUtils.ts` + `hooks/useMediaQuery.ts`. Eliminado el archivo único `modules/Scheduler.tsx`; `App.tsx` lazy-carga el barrel `modules/Scheduler/index.tsx`.
16. **[FIXED]** `modules/Inventory.tsx:119-195` — Duplicado de #4. Misma solución aplicada.
17. **[FIXED]** `skillsService.ts:94` — `validation_date` sobreescrito en cada `updateUserSkill` aunque solo cambie `level`. Fix: separar en dos pasos — SELECT para ver si existe, luego UPDATE (solo level) o INSERT (con validation_date).
18. **[FIXED]** `modules/Equipment/components/EquipmentModal.tsx:119-125` — Nuevo equipment casteado `as Equipment` sin `id`. Fix: `id: crypto.randomUUID()` antes de enviar al store.
19. **[FIXED]** `modules/Incidents/components/IncidentDetail.tsx:144-159` — WO vinculada no clickable. Fix: convertido a `<button>` con `onNavigateToWorkOrder` que cierra el modal y navega a Maintenance.

## 🟠 Medios (18)

20. **[ALREADY CORRECT]** `createWorkOrderSlice.ts:84-86` — La descripción indicaba store update antes de addComment, pero el código actual ya tiene el orden correcto (store update después de las async ops). Probablemente corregido en refactors previos.
21. **[FIXED]** `createWorkOrderSlice.ts:42-44` — `scheduledDate` auto-asignado en `updateWorkOrder` sobrescribía valores intencionales. Movido a `addWorkOrder` (creación) como valor por defecto; eliminado de `updateWorkOrder`.
22. **[FIXED]** `createDataSlice.ts:302` — `newComments.sort()` mutaba array en state reducer. Cambiado a `[...newComments].sort()`.
23. **[FIXED]** `createDataSlice.ts:78-98` — `subscribeEntity` capturaba `channel` vía closure antes de su declaración `const`. Movida declaración de `channel` antes de `subscribeEntity`.
24. **[FIXED]** `services/workOrderService.ts:122` — `if (wo.attachments)` truthy para `[]`. Cambiado a `&& wo.attachments.length > 0`.
25. **[FIXED]** `services: update sin .select()` — Añadido `.select().single()` a 8 funciones update en 6 services (workOrder, equipment, inventory, user, section, preventivePlan). Ahora devuelven datos reales DB mediante mappers.
26. **[FIXED]** Servicios sin paginación — Añadido `PaginationParams` opcional a todos los `getAll`. `range()` aplicado cuando se proporcionan params. Total de 9 servicios actualizados. Store y componentes sin cambios (compatible hacia atrás).
27. **[FIXED]** `utils/mappers.ts:232` — `mapInventoryMovement` return type cambiado de `any` a `InventoryMovement`.
28. **[FIXED]** `components/WorkOrderDetailModal.tsx:371-394` — `compressImage` ya manejaba no-imágenes (las devolvía sin cambios), pero añadida guarda explícita `file.type.startsWith('image/')` para evitar overhead innecesario con PDFs/videos.
29. **[FIXED]** `components/WorkOrderDetailModal.tsx:610` — `completionNotes` se pasaba como `pendingReason`, mostrando "Motivo" en lugar de "Notas" en el comentario de sistema para COMPLETED. Corregida semántica en el texto del comentario.
30. **[FIXED]** `components/WithdrawalCheckoutModal.tsx:122` — Textarea tenía `disabled={!!selectedWOId}` contradiciendo el comentario inline. Eliminado el disabled (textarea siempre interactivo; validación ya maneja opcionalidad vía placeholder).
31. **[FIXED]** `FormInput.tsx`, `FormTextarea.tsx`, `FormSelect.tsx` — Añadido `htmlFor`/`id` vía `React.useId()` para asociación label-input.
32. **[FIXED]** `components/ui/VoiceInputButton.tsx:36` — Añadido `relative` al contenedor padre para que `absolute top-full right-0` del error se posicione correctamente.
33. **[FIXED]** `components/ui/StatCard.tsx:42` — `colorClasses.split(' ')[0]` cambiado a `.find(c => c.startsWith('bg-'))` para extraer clase de fondo de forma robusta frente a `dark:` y otros prefijos.
34. **[FIXED]** `components/ui/Modal.tsx:33-37` — Reemplazado `React.Children.map` + `cloneElement` por `React.createContext`. `Header` lee `titleId` del contexto en lugar de recibirlo vía prop inyectada. Funciona incluso con Fragment envolviendo Header.
35. **[FIXED]** `utils/searchUtils.ts` + `GenericTable.tsx` — `InventoryMovementsTable.tsx` y `useSearchFilter.ts` no normalizaban datos. Fix en ambos: datos ahora pasan por `normalizeForSearch`. Afectaba también a módulos Maintenance, Incidents y Equipment (vía hook).
36. **[FIXED]** `modules/Equipment/index.tsx:169` — Añadido `userIsInAlmacen` al check de acceso QR para que usuarios de Almacén puedan escanear equipos fuera de su sección, coherente con `useRestrictedEquipment`.
37. **[FIXED]** `modules/Reports.tsx:381-395` — Filtro fecha usaba `wo.closedAt || wo.createdAt`, incluyendo WOs abiertas. Ahora WOs sin `closedAt` solo se muestran si no hay filtro de fechas activo.

## 🔵 Bajos (12)

38. **[FIXED]** `modules/Inventory.tsx:75` — `useState(window.innerWidth < 1024)` cambiado a `useState(() => window.innerWidth < 1024)`.
39. **[FIXED]** `modules/Inventory.tsx:375` — Eliminado `animate-pulse` continuo del botón carrito.
40. **[FIXED]** `modules/Incidents/index.tsx:37` — `statusFilter` sí se usa en línea 86. Ya estaba corregido previamente o falso positivo de auditoría.
41. **[FIXED]** `modules/Equipment/components/EquipmentDocuments.tsx:91-112` — Añadida eliminación del fichero en Supabase Storage tras borrar referencia.
42. **[FIXED]** `modules/Equipment/components/EquipmentDocuments.tsx:153` — `grid-cols-3` cambiado a `grid-cols-2 sm:grid-cols-3` para mejor usabilidad táctil en mobile.
43. **[BY DESIGN]** `modules/Equipment/components/EquipmentDetail.tsx:66/150` — `'PREVENTIVE'` es un valor centinela intencional (diferente de `WOType.PREVENTIVE = 'Preventivo'`).
44. **[FIXED]** `modules/Users.tsx:551` — `sm:size-6` cambiado a `sm:w-6 sm:h-6`.
45. **[FIXED]** `modules/Users.tsx:95` — Añadido `id: crypto.randomUUID()` y eliminado `as any`.
46. **[FIXED]** `modules/Maintenance/components/MaintenanceWorkOrders.tsx:100` — `'Unknown'` cambiado a `'Desconocido'`.
47. **[FIXED]** `modules/Maintenance/index.tsx:99-102` — Reemplazado `useRestrictedItems` por `useMemo` directo con `[preventivePlans, currentUser, equipment]` como dependencias, eliminando stale closure.
48. **[FIXED]** `hooks/useSpeechRecognition.ts:18-27` — Añadido stop del `SpeechRecognition` anterior en efecto de `[lang]` y cleanup en unmount.
49. **[FIXED]** `hooks/useWorkOrderFilters.ts:73-90` — `customSortFns` envuelto en `useMemo` con `[equipment, users]` para no invalidar `useSortableData` en cada render.

---

## Resueltos tras la auditoría (sesión Programador)

50. **[FIXED]** `utils/mappers.ts` — Código muerto: el fallback `existing?.attachments` de `mapWorkOrder` nunca se ejecutaba (`.filter().map()` devuelve `[]`, truthy). Fix: helper `mapAttachments` que usa el fallback cuando el filtrado queda vacío. Test añadido (26 tests en mappers).
51. **[FIXED]** `store/slices/createUISlice.ts:17` — `window.matchMedia('…').matches` al crear el store crasheaba todos los tests (jsdom no implementa `matchMedia`). Fix: guarda defensiva (light mode si no existe) + mock global en `test/setup.ts`.
52. **[FIXED]** `hooks/usePermissions.test.ts` — Llamaba a un hook de React como función plana (falla "Invalid hook call") y las aserciones de inventario estaban desactualizadas (la sección ya no concede acceso; depende de `userPermissions`). Fix: el test monta un componente probe real (createRoot + flushSync); aserciones actualizadas a la lógica actual. 20 tests.
53. **[FIXED]** Botón Pausar/Reanudar — Tras pausar, `wo.status` seguía `IN_PROGRESS` y el botón seguía en "Pausar" sin permitir reanudar. Fix: nuevo `hasActiveSession()` en `utils/timeTracking.ts` distingue "en marcha" (sesión abierta) de "pausada" (cerrada); aplicado en `QuickStatusModal`, `WorkOrderCard` y `WorkOrderDetailModal` (botón, badge pulsante y LiveTimer).
54. **[FIXED]** `components/scheduler/WorkLogGantt.tsx` — Vista semanal: tarjetas del día superpuestas (`absolute top-1`). Fix: apilado flex + agrupación por WO/día (suma tiempos, franja primera–última) + fondos gradiente por tipo + tick local de 30s para refrescar sesiones activas sin consultar BD. Añadidos tests para el módulo Scheduler (components, `dateUtils`, `timeTracking`, `useMediaQuery`) → suite pasa de 55 a 102 tests.
55. **[DONE]** Rendimiento — `vite.config.ts`: `manualChunks` divide librerías vendor (supabase 165 kB, react-vendor 144 kB, motion, icons…). El chunk principal pasa de ~551 kB a código de la app (sin warning de build).

---

## Manejo de red (implementación adicional)

Se implementó gestión profesional de conectividad para evitar errores confusos al usuario:

| Archivo | Cambio |
|---------|--------|
| `hooks/useNetworkStatus.ts` | **Nuevo.** Hook que detecta `navigator.onLine` y escucha eventos `online`/`offline`. |
| `components/OfflineBanner.tsx` | **Nuevo.** Banner fijo superior (amber) con botón "Reintentar" cuando no hay conexión. |
| `store/slices/createDataSlice.ts` | `fetchInitialData` ahora: (1) check `navigator.onLine` antes de fetch, (2) un solo toast si falla todo, (3) reintento automático a los 3s si falla parcial, (4) toasts con `id` para evitar duplicados. |
| `App.tsx` | Usa `useNetworkStatus`, muestra banner, auto-reintenta al recuperar conexión vía evento `online`. |
| `index.css` | Animación `slide-down` para el banner. |

**Comportamiento:**
- **Sin internet al iniciar** → 1 toast + banner con "Reintentar"
- **Internet vuelve** → banner desaparece + datos se cargan solos
- **Fallo parcial** → warning + reintento automático

## Convenciones existentes (se mantienen)
- camelCase TS / snake_case solo columnas Supabase (mapper en `utils/mappers.ts`)
- UI español, enums español
- Sub-componentes usan `useAppStore` directo
- Stack: Vite+React+TS+Tailwind+Zustand+Supabase
- Comandos: `npm test` | `npx tsc --noEmit` | `npm run dev` (puerto 3000)
