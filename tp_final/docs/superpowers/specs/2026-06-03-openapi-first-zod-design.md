# API-First con OpenAPI + Zod — Design Doc

**Fecha:** 2026-06-03  
**Estado:** aprobado

## Problema

Los schemas de validación de los routes de Fastify están definidos inline con TypeBox en cada archivo de route. No hay un contrato explícito de la API, y cambiar un endpoint requiere editar tanto el schema TypeBox como la lógica del handler, sin ningún artefacto que documente el contrato de forma independiente.

## Objetivo

Hacer que `openapi.yaml` sea la **única fuente de verdad** para el contrato de la API. Un script de generación convierte ese YAML en Zod schemas que Fastify usa para validar. Cambiar el spec → correr `npm run generate` → la validación se actualiza. Como bonus, `/docs` sirve la spec con Scalar UI.

## Decisiones de diseño

- **Spec-first (no code-first):** el YAML define el contrato; el código deriva de él — no al revés.
- **Schemas en `components/schemas`:** todas las entidades reutilizables viven ahí; los paths referencian con `$ref`. El generador produce un `export` por cada entrada.
- **Scripts → Fastify routes:** los routes solo cambian el `import`; la lógica del handler no toca.
- **TypeBox permanece** para el pipeline LLM (`ExtractionResultSchema`): Claude necesita JSON Schema para el `input_schema` de su tool. Son dominios separados — Zod para HTTP, TypeBox para LLM.
- **Zod type provider:** `@fastify/type-provider-zod` reemplaza TypeBox como type provider de Fastify, manteniendo la inferencia de tipos end-to-end.

## Pipeline

```
openapi.yaml
    │  npm run generate
    ▼
scripts/generate.ts
    ├─ parsea YAML (yaml)
    ├─ desreferencia $ref (@apidevtools/json-schema-ref-parser)
    └─ convierte schemas (json-schema-to-zod)
    │
    ▼
src/generated/schemas.ts  ← AUTO-GENERATED, no editar
    │  importado por
    ▼
src/routes/*.ts  ← mismos handlers, distinto import
    │  validado por
    ▼
@fastify/type-provider-zod

Extras:
    /docs/json  ← openapi.yaml servido estáticamente (@fastify/swagger)
    /docs       ← Scalar UI (@scalar/fastify-api-reference)
```

## Estructura de `openapi.yaml`

```
openapi: 3.1.0
components/schemas:
  Campaign, Item, Order, OrderLine
  RollupEntry, DistributionEntry
  WebhookBody, CreateOrderBody, PaymentBody
  ErrorResponse
paths:
  POST   /webhooks/whatsapp
  GET    /campaigns/{id}
  POST   /orders
  POST   /orders/{id}/checkout
  GET    /orders/{id}
  GET    /campaigns/{id}/rollup
  GET    /campaigns/{id}/distribution
  PATCH  /orders/{id}/payment
  GET    /health
```

Cada operación tiene `operationId`, `requestBody` (si aplica), y `responses` con al menos 200 y los errores relevantes (400, 404, 409).

## `scripts/generate.ts`

1. Lee `openapi.yaml` con `yaml`.
2. Desreferencia todos los `$ref` con `$RefParser.dereference()`.
3. Itera `spec.components.schemas`.
4. Por cada schema: llama a `jsonSchemaToZod(schema, { module: "none" })` para obtener el código Zod como string.
5. Escribe `src/generated/schemas.ts` con header de advertencia + `import { z } from "zod"` + todos los exports.

El script corre con `node --strip-types scripts/generate.ts` (Node 24, sin build step).

## Cambios en el codebase

| Archivo | Cambio |
|---|---|
| `src/app.ts` | `Fastify().withTypeProvider<ZodTypeProvider>()` + registrar swagger + scalar |
| `src/routes/webhooks.ts` | eliminar TypeBox inline, importar `WebhookBody` de `generated/` |
| `src/routes/orders.ts` | eliminar `CreateOrderBody`, importar de `generated/` |
| `src/routes/organizer.ts` | eliminar `PaymentBody`, importar de `generated/` |
| `src/routes/campaigns.ts` | sin schema de body, sin cambios de validación |
| `package.json` | agregar script `generate`, agregar deps |

## Dependencias nuevas

| Paquete | Tipo | Para qué |
|---|---|---|
| `zod` | prod | validación |
| `@fastify/type-provider-zod` | prod | Fastify entiende Zod |
| `@fastify/swagger` | prod | sirve el yaml en `/docs/json` |
| `@scalar/fastify-api-reference` | prod | UI interactiva en `/docs` |
| `yaml` | dev | parsear YAML en el script |
| `json-schema-to-zod` | dev | convierte JSON Schema → código Zod |
| `@apidevtools/json-schema-ref-parser` | dev | resuelve `$ref` antes de convertir |

## Lo que NO cambia

- Lógica de handlers (ningún archivo de service o repository toca).
- `src/domain/schemas.ts` (TypeBox para LLM).
- Tests: siguen usando el parser inyectable y `buildApp({db, parse, logger:false})`.
- Frontend vanilla: el `fetch` a los endpoints no cambia.

## Criterios de aceptación

```bash
npm run generate          # sin errores, produce src/generated/schemas.ts
npm run typecheck         # sin errores
npm test                  # 29 tests verdes
curl /docs/json           # devuelve el OpenAPI spec completo
curl /docs                # Scalar UI carga
# validar que un body inválido sigue devolviendo 400
curl -X POST /orders -d '{"campaignId": "no-es-numero"}' → 400
```
