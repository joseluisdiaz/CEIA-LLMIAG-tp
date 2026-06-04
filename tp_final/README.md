# 🍷 Vino en Grupo

De un mensaje de WhatsApp con promociones de vino a un **e-commerce efímero** para los
compradores y un **panel logístico** para el organizador. El corazón del sistema es un
pipeline LLM (Claude) que extrae entidades estructuradas del texto crudo y las valida
antes de persistirlas.

> TP final — Curso de LLM / IAG (CEIA, UBA).

## Qué hace

1. **Ingesta** — se pega/reenvía un mensaje de promo a `POST /webhooks/whatsapp`. El
   servidor responde **200 OK al instante** y procesa en segundo plano: Claude extrae
   los vinos (bodega, vino, cepa, añada, precio, condiciones) vía *forced tool use*, una
   **capa de validación** (TypeBox) verifica y normaliza los tipos (ej. `"$12.500"` → `12500`),
   y se crea una **campaña** con sus items.
2. **Comprar** — los usuarios ven el catálogo, arman su carrito (subtotal calculado en el
   servidor) y cierran su pedido (checkout, que bloquea modificaciones).
3. **Organizar** — el organizador ve el **roll-up** (demanda total por vino + cuántas cajas
   comprar) y el **drill-down** por persona, y concilia los pagos.

## Stack

- **Backend/API:** Fastify (TypeScript, ESM).
- **Validación:** TypeBox — mismo esquema para la salida del LLM y para las rutas.
- **DB:** SQLite (`better-sqlite3`), esquema relacional Usuario → Pedido → Item.
- **LLM:** Claude (`@anthropic-ai/sdk`) con *forced tool use* + *prompt caching*.
- **Frontend:** HTML/CSS/JS vanilla servido por `@fastify/static`.
- **Tests:** Vitest. **Bundling:** Rolldown.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completá ANTHROPIC_API_KEY para habilitar la ingesta LLM
npm run dev                 # servidor en http://localhost:3000 (tsx watch)
```

Variables de entorno (`.env`):

| Variable            | Default                        | Para qué |
|---------------------|--------------------------------|----------|
| `ANTHROPIC_API_KEY` | —                              | Parsing con Claude (la UI y el seed funcionan sin ella) |
| `ANTHROPIC_MODEL`   | `claude-haiku-4-5-20251001`    | Modelo de extracción |
| `PORT`              | `3000`                         | Puerto HTTP |
| `DB_PATH`           | `./vino.sqlite`                | Archivo SQLite |

## Scripts

| Comando            | Qué hace |
|--------------------|----------|
| `npm run dev`      | Servidor en modo watch |
| `npm test`         | Tests (DB, parser/validación, API comprador y organizador) |
| `npm run typecheck`| Chequeo de tipos (`tsc --noEmit`) |
| `npm run seed`     | Crea una campaña de ejemplo (sin LLM) para probar la UI |
| `npm run parse -- <archivo>` | Corre el parser LLM sobre un mensaje y muestra el JSON validado |
| `npm run build`    | Compila a `dist/server.js` (Rolldown) |
| `npm start`        | Corre el artefacto compilado |

## Demo end-to-end (sin API key)

```bash
npm run seed                # imprime el id de la campaña (p.ej. 1)
npm run dev
```
Abrí en el navegador:
- `http://localhost:3000/shop.html?campaign=1` — armá pedidos como dos usuarios distintos.
- `http://localhost:3000/admin.html?campaign=1` — mirá el roll-up (cajas) y marcá pagos.

## Demo con LLM (requiere `ANTHROPIC_API_KEY`)

```bash
npm run parse -- test/fixtures/enofilo.txt    # ver la extracción aislada
```
O desde la UI: `http://localhost:3000/ingest.html` → pegá un mensaje → se procesa y queda
una campaña lista para comprar.

## Arquitectura (carpetas)

```
src/
  server.ts            arranque HTTP
  app.ts               construye Fastify (inyectable para tests)
  config.ts            carga de .env
  db/                  schema (inline), client (migrate), repositorios tipados, seed
  domain/schemas.ts    contrato TypeBox (LLM + validación)
  llm/                 parser (Claude tool-use), prompts, normalización, CLI
  services/            ingest (async), orders y organizer (agregaciones)
  routes/              webhooks, campaigns, orders, organizer, presenters
public/                ingest.html, shop.html, admin.html, style.css
test/                  suites de vitest + fixtures
```

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/webhooks/whatsapp` | Ingesta (200 OK inmediato + proceso async) |
| `GET`  | `/campaigns/:id` | Estado + catálogo de items |
| `POST` | `/orders` | Crear/actualizar pedido (subtotal server-side) |
| `POST` | `/orders/:id/checkout` | Cerrar pedido (bloquea cambios) |
| `GET`  | `/campaigns/:id/rollup` | Demanda total por vino + cajas |
| `GET`  | `/campaigns/:id/distribution` | Desglose por persona |
| `PATCH`| `/orders/:id/payment` | Marcar pagado / sin pagar |
