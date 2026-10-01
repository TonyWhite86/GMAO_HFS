# Módulo Programador — Flujo validado

## Estados de la Work Order

```
Pendiente ──(asignar en programador)──→ Programada
Pendiente ──(empezar a trabajar)──────→ En Progreso
Programada ──(empezar a trabajar)─────→ En Progreso
En Progreso ──(completar manualmente)─→ Completada
```

- La WO **nunca retrocede** de estado.
- "En Progreso" significa que al menos una persona ha registrado tiempo, aunque ahora mismo nadie esté trabajando.

## Programación sin asignar

Una WO puede tener `scheduledDate` sin `assignedUserId`. En el grid del Programador aparece en una **fila "Sin asignar"** flotando en el día correspondiente. Cualquier técnico puede arrastrarla a su fila para auto-asignarse, o un responsable puede arrastrarla a un técnico.

Flujo:
1. Crear WO → Pendiente (sin fecha, sin técnico)
2. Programar → se le asigna `scheduledDate` (sigue sin `assignedUserId`) → aparece en fila "Sin asignar"
3. Asignar → se le asigna `assignedUserId` (sigue Programada)

## Work Log (Parte de Trabajo)

**No se necesita nueva tabla ni nuevos botones.** El control de tiempo ya existe en `WorkOrderDetailModal.tsx`:
- Botón **Iniciar** → comienza a contar tiempo
- Botón **Pausar** → detiene el contador, guarda `timeSpentMinutes`
- Botón **Finalizar** → completa la WO

El `statusHistory` registra cada transición con timestamp. El `timeSpentMinutes` acumula el total. No se requiere implementar nuevos botones ni lógica base.

### Para el Programador

Lo que hay que añadir es la **visualización** del tiempo trabajado:

- En cada tarjeta de WO del grid → mostrar `timeSpentMinutes` acumulado
- En la pestaña "Parte de Trabajo" (nueva, dentro del Programador) → diagrama Gantt con barras por técnico, usando los datos existentes de `statusHistory` y `timeSpentMinutes`

El Gantt tomaría los periodos `En Progreso` del `statusHistory` para dibujar las barras de cada WO, agrupadas por técnico.

## Permisos de acceso

| Rol | Programación | Parte de Trabajo |
|---|---|---|
| Admin | Todo | Todas las secciones y trabajadores |
| Responsable Sección | Su sección | Su sección + la suya propia |
| Técnico | ❌ | Solo su propio parte |
| Observador N1/N2 | ❌ | ❌ |

- Técnicos no ven la pestaña "Programación", solo ven su propio parte de trabajo.
- Se puede integrar dentro del mismo módulo Scheduler con dos pestañas, o separar en una vista aparte para técnicos.

## Estructura del Programador (dos pestañas)

### Pestaña 1: Programación
Grid actual (técnicos × días) con estas mejoras pendientes:
- Fila "Sin asignar" en la parte superior
- Badge de tipo de WO (Correctivo / Preventivo / Actuación Programada)
- Prioridad con icono y color
- Tiempo acumulado en cada tarjeta
- Arrastre entre celdas (reasignación)
- Asignación rápida desde sidebar (sin drag)
- Filtros combinados (tipo + prioridad + sección)

### Pestaña 2: Parte de Trabajo
Diagrama Gantt con:
- Eje Y = técnicos
- Eje X = tiempo (horas / días)
- Barras coloreadas por WO
- Cada barra representa el período en que la WO estuvo "En Progreso"
- Al hacer clic → detalle de la WO
- Filtro por rango de fechas, técnico, sección

## Implementación futura

No se requieren cambios en BD para el Parte de Trabajo (los datos ya existen en `statusHistory` y `timeSpentMinutes` de `work_orders`). Solo implementación en frontend:

1. Crear pestañas en `Scheduler.tsx`
2. Añadir fila "Sin asignar" al grid
3. Mostrar tiempo en tarjetas
4. Crear vista Gantt en nueva pestaña
5. Ajustar permisos en Layout según tabla superior
