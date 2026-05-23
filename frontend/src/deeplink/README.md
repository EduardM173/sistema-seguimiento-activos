# Deeplink Engine

Sistema unificado de navegación para el frontend. Permite generar y consumir
deeplinks tanto para **páginas** como para **modales / estados efímeros** y
exporta un mapa de navegación en JSON para consumo por IA.

## Conceptos

- **Página** (`DeeplinkPageDefinition`): ruta react-router (`/activos/:id`).
- **Modal** (`DeeplinkModalDefinition`): estado efímero codificado como query
  param (`?modal=<id>&...`). Esto hace cada modal **direccionable, compartible
  y compatible con back/forward del navegador**.
- **Acción** (`DeeplinkAction`): operación no direccionable (ej. "refrescar",
  "exportar"). No genera URL pero aparece en el mapa para la IA.

## Arquitectura

```
src/deeplink/
├── types.ts              # Tipos puros (sin React)
├── registry.ts           # DeeplinkRegistry (clase base, sin React)
├── definitions.ts        # Definiciones de TODAS las páginas/modales
├── DeeplinkProvider.tsx  # Provider, context y hooks de React
├── ai.ts                 # Helpers para consumo desde IA / no-React
└── index.ts              # API pública
```

## Uso

### Setup global

Ya está integrado en `App.tsx`:

```tsx
<AuthProvider>
  <NotificationProvider>
    <DeeplinkBridge>           {/* DeeplinkProvider con permisos del user */}
      <Routes>...</Routes>
    </DeeplinkBridge>
  </NotificationProvider>
</AuthProvider>
```

### Sincronizar un modal con la URL (recomendado)

`useModalUrlSync` enlaza un `useState` existente con `?modal=<id>` en ambas
direcciones. No requiere refactorizar la página.

```tsx
const [open, setOpen] = useState(false);
useModalUrlSync('create-asset', open, setOpen);
```

A partir de ese momento:
- Visitar `/activos?modal=create-asset` abre el modal.
- Cerrar/abrir el modal actualiza la URL automáticamente.
- El back del navegador cierra el modal.

### Navegar imperativamente

```tsx
const { navigateTo, openModal, closeModal } = useDeeplink();

navigateTo({ pageId: 'asset-detail', params: { id: '42' } });
openModal('edit-asset', { assetId: '42' });
closeModal();
```

### Generar el mapa de navegación (para IA)

Desde React:

```tsx
const map = useNavigationMap();              // mapa global
const submap = useNavigationMap({ scoped: true }); // solo la página actual
```

Desde cualquier capa (sin React):

```ts
import { getNavigationMapJson } from '@/deeplink';

const json = getNavigationMapJson({
  permissions: ['ASSET_VIEW', 'INVENTORY_MANAGE'],
  pretty: true,
});
```

Desde la consola del navegador (debug / herramientas externas):

```js
window.__deeplinkEngine.getNavigationMap();
window.__deeplinkEngine.getNavigationMap({ scoped: true });
window.__deeplinkEngine.buildUrl({ pageId: 'activos', modalId: 'create-asset' });
```

## Forma del JSON (NavigationMap)

```jsonc
{
  "version": "1.0.0",
  "generatedAt": "2026-04-28T...",
  "scope": "global",
  "currentLocation": { "pageId": "activos", "modalId": null, ... },
  "pages": [
    {
      "id": "activos",
      "path": "/activos",
      "title": "Activos",
      "description": "Listado de activos físicos...",
      "deeplink": "/activos",
      "tags": ["inventory", "assets"],
      "requiredPermission": "ASSET_VIEW",
      "accessible": true,
      "params": [{ "name": "q", "type": "string", "in": "query" }],
      "actions": [{ "id": "refresh", "title": "Refrescar listado" }],
      "modals": [
        {
          "id": "create-asset",
          "title": "Crear activo",
          "deeplink": "/activos?modal=create-asset",
          "requiredPermission": "ASSET_CREATE",
          "accessible": true
        }
      ],
      "relatedPages": ["asset-detail", "asset-history"]
    }
  ]
}
```

## Agregar una nueva página o modal

1. Agregar un entry en [`definitions.ts`](./definitions.ts).
2. En la página correspondiente, llamar `useModalUrlSync('<modal-id>', flag, setFlag)`
   para cada modal. Para navegación imperativa, usar `navigateTo`/`openModal`.
3. El JSON de navegación lo recoge automáticamente.

## API HTTP (`/__deeplink/*`)

El plugin de Vite [`vite-plugins/deeplink-api.ts`](../../vite-plugins/deeplink-api.ts)
expone el registry sobre HTTP. Se monta bajo `/__deeplink/*` para no chocar con
el proxy `/api/*` que va al backend NestJS.

### Cómo acceder

La URL base depende de cómo esté corriendo el frontend:

| Entorno | Base URL | Cómo se sirve |
|---|---|---|
| `npm run dev` (Vite dev server) | `http://<VITE_HOST>:<FRONTEND_PORT>` (por defecto `http://localhost:5173`) | Middleware en vivo — endpoints dinámicos completos. |
| `npm run preview` | igual que dev, puerto distinto | Middleware en vivo. |
| `npm run build` + host estático (Nginx, Caddy, S3, Cloudflare Pages, etc.) | depende del despliegue (ej. `http://localhost:8084` con el `docker-compose` del repo) | Solo archivos en `dist/__deeplink/*` (estáticos). |

> El puerto del dev server lo controla la variable `FRONTEND_PORT` (`.env`); por
> defecto es **5173**. Verificar siempre con la URL que imprime Vite al arrancar.

No requiere autenticación: solo expone metadatos del mapa de navegación.
Acepta CORS desde cualquier origen (`Access-Control-Allow-Origin: *`) para que
un agente externo o un script en otra página pueda consumirla.

### Catálogo de endpoints

| Endpoint | Descripción |
|---|---|
| `GET /__deeplink/` | Índice de endpoints (autodescubrimiento). |
| `GET /__deeplink/navigation-map.json` | Mapa de navegación completo. Acepta `?permissions=A,B,C` para anotar `accessible`. |
| `GET /__deeplink/pages.json` | Listado plano de páginas registradas. |
| `GET /__deeplink/pages/:pageId.json` | Submapa con modales/acciones de una sola página. |
| `GET /__deeplink/build-url?pageId=...&modalId=...&<param>=...` | Devuelve `{ url, target }` para un target sin navegar. |
| `GET /__deeplink/parse?url=/activos?modal=create-asset` | Parsea una URL en una `DeeplinkLocation`. |
| `GET /__deeplink/openapi.json` | Spec OpenAPI 3 mínima — útil para tool-calling de LLMs. |

### Parámetros de query

| Param | Endpoints | Descripción |
|---|---|---|
| `permissions` | `navigation-map.json`, `pages/:id.json` | Lista de códigos de permiso separados por coma. Anota cada entrada con `accessible: true/false` según ese set. |
| `pageId` | `build-url` | **Obligatorio.** Id de página registrado. |
| `modalId` | `build-url` | Opcional. Id de modal definido sobre esa página. |
| cualquier otro key=value | `build-url` | Se pasa como parámetro de path/query del deeplink construido. |
| `url` | `parse` | **Obligatorio.** URL de la SPA a parsear (path + search). |

### Ejemplos

#### 1. Descubrir todo lo que se puede hacer

```bash
curl http://localhost:5173/__deeplink/navigation-map.json | jq
```

Respuesta (recortada):

```jsonc
{
  "version": "1.0.0",
  "generatedAt": "2026-04-28T...",
  "scope": "global",
  "pages": [
    {
      "id": "activos",
      "path": "/activos",
      "deeplink": "/activos",
      "title": "Activos",
      "requiredPermission": "ASSET_VIEW",
      "accessible": true,
      "modals": [
        {
          "id": "edit-asset",
          "deeplink": "/activos?modal=edit-asset&assetId=:assetId",
          "params": [{ "name": "assetId", "type": "string", "in": "query", "required": true }]
        }
      ]
    }
  ]
}
```

#### 2. Filtrar por permisos del usuario actual

```bash
curl 'http://localhost:5173/__deeplink/navigation-map.json?permissions=ASSET_VIEW,INVENTORY_MANAGE' | jq '.pages[] | {id, accessible}'
```

#### 3. Submapa de una sola página

```bash
curl http://localhost:5173/__deeplink/pages/inventario.json | jq
```

#### 4. Construir un deeplink

```bash
curl 'http://localhost:5173/__deeplink/build-url?pageId=activos&modalId=edit-asset&assetId=42'
# → { "url": "/activos?modal=edit-asset&assetId=42", "target": {...} }
```

#### 5. Parsear una URL

```bash
curl -G --data-urlencode 'url=/activos?modal=edit-asset&assetId=7' \
     http://localhost:5173/__deeplink/parse
# → { "pageId": "activos", "modalId": "edit-asset", "params": {...} }
```

### Consumo desde código

**Desde la propia SPA** (mismo origen, sin CORS):

```ts
const map = await fetch('/__deeplink/navigation-map.json').then((r) => r.json());
```

**Desde un script externo o agente IA** (Node, Python, otro frontend):

```ts
// JavaScript / Node
const base = 'http://localhost:5173/__deeplink';
const map = await fetch(`${base}/navigation-map.json?permissions=ASSET_VIEW`).then(r => r.json());
const { url } = await fetch(`${base}/build-url?pageId=activos&modalId=edit-asset&assetId=42`).then(r => r.json());
```

```python
# Python
import requests
base = "http://localhost:5173/__deeplink"
nav = requests.get(f"{base}/navigation-map.json").json()
link = requests.get(f"{base}/build-url",
                    params={"pageId": "activos", "modalId": "edit-asset", "assetId": "42"}).json()
```

### Patrón típico para tool-calling de un LLM

1. Al iniciar la sesión, el agente hace `GET /__deeplink/openapi.json` y registra
   los endpoints como tools.
2. Para descubrir capacidades llama `GET /__deeplink/navigation-map.json?permissions=...`
   con los permisos del usuario.
3. Para llevar al usuario a un destino concreto llama `GET /__deeplink/build-url?...`
   y devuelve la `url` resultante (la SPA navega vía `<a href>` o `navigateTo`).

### Producción

En `vite build`, el mismo plugin emite snapshots estáticos a
`dist/__deeplink/`:

```
dist/__deeplink/navigation-map.json
dist/__deeplink/pages.json
dist/__deeplink/pages/<pageId>.json
dist/__deeplink/openapi.json
```

Cualquier host estático servirá esos archivos en las mismas URLs. Los
endpoints dinámicos (`/build-url`, `/parse`) solo existen en dev/preview; en
producción la construcción de URLs se hace cliente-side con
`buildDeeplinkUrl()` o `useDeeplink().buildUrl()`.

> **Nota de seguridad:** los snapshots estáticos se sirven sin autenticación,
> por lo que solo contienen metadatos públicos del mapa de navegación
> (paths, ids, descripciones, permisos requeridos). Ningún dato de usuario.
> Si necesitás filtrar por permisos en producción, llamá al endpoint dinámico
> en dev o re-implementá la API detrás del backend autenticado.
