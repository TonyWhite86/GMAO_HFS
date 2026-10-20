# Kit de referencia: app "Pulso · Mantenimiento" (GMAO)

Material de referencia extraído de la aplicación GMAO **"Pulso"** para usar como inspiración/diseño en **GMAO_HFS** (esta). Sirve para incluir funciones y estilos de Pulso conservando lo que GMAO_HFS ya tiene.

## Cómo usar este kit (humano o asistente IA)

1. **Lee primero `AGENTS.md` de la raíz de GMAO_HFS** — stack, convenciones y estructura mandan sobre este kit. Todo lo que se porte debe respetarlas (TypeScript camelCase, imports relativos, UI en español, Zustand + Supabase, etc.).
2. **Elige qué portar** con `04-funcionalidades.md` — cada función de Pulso tiene su módulo equivalente en GMAO_HFS y una recomendación (portar / adaptar / no aplicable).
3. **Para el aspecto visual**, usa `01-sistema-visual.md` (tokens, componentes y traducción a Tailwind) y `02-temas-pulso.css` (CSS real de Pulso, fuente de verdad de su look).
4. `03-pantallas.md`, `05-modelo-datos.md` y `06-api-cliente.md` son consulta según se necesite.

## Fuentes de extracción

| Fuente | Contenido |
|---|---|
| `~/Downloads/Pulso · Mantenimiento.html` | HTML completo de la app desplegada: CSS de temas, capa de API/sesión, librerías (PapaParse, qrcode), código de la app |
| `~/Desktop/Chema proyecto/Inline Babel script` | Código React/JSX de la UI y lógica (7.964 líneas) |

La app original es un SPA React con Babel en el navegador, backend PHP+MySQL propio y almacén de archivos aparte. **El backend PHP NO está disponible** y no se documenta.

## Avisos importantes

- **NO se copian secretos**: este kit no contiene claves API, tokens ni URLs privadas de la app original. Si los encuentras en las fuentes originales, nunca los lleves a este proyecto (y considera rotarlos, porque quedaron expuestos al guardar la página).
- **Esto es referencia, no código pegable**: GMAO_HFS usa Tailwind + TypeScript + Supabase; Pulso usa CSS variables + JSX inline + API PHP propia. Adapta siempre, no copies literalmente.
- Los datos de ejemplo (nombres, IDs tipo `OT-000001`) son de la app Pulso; tu modelo y terminología propios (secciones, roles Observador N1/N2, etc.) se conservan.

## Mapa de contenidos

| Archivo | Para qué sirve |
|---|---|
| `01-sistema-visual.md` | Diseño visual de Pulso + mapeo a Tailwind |
| `02-temas-pulso.css` | CSS real de los 4 temas y componentes |
| `03-pantallas.md` | Pantallas y layout de Pulso |
| `04-funcionalidades.md` | Catálogo de funciones con equivalencia en GMAO_HFS |
| `05-modelo-datos.md` | Entidades de Pulso vs tipos de GMAO_HFS |
| `06-api-cliente.md` | Patrones de sincronización/guardado de Pulso |
