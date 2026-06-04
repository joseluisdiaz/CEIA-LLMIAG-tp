# Stage 3 — Webhook de ingesta + proceso asíncrono

## Objetivo
Recibir el mensaje de WhatsApp, responder 200 OK inmediatamente y procesar la extracción LLM en segundo plano. El comprador ya puede consultar `GET /campaigns/:id` para ver el estado.

## Contrato HTTP

### POST /webhooks/whatsapp
```
Body:    { "message": "<texto del mensaje>" }
Responde: 200 { "campaignId": 1, "status": "processing" }
```
El 200 se envía **antes** de que el LLM procese. El procesamiento ocurre en `setImmediate`.

### GET /campaigns/:id
```
200 {
  id, status, error, createdAt,
  items: [{ id, bodega, vino, cepa, anada, precioUnitario, condiciones, minCompra, unidadesPorCaja }]
}
404 si no existe
```
`status` puede ser `processing | ready | error`. Cuando está `error`, el campo `error` describe qué falló.

## Archivos
- `src/services/ingest.ts`:
  - `processCampaign(db, id, text, parse?)` — llama al parser, persiste, actualiza status.
  - `ingestMessage(db, text, parse?)` — crea la campaña y dispara `processCampaign` con `setImmediate`.
- `src/routes/webhooks.ts`: valida el body (TypeBox), llama a `ingestMessage`, responde.
- `src/routes/campaigns.ts`: `GET /campaigns/:id`.
- `src/routes/presenters.ts`: mapeo snake_case → camelCase.
- `src/app.ts`: registra las rutas y sirve `public/` con `@fastify/static`.

## Inyección del parser
`Parser = (text: string) => Promise<ParsedPromo[]>`. En producción usa `parsePromo` (Claude). En tests se pasa un fake que devuelve datos fijos, sin llamar a la API.

## Criterios de validación
```bash
npm test -- ingest.test.ts   # 5 tests
```
Tests cubren:
- `processCampaign` con parser fake → status ready + items persistidos.
- `processCampaign` con parser que falla → status error + mensaje guardado + sin items.
- `POST /webhooks/whatsapp` → 200 inmediato + status processing.
- Después de `setImmediate` → status ready con items correctos.
- Body inválido → 400.
- Campaign inexistente → 404.
