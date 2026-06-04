# Stage 5 — API del organizador

## Objetivo
Darle al organizador las dos vistas que necesita para ejecutar la compra grupal y gestionar la entrega: cuánto pedir al proveedor (roll-up) y qué cobrar/entregar a cada persona (drill-down). Más la conciliación de pagos.

## Contratos HTTP

### GET /campaigns/:id/rollup
Vista de agregación: demanda total por vino para hacer la orden al proveedor.
```
Responde: 200 RollupEntry[]
404 si la campaña no existe

RollupEntry: {
  itemId, bodega, vino,
  totalBotellas: number,      // suma de qty en todos los pedidos
  unidadesPorCaja: number,
  cajas: number,              // ceil(totalBotellas / unidadesPorCaja)
  precioUnitario: number,
  totalEstimado: number       // totalBotellas × precioUnitario
}
```
Items sin ningún pedido aparecen con `totalBotellas: 0` y `cajas: 0`.

### GET /campaigns/:id/distribution
Vista de distribución: qué entregar y cobrar a cada persona.
```
Responde: 200 DistributionEntry[]

DistributionEntry: {
  orderId, userName,
  status: "open" | "closed",
  paid: boolean,
  lines: OrderLineView[],
  subtotal: number
}
```

### PATCH /orders/:id/payment
Conciliación: marcar un pedido como pagado o no pagado.
```
Body:     { "paid": true }
Responde: 200 OrderView actualizado
404 si el pedido no existe
```

## Archivos
- `src/db/repositories.ts`: `rollupCampaign(db, campaignId): RollupRow[]` — LEFT JOIN + GROUP BY.
- `src/services/organizer.ts`: `getRollup()` (calcula cajas con `Math.ceil`) + `getDistribution()`.
- `src/routes/organizer.ts`: los tres endpoints.

## Regla de cálculo de cajas
```
cajas = Math.ceil(totalBotellas / unidadesPorCaja)
```
Ejemplos: 7 botellas / caja de 6 → 2 cajas. 1 botella / caja de 6 → 1 caja.

## Criterios de validación
```bash
npm test -- organizer.test.ts   # 4 tests
```
Tests cubren (con 2 compradores sembrados en beforeEach):
- Roll-up suma correctamente (3+4=7 botellas de Malbec, ceil(7/6)=2 cajas).
- Distribution desglosa por persona con subtotal correcto.
- PATCH payment marca pagado y se refleja en la distribución.
- Rollup de campaña inexistente → 404.
