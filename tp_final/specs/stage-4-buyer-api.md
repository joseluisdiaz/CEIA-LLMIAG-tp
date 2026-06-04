# Stage 4 — API del comprador

## Objetivo
Permitir que un usuario elija botellas y cierre su pedido. El subtotal se calcula siempre en el servidor.

## Contratos HTTP

### POST /orders
Crea o actualiza el pedido del usuario en la campaña. Idempotente: si ya existe un pedido abierto del mismo usuario en la misma campaña, lo reemplaza.
```
Body: {
  "campaignId": 1,
  "userName": "Ana",
  "lines": [{ "itemId": 1, "qty": 3 }, { "itemId": 2, "qty": 0 }]
}
Responde: 200 OrderView
409 si el pedido ya está cerrado (checkout previo)
404 si la campaña no existe
400 si algún itemId no pertenece a la campaña
```
`qty: 0` elimina la línea (no crea `order_lines` con qty=0).

### POST /orders/:id/checkout
Cierra el pedido. Después del checkout no se puede modificar.
```
Responde: 200 OrderView con status: "closed"
404 si el pedido no existe
```

### GET /orders/:id
```
Responde: 200 OrderView
404 si no existe
```

### OrderView (tipo de respuesta)
```ts
{
  id, campaignId, userId,
  status: "open" | "closed",
  paid: boolean,
  lines: [{ itemId, bodega, vino, qty, precioUnitario, lineTotal }],
  subtotal: number   // suma de lineTotal × qty, calculada en el servidor
}
```

## Archivos
- `src/services/orders.ts`: `getOrderView(db, orderId)` — construye el OrderView con subtotal.
- `src/routes/orders.ts`: los tres endpoints.

## Reglas de negocio
- El subtotal se calcula en el servidor sumando `qty × precioUnitario` de cada línea.
- El cliente nunca envía totales, solo cantidades.
- Un mismo usuario sólo tiene un pedido por campaña (`UNIQUE(campaign_id, user_id)`).
- `replaceOrderLines` reemplaza todas las líneas existentes de una vez (no merge incremental).

## Criterios de validación
```bash
npm test -- orders.test.ts   # 5 tests
```
Tests cubren:
- Subtotal calculado correctamente en el servidor.
- Segundo POST del mismo usuario en la misma campaña devuelve el mismo `order.id` (idempotente).
- POST tras checkout → 409.
- itemId ajeno a la campaña → 400.
- campaignId inexistente → 404.
