# Campaign UX — Design Spec

**Date:** 2026-06-15
**Status:** Approved

## Objetivo

Mejorar la experiencia de compra y del panel del organizador alrededor del concepto de "campaña activa": los compradores siempre operan sobre la campaña activa sin tener que conocer el ID, y el organizador ve un historial resumido de las últimas campañas con acceso rápido.

---

## Backend

### Nuevo repositorio: `listRecentCampaigns`

**Archivo:** `src/db/repositories.ts`

Nueva función que agrega compradores y total por campaña via JOIN:

```ts
export interface RecentCampaignRow {
  id: number;
  name: string | null;
  created_at: string;
  status: CampaignStatus;
  buyers: string | null;   // GROUP_CONCAT(DISTINCT u.name), null si nadie compró
  total: number;           // SUM(ol.qty * i.precio_unitario), 0 si sin pedidos
}

export function listRecentCampaigns(db: DB, limit: number): RecentCampaignRow[]
```

SQL:
```sql
SELECT c.id, c.name, c.created_at, c.status,
       GROUP_CONCAT(DISTINCT u.name) AS buyers,
       COALESCE(SUM(ol.qty * i.precio_unitario), 0) AS total
FROM campaigns c
LEFT JOIN orders o ON o.campaign_id = c.id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN order_lines ol ON ol.order_id = o.id
LEFT JOIN items i ON i.id = ol.item_id
GROUP BY c.id
ORDER BY c.created_at DESC, c.id DESC
LIMIT ?
```

### Nuevo endpoint: `GET /campaigns`

**Archivo:** `src/routes/campaigns.ts`

Registrado en `registerCampaignRoutes`. Query param `limit` opcional (default 10, max 10).

Respuesta (array):
```json
[
  {
    "id": 3,
    "name": "Promo Junio 2026",
    "createdAt": "2026-06-15T12:00:00.000Z",
    "status": "ready",
    "buyers": "Ana, Bruno, Carla",
    "total": 47500
  }
]
```

`buyers` es `null` si ningún usuario hizo pedido. `total` es `0` si no hay líneas de pedido.

---

## Frontend — Shop (`public/shop.html`)

### Comportamiento al cargar la página

1. Fetch automático a `GET /campaigns/active` al iniciar.
2. Si la campaña existe y `status === "ready"`: muestra el nombre de la campaña en un `<h3>` y renderiza el catálogo inmediatamente (sin botón "Cargar catálogo").
3. Si `status !== "ready"`: muestra mensaje "La campaña está siendo procesada…" o el status correspondiente.
4. Si el endpoint devuelve 404: muestra "No hay ninguna campaña activa por ahora."

### Nombre de usuario (localStorage)

- Al cargar: `localStorage.getItem("userName")`.
  - Si existe: muestra `"Hola, {nombre} · [cambiar]"` encima del catálogo. El link "cambiar" limpia el valor y muestra el input.
  - Si no existe: muestra un input "Tu nombre" visible, con un placeholder. El nombre se persiste en localStorage al hacer el primer pedido (guardar o checkout).
- El campo de nombre se guarda en localStorage al hacer blur sobre el input (o al hacer el primer pedido, lo que ocurra primero).

### Elementos eliminados

- Input `#campaign` (N° de campaña) — eliminado.
- Botón `#load` ("Cargar catálogo") — eliminado.

### `campaignId` en el script

La variable `campaignId` se obtiene de la respuesta de `GET /campaigns/active`, no del input del usuario.

---

## Frontend — Admin (`public/admin.html`)

### Reemplaza el bloque actual "Active Campaign" + input manual

La sección se reemplaza por:

1. **Botón "Crear campaña"** en la parte superior (ya existía, se conserva y reubica). Al crear exitosamente, recarga la tabla de campañas recientes.
2. **Tabla de campañas recientes** que se carga sola al abrir la página (`DOMContentLoaded`).

### Tabla de campañas recientes

Fetch a `GET /campaigns` (devuelve últimas 10).

Columnas:
| Campaña | Fecha | Compradores | Total | |
|---|---|---|---|---|
| Promo Junio 2026 | 15 jun 2026 | Ana, Bruno, Carla | $47.500 | [Cargar] |

- "Compradores" muestra el valor de `buyers` o `"—"` si es null.
- "Total" formateado con `money()` existente.
- Botón **"Cargar"** llama al `load(campaignId)` existente, que muestra rollup y distribución debajo.

### Elementos eliminados del admin

- Sección "Active Campaign" con `loadActiveCampaign()`, `getTimeSince()`, `createCampaignBtn`, etc.
- Input manual `#campaign` + botón `#load` ("Cargar") — reemplazados por la tabla.

### Estado tras hacer clic en "Cargar"

El comportamiento de `load()` no cambia: llama a `/campaigns/:id/rollup` y `/campaigns/:id/distribution`, renderiza las tarjetas de rollup y distribución. El `campaignId` activo queda en la variable `campaignId` del script.

---

## Lo que NO cambia

- Endpoint `GET /campaigns/active` — sin modificaciones.
- Endpoint `GET /campaigns/:id` — sin modificaciones.
- Rutas de órdenes y organizer — sin modificaciones.
- CSS / `style.css` — sin modificaciones (se usan las clases existentes).
- Lógica de checkout — sin modificaciones.

---

## Criterios de validación

- `GET /campaigns` devuelve máximo 10 registros ordenados por fecha descendente.
- `GET /campaigns` con DB vacía devuelve `[]`.
- Shop carga el catálogo sin input de campaña, usando la activa.
- Si no hay campaña activa, shop muestra mensaje claro.
- El nombre del usuario persiste entre recargas de página en shop.
- Admin muestra la tabla de campañas al cargar, con compradores y totales correctos.
- El botón "Cargar" en la tabla del admin carga rollup y distribución de esa campaña.
