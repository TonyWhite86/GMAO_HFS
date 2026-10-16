# 01 — Sistema visual de "Pulso · Mantenimiento"

Fuente de verdad: `02-temas-pulso.css` (CSS real extraído). Este documento explica el sistema y cómo trasladarlo a Tailwind (stack de GMAO_HFS).

---

## 1. Tipografías

| Token | Valor | Uso |
|---|---|---|
| `--sans` | `'Inter', sans-serif` | Texto general, UI, botones |
| `--mono` | `'Consolas','Courier New',monospace` | IDs (`OT-000001`, `U-001`), horas, cifras, stock, etiquetas de código |

GMAO_HFS ya usa Inter (ver `index.css`) — misma base, encaje directo.

Escala tipográfica usada en Pulso (px):

| Tamaño | Peso | Uso |
|---|---|---|
| 9-10 | 600 | Labels de formulario (uppercase, letter-spacing .3-.8px), cabeceras de tabla, textos secundarios pequeños |
| 11-12 | 500-700 | Cuerpo de tabla, botones, texto de UI general |
| 13 | 500 | Texto base de cuerpo (`body{font-size:13px}`) |
| 15-16 | 700 | Títulos de modal, nombre de la app en sidebar |
| 20+ | 800 | Cifras KPI del dashboard |

## 2. Color: sistema de tokens

Todo el color pasa por variables CSS. **4 temas** conmutables con clase en `<html>` (`theme-azul` por defecto, `theme-claro`, `theme-oscuro`, `theme-suave`).

### Paleta semántica (valores del tema azul)

| Variable | Azul (defecto) | Uso |
|---|---|---|
| `--bg` | `#f0f6ff` | Fondo general (azul muy claro) |
| `--surface` / `--surface2` / `--surface3` | `#ffffff` / `#f8fafc` / `#f1f5f9` | Tarjetas / filas alternas / hovers |
| `--border` / `--border2` | `#dde8f5` / `#c3d4ea` | Bordes de tabla, inputs, cards |
| `--text` / `--text2` / `--text3` | `#1e293b` / `#475569` / `#94a3b8` | Títulos / cuerpo / placeholders y labels |
| `--accent` (+ `--accent2`, `--accentdim`, `--accentborder`) | `#2563eb` (`#3b82f6`, `#eff6ff`, `#bfdbfe`) | Color de marca: enlaces, activos, focos |
| `--green` (+dim/border) | `#059669` | Éxito, completado, stock OK |
| `--amber` (+dim/border) | `#d97706` | Aviso, vencido hoy, stock bajo, pendiente |
| `--red` (+dim/border) | `#dc2626` | Error, vencido, cancelado, crítico |
| `--purple` (+dim/border) | `#7c3aed` | Tipos especiales (predictivo/mejora) |

Patrón repetido en toda la app: **color sólido + `*dim` (fondo suave del mismo tono) + `*border`**. Ej: badge ámbar = `background:var(--amberdim); color:var(--amber); border:1px solid var(--amberborder)`.

### Temas

| Tema | Personalidad | Fondo | Acento | Sidebar |
|---|---|---|---|---|
| **azul** (defecto) | Corporativo frío, look "SaaS" | `#f0f6ff` azul claro | `#2563eb` | Gradiente azul marino→azul (`#0f172a→#1e3a5f→#2563eb`) |
| **claro** | Neutro Bootstrap-like | `#e9ecef` gris | `#0d6efd` | Gris plano `#eef0f2` |
| **oscuro** | Dark premium | `#0f1117` casi negro | `#6366f1` índigo | Gradiente `#070a12→#13182e` |
| **suave** | Cálido tierra | `#f5ede1` crema | `#c2764a` terracota | Gradiente marrón `#3d2e1e→#c2764a` |

Detalle distintivo: en los temas azul/oscuro/suave, **sidebar y topbar llevan degradados** (no planos). El topbar es un degradado horizontal a 90º, el sidebar uno vertical a 175º.

### Sombras

| Token | Uso |
|---|---|
| `--shadow` | Cards en reposo (muy suave) |
| `--shadow-md` | Hover de stat-card |
| `--shadow-lg` | Tooltips, elementos flotantes |
| `--shadow-xl` | Modales |

Formato: doble capa `0 1px 3px …, 0 1px 2px …` con color tintado al tema (azul marino en tema azul).

### Radios y ritmo

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6px | Botones, inputs, tabs, badges pequeños |
| `--radius` | 10px | Cards, stat-cards |
| `--radius-lg` | 14px | Modales |
| 99px | — | Badges tipo píldora (`.bdg`, `.nav-badge`) |

Transiciones típicas: `all .12s` – `.15s` en botones/items, `.25s` en cambios de tema (fondo de sidebar/topbar/main).

### Gradientes de marca (copiar literalmente)

```
Botón primario:        linear-gradient(135deg,#1e40af,#2563eb)   hover: (135deg,#2563eb,#3b82f6)
Sidebar (azul):        linear-gradient(175deg,#0f172a 0%,#1e3a5f 45%,#2563eb 100%)
Topbar (azul):         linear-gradient(90deg,#1e3a5f 0%,#2563eb 60%,#3b82f6 100%)
Icono de logo:         linear-gradient(135deg,rgba(255,255,255,.22),rgba(255,255,255,.08)) + borde rgba(255,255,255,.2)
Login (botón Entrar):  linear-gradient(135deg,#1e40af,#2563eb) + sombra rgba(37,99,235,.35)
```

## 3. Inventario de componentes

### Layout
- `#app`: flex horizontal, `height:100vh`, sin scroll de página.
- `#sidebar`: 230px fijo, columnas, con logo arriba, navegación al medio (scroll) y usuario + selector de tema abajo.
- `#topbar`: 54px alto, barra con degradado de marca, contiene badges de alertas (OTs pendientes, stock bajo), reloj y acciones globales.
- `#content`: resto, `overflow:hidden`, cada pantalla maneja su scroll interno (`.scroll`).

### Sidebar (`nav-*`)
- `.nav-logo`: icono 36×36 con gradiente translúcido + nombre de app (16px/700) + subtítulo (10px).
- `.nav-item`: fila 8×11px, radio 8px, icono + label 13px/500. Hover: fondo `--sidebar-hover-bg`. **Activo**: fondo translúcido + borde + sombra sutil.
- `.nav-badge`: píldora 10px/700 mono, rojo por defecto, variantes `.amber`/`.green` (contadores tipo "OTs pendientes", "solicitudes").
- `.nav-section`: separador de grupo, 10px uppercase letter-spacing .8px.

### Botones (`.btn`)
Base: `padding:7px 14px`, radio 6px, 12px/500, inline-flex con gap 6px.

| Clase | Estilo | Uso |
|---|---|---|
| `.btn-primary` | Gradiente azul, texto blanco, sombra | Acción principal |
| `.btn-ghost` | Fondo surface + borde; hover azul hielo | Acción secundaria |
| `.btn-accent-ghost` | Fondo `--accentdim`, texto acento, borde acento; hover invierte a sólido | Alternar/modos |
| `.btn-danger` | Fondo `--reddim`, texto/borde rojo; hover sólido rojo | Borrar/destrucción |
| `.btn-success` | Verde sólido | Confirmar |
| `.btn-sm` / `.btn-full` / `.btn-icon` | 11px / ancho completo / 30×30 cuadrado | Modificadores |

### Badges (`.bdg`)
Píldora `padding:2px 8px`, 10px/600, letter-spacing .2px. Colores por semántica de estado de OT (ver `04`): Pendiente=ámbar, Activo=azul, Completado=verde, Cancelado=rojo; tipo de OT con otros tonos (Correctivo azul, Preventivo verde, Mejora púrpura, Predictivo índigo). Creados con `bg=*dim, color=*, border=*border`.

### Cards
- `.card`: surface + borde + radio 10 + `--shadow`, padding 16.
- `.card-sm`: variante compacta sobre `--surface2`, padding 10×12.
- `.stat-card` (KPI dashboard): como `.card` pero clicable; hover → `--shadow-md`, `translateY(-1px)`, borde azul claro. Contiene cifra grande + label + icono.

### Tablas (`.tbl`)
- Cabecera: 10px/600 uppercase, `--text3`, borde inferior 1.5px, `position:sticky`.
- Celdas: 12px, `--text2`, padding 8×12, borde inferior 1px.
- Fila: clickeable, hover `--table-hover` (azul hielo).
- Orden por columnas con indicadores; paginación con botones `.btn-ghost.btn-sm` («, -20, ‹ Anterior, …, Siguiente).

### Modales
- `.modal-bg`: overlay `rgba(0,0,0,.45)` + `backdrop-filter:blur(4px)`, centrado.
- `.modal`: 500px (max 100%), radio 14, `--shadow-xl`, animación `modalIn .18s ease`.
- `.modal-hdr` sticky (título 15px/700 + botón cerrar), `.modal-body` con padding 18×20.

### Formularios
- `.fld`: label 10px/600 uppercase + input/select/textarea a ancho completo.
- `.row2` / `.row3`: grids 2 y 3 columnas con gap 10.
- Inputs: foco con `--input-focus-border` + glow `--input-focus-shadow` (rgba del acento al 12%).
- Estilo de input: fondo surface, borde 1px, radio 6, padding generoso en modales (10-12px).

### Tabs (segmented control)
`.tabs` = contenedor `--surface2` con borde y radio 8, padding 3. `.tab` = 12px, radio 6. **Activo**: fondo `--surface` + texto acento + sombra (efecto pastilla).

### Árbol (equipos) `.tree-*`
- `.tree-item`: fila con toggle (16px), icono 18px con radio 4, hover `--surface2`, activo `--accentdim`+acento.
- `.tree-children`: indentación 20px con `border-left:2px solid var(--border)`.

### Bloques Gantt `.gantt-*`
- `.gantt-block`: bloque de trabajo arrastrable, con asas de redimensionado `.rzl`/`.rzr` (aparecen en hover) y contenido `.bi`.
- Hover: sombra + `filter:brightness(1.05)`. Cursor `grab`/`grabbing`.
- Colores de bloque: verde = completada, azul = trabajo real, naranja = solo programado.
- `.gantt-row-wrap` (fila por operario), `.gantt-label-cell` sticky a la izquierda, `.gantt-grid-cell` (columnas de hora).

### Otros
- `.tooltip`: fijo, fondo `--text` texto invertido, radio 8, `--shadow-lg`.
- `.scroll`: `overflow-y:auto; overflow-x:hidden` con scrollbar fino personalizado (5px, thumb tintado por tema).
- Marca de "hoy" en calendarios: `--hoy`; findes: `--finde`; festivos: `--festivo`.

---

## 4. Traducción a Tailwind (para GMAO_HFS)

GMAO_HFS ya tiene en `tailwind.config.js`: paleta slate + `accent:#3b82f6`, Inter, `darkMode:'class'`. Propuesta de adaptación:

### 4.1. Tokens de color → `tailwind.config.js` → `theme.extend.colors`

```js
colors: {
  bg: 'var(--bg)',
  surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface2)', 3: 'var(--surface3)' },
  bordr: { DEFAULT: 'var(--border)', 2: 'var(--border2)' }, // "border" choca con utilidad; usar 'line'
  txt: { DEFAULT: 'var(--text)', 2: 'var(--text2)', 3: 'var(--text3)' },
  accent: { DEFAULT: 'var(--accent)', 2: 'var(--accent2)', dim: 'var(--accentdim)', border: 'var(--accentborder)' },
  green: { DEFAULT: 'var(--green)', dim: 'var(--greendim)', border: 'var(--greenborder)' },
  amber: { DEFAULT: 'var(--amber)', dim: 'var(--amberdim)', border: 'var(--amberborder)' },
  red:   { DEFAULT: 'var(--red)',   dim: 'var(--reddim)',   border: 'var(--redborder)' },
  purple:{ DEFAULT: 'var(--purple)',dim: 'var(--purpledim)',border: 'var(--purpleborder)' },
},
```

Y en `index.css` (capa `@layer base` o fuera): pegar los bloques `:root, html.theme-azul { … }`, `html.theme-claro { … }`, `html.theme-oscuro { … }`, `html.theme-suave { … }` de `02-temas-pulso.css` (líneas de variables). Así Tailwind (`bg-accent`, `text-txt2`, `border-line`) funciona con los 4 temas sin tocar clases.

> Nota: GMAO_HFS ya tiene dark mode con clase `.dark` en `<html>`. Dos opciones: (a) mapear `theme-oscuro` a `.dark` y usar 3 temas, o (b) añadir selector `html.dark` alias del bloque oscuro. Recomendado (a) para no duplicar mecanismos.

### 4.2. Radios, sombras, fuentes → `theme.extend`

```js
borderRadius: { sm: '6px', DEFAULT: '10px', lg: '14px' },
boxShadow: {
  DEFAULT: 'var(--shadow)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)', xl: 'var(--shadow-xl)',
},
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['Consolas', 'Courier New', 'monospace'],
},
```

### 4.3. Gradientes → utilidades CSS en `index.css`

```css
@layer utilities {
  .grad-primary { background: linear-gradient(135deg,#1e40af,#2563eb); }
  .grad-primary-hover:hover { background: linear-gradient(135deg,#2563eb,#3b82f6); }
  .grad-sidebar { background: linear-gradient(175deg,#0f172a 0%,#1e3a5f 45%,#2563eb 100%); }
  .grad-topbar  { background: linear-gradient(90deg,#1e3a5f 0%,#2563eb 60%,#3b82f6 100%); }
}
```

(En tema claro/suave, cambiar gradientes según la tabla del apartado 2 — se puede parametrizar con variables `--sidebar-bg`/`--topbar-bg`/`--btn-primary-bg` igual que hace Pulso; lo más fiel es copiar las variables tal cual.)

### 4.4. Componentes → `@layer components` (equivalentes de las clases de Pulso)

Ejemplos listos para portar:

```css
.btn { @apply inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-sm text-xs font-medium whitespace-nowrap cursor-pointer border-0; }
.btn-primary { @apply text-white shadow-[0_1px_6px_rgba(0,0,0,.2)] grad-primary; }
.btn-ghost { @apply bg-surface text-txt2 border border-line hover:bg-[var(--blue-frost)] hover:text-[var(--blue-mid)]; }
.btn-accent-ghost { @apply bg-accent-dim text-accent border border-accent-border hover:bg-accent hover:text-white; }
.btn-danger { @apply bg-red-dim text-red border border-red-border hover:bg-red hover:text-white; }
.bdg { @apply inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide; }
.card { @apply bg-surface border border-line rounded-[10px] p-4 shadow; }
.stat-card { @apply card cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px; }
```

(Traducir a las clases de color del punto 4.1; verificar con `npx tsc --noEmit` y `npm test` tras cada cambio.)

### 4.5. Lo que NO hace falta portar

- Las clases `.gantt-*` de Pulso son específicas de su Gantt con JSX inline; si portas el planificador, reimplementa con Tailwind + framer-motion (ya instalado) siguiendo la descripción de `03-pantallas.md` §Gantt.
- `#app/#sidebar/#topbar` ya existen equivalentes en `components/Layout.tsx` de GMAO_HFS — aplicar allí tokens/gradientes, no crear otro layout.
