# Stage 1 — Modelo de datos SQLite

## Objetivo
Definir el esquema relacional, la capa de acceso a datos y los repositorios tipados.

## Modelo de datos
```
campaigns  (id, source_text, status[processing|ready|error], error, created_at)
    │
    └─► items  (id, campaign_id, bodega, vino, cepa, anada,
                precio_unitario[int pesos], condiciones, min_compra, units_per_case)

users  (id, name UNIQUE, created_at)

orders  (id, campaign_id, user_id, status[open|closed], paid[0|1], created_at)
         UNIQUE(campaign_id, user_id)
    │
    └─► order_lines  (id, order_id, item_id, qty > 0)
                      UNIQUE(order_id, item_id)
```

Claves foráneas con `ON DELETE CASCADE` en todos los hijos. WAL mode activado.

## Archivos
- `src/db/schema.ts`: DDL inline como string (idempotente, CREATE TABLE IF NOT EXISTS).
- `src/db/client.ts`: `openDb(path?)`, `migrate(db)`, `getDb()` (singleton prod).
- `src/db/repositories.ts`: funciones CRUD tipadas para las cinco entidades + `rollupCampaign()`.
- `src/db/seed.ts`: siembra campaña de ejemplo (`npm run seed`).

## Contratos importantes
- `openDb(":memory:")` → DB limpia para tests (no singleton).
- `addItems()` usa una transacción atómica.
- `getOrCreateOrder()` es idempotente: `INSERT OR IGNORE` + `SELECT`.
- `replaceOrderLines()` borra todas las líneas y reinserta; qty=0 no inserta.
- Precios almacenados como enteros (pesos, sin decimales).

## Criterios de validación
```bash
npm test -- db.test.ts    # 5 tests: campañas, items, pedidos, unicidad, cascade
```
Tests cubren: transición processing→ready, defaults de `units_per_case`, cierre de pedido, marca de pago y cascade al borrar la campaña.
