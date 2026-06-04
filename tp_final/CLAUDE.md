# Vino en Grupo — CLAUDE.md

## Qué es esto

TP final del curso LLM/IAG (CEIA, UBA). Una app que convierte mensajes de WhatsApp con promociones de vino en un e-commerce efímero: los compradores ven un catálogo, arman su pedido y hacen checkout; el organizador ve cuántas cajas comprar y concilia pagos. El núcleo del sistema es un pipeline LLM (Claude) que extrae entidades estructuradas del texto crudo.

Este directorio (`tp_final/`) es el proyecto. No tocar `entrega1/` ni `entrega2/`.

## Stack

- **Runtime**: Node 24 LTS — usar `nvm use` (`.nvmrc` presente)
- **Lenguaje**: TypeScript ESM, imports con extensión `.ts` (Node nativo con `--strip-types`)
- **API**: Fastify 5 + TypeBox para schemas
- **DB**: SQLite con `better-sqlite3`, schema inline en `src/db/schema.ts`
- **LLM**: Claude via `@anthropic-ai/sdk`, forced tool use + prompt caching
- **Tests**: Vitest — los de DB e ingesta usan SQLite en memoria; los de API usan `buildApp({db, parse, logger:false})` para no abrir puertos reales
- **Frontend**: HTML/CSS/JS vanilla servido por `@fastify/static` desde `public/`
- **Build**: `tsc --project tsconfig.build.json` — convierte `.ts` → `.js` en `dist/` via `rewriteRelativeImportExtensions`

## Workflow de desarrollo

```bash
nvm use                        # Node 24
npm install
cp .env.example .env           # completar ANTHROPIC_API_KEY
npm run dev                    # node --strip-types --watch src/server.ts
npm test                       # vitest run
npm run typecheck              # tsc --noEmit
npm run seed                   # campaña de ejemplo sin LLM
npm run parse -- test/fixtures/enofilo.txt  # smoke-test del parser LLM
npm run build                  # dist/server.js
npm start                      # node dist/server.js
```

## Estructura de carpetas

```
src/
  server.ts          arranque HTTP; avisa si falta ANTHROPIC_API_KEY
  app.ts             buildApp(opts) — inyección de DB/parser para tests
  config.ts          carga de .env con process.loadEnvFile()
  db/
    schema.ts        DDL inline (idempotente, sin archivo .sql)
    client.ts        openDb(), migrate(), getDb() (singleton para prod)
    repositories.ts  CRUD tipado: campaigns, items, users, orders, order_lines, rollup
    seed.ts          campaña de ejemplo para demo
  domain/
    schemas.ts       TypeBox ExtractionResultSchema + tipo ParsedPromo
  llm/
    prompts.ts       SYSTEM_PROMPT y TOOL_NAME/DESCRIPTION (bytes estables → cache)
    normalize.ts     normalizePrice() + normalizeExtraction() — pura, sin red
    parser.ts        parsePromo() — Claude forced tool use + cache_control
    cli.ts           CLI manual para probar el parser
  routes/
    webhooks.ts      POST /webhooks/whatsapp
    campaigns.ts     GET /campaigns/:id
    orders.ts        POST /orders, POST /orders/:id/checkout, GET /orders/:id
    organizer.ts     GET rollup, GET distribution, PATCH /orders/:id/payment
    presenters.ts    mapeo snake_case → camelCase para la API
  services/
    ingest.ts        processCampaign() + ingestMessage() (async, parser inyectable)
    orders.ts        getOrderView() con subtotal server-side
    organizer.ts     getRollup() + getDistribution()
public/
  index.html / ingest.html / shop.html / admin.html / style.css
test/
  fixtures/          mensajes .txt de ejemplo
  *.test.ts
specs/               especificaciones por stage (fuente de verdad funcional)
```

## Convenciones

- Extensiones `.ts` en todos los imports relativos (compatibilidad con `--strip-types`).
- Precios como **enteros de pesos** (sin decimales) en DB y en la API. La normalización `"$12.500"` → `12500` vive en `normalize.ts`.
- El parser LLM es **inyectable** (`Parser = (text) => Promise<ParsedPromo[]>`). En tests siempre se pasa un fake — nunca se llama a la API de Claude desde los tests.
- El webhook responde **200 OK inmediato** y dispara el procesamiento con `setImmediate`. `campaign.status` sirve para observar el resultado asíncronamente.
- Los tests de API usan `app.inject()` de Fastify (no `fetch` real).
- No hay ORM. Queries SQL directas con `better-sqlite3` (síncrono, sin callbacks).
- El schema SQL está inline en `src/db/schema.ts` para que `dist/server.js` sea autocontenido.

## Variables de entorno

| Variable | Default | Nota |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Requerida para la ingesta LLM; la UI y el seed funcionan sin ella |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Modelo de extracción |
| `PORT` | `3000` | Puerto HTTP |
| `DB_PATH` | `./vino.sqlite` | Ruta al archivo SQLite |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/webhooks/whatsapp` | Ingesta (200 OK inmediato + LLM en background) |
| `GET` | `/campaigns/:id` | Estado de la campaña + catálogo de items |
| `POST` | `/orders` | Crear/actualizar pedido (subtotal server-side) |
| `POST` | `/orders/:id/checkout` | Cerrar pedido |
| `GET` | `/campaigns/:id/rollup` | Demanda total por vino + cajas |
| `GET` | `/campaigns/:id/distribution` | Desglose por persona + pagos |
| `PATCH` | `/orders/:id/payment` | Marcar pagado/sin pagar |
| `GET` | `/*` | Frontend estático desde `public/` |

## Specs por stage

Ver `specs/` — cada archivo describe el alcance, contratos y criterios de validación de cada etapa de implementación.
