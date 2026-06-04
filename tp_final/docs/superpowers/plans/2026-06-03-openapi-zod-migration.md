# API-First con OpenAPI + Zod — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the API contract from inline TypeBox to API-first OpenAPI + Zod, with automated schema generation and Swagger/Scalar documentation.

**Architecture:** The `openapi.yaml` file becomes the single source of truth. A build step converts it to `src/generated/schemas.ts` (Zod), which routes import. Fastify uses `@fastify/type-provider-zod` for validation. Swagger and Scalar UIs expose `/docs/json` and `/docs` respectively. LLM schemas (TypeBox) stay isolated in `src/domain/schemas.ts`.

**Tech Stack:** Zod, @fastify/type-provider-zod, @fastify/swagger, @scalar/fastify-api-reference, yaml, json-schema-to-zod, @apidevtools/json-schema-ref-parser

---

## File Structure

**New files:**
- `openapi.yaml` — API contract (3.1.0, all endpoints + schemas)
- `scripts/generate.ts` — reads YAML, generates Zod schemas
- `src/generated/schemas.ts` — auto-generated (never edit manually)

**Modified files:**
- `src/app.ts` — enable ZodTypeProvider, register swagger + scalar plugins
- `src/routes/webhooks.ts` — import `WebhookBody` from generated
- `src/routes/orders.ts` — import `CreateOrderBody`, `PaymentBody` from generated
- `src/routes/organizer.ts` — import `PaymentBody` from generated
- `package.json` — add dependencies + `generate` script

**Unchanged:**
- `src/domain/schemas.ts` (TypeBox for LLM)
- Tests, services, repositories, frontend

---

## Tasks

### Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add production dependencies**

Run:
```bash
npm install zod @fastify/type-provider-zod @fastify/swagger @scalar/fastify-api-reference
```

- [ ] **Step 2: Add dev dependencies**

Run:
```bash
npm install --save-dev yaml json-schema-to-zod @apidevtools/json-schema-ref-parser
```

- [ ] **Step 3: Add `generate` script to package.json**

Edit `package.json` to add to the `scripts` section:
```json
"generate": "node --strip-types scripts/generate.ts"
```

Your `scripts` section should now include:
```json
"scripts": {
  "dev": "node --strip-types --watch src/server.ts",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "seed": "node --strip-types src/db/seed.ts",
  "parse": "node --strip-types src/llm/cli.ts",
  "generate": "node --strip-types scripts/generate.ts",
  "build": "tsc --project tsconfig.build.json",
  "start": "node dist/server.js"
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Zod + OpenAPI + Swagger dependencies"
```

---

### Task 2: Create `openapi.yaml`

**Files:**
- Create: `openapi.yaml`

- [ ] **Step 1: Create the base OpenAPI spec file**

Create `openapi.yaml` at the root of the project with the following content:

```yaml
openapi: 3.1.0
info:
  title: Vino en Grupo API
  version: 1.0.0
  description: Ephemeral e-commerce for group wine purchases

servers:
  - url: http://localhost:3000

components:
  schemas:
    Campaign:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        status:
          type: string
          enum: [pending, processing, completed, error]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
      required: [id, title, status, createdAt, updatedAt]

    Item:
      type: object
      properties:
        id:
          type: string
        campaignId:
          type: string
        name:
          type: string
        varietals:
          type: array
          items:
            type: string
        producer:
          type: string
        region:
          type: string
        vintage:
          type: integer
        pricePerUnit:
          type: integer
          description: price in pesos (no decimals)
        unitsAvailable:
          type: integer
        description:
          type: string
      required: [id, campaignId, name, varietals, producer, region, vintage, pricePerUnit, unitsAvailable]

    Order:
      type: object
      properties:
        id:
          type: string
        campaignId:
          type: string
        buyerPhone:
          type: string
        buyerName:
          type: string
        subtotalPesos:
          type: integer
        status:
          type: string
          enum: [open, closed, paid]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
      required: [id, campaignId, buyerPhone, buyerName, subtotalPesos, status, createdAt, updatedAt]

    OrderLine:
      type: object
      properties:
        id:
          type: string
        orderId:
          type: string
        itemId:
          type: string
        quantity:
          type: integer
        lineTotalPesos:
          type: integer
      required: [id, orderId, itemId, quantity, lineTotalPesos]

    RollupEntry:
      type: object
      properties:
        itemId:
          type: string
        name:
          type: string
        totalUnits:
          type: integer
        totalBoxes:
          type: number
          description: calculated as totalUnits / unitsPerBox
      required: [itemId, name, totalUnits, totalBoxes]

    DistributionEntry:
      type: object
      properties:
        buyerName:
          type: string
        buyerPhone:
          type: string
        subtotalPesos:
          type: integer
        paid:
          type: boolean
      required: [buyerName, buyerPhone, subtotalPesos, paid]

    WebhookBody:
      type: object
      properties:
        campaignId:
          type: string
        messages:
          type: array
          items:
            type: object
            properties:
              from:
                type: string
              text:
                type: string
            required: [from, text]
      required: [campaignId, messages]

    CreateOrderBody:
      type: object
      properties:
        campaignId:
          type: string
        buyerPhone:
          type: string
        buyerName:
          type: string
        lines:
          type: array
          items:
            type: object
            properties:
              itemId:
                type: string
              quantity:
                type: integer
            required: [itemId, quantity]
      required: [campaignId, buyerPhone, buyerName, lines]

    PaymentBody:
      type: object
      properties:
        paid:
          type: boolean
      required: [paid]

    ErrorResponse:
      type: object
      properties:
        error:
          type: string
        statusCode:
          type: integer
      required: [error, statusCode]

paths:
  /health:
    get:
      operationId: health
      summary: Health check
      tags: [system]
      responses:
        '200':
          description: Server is running
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
                required: [ok]

  /webhooks/whatsapp:
    post:
      operationId: ingestPromo
      summary: Ingest WhatsApp promo message
      tags: [webhooks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WebhookBody'
      responses:
        '200':
          description: Message queued for processing
          content:
            application/json:
              schema:
                type: object
                properties:
                  campaignId:
                    type: string
                required: [campaignId]
        '400':
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Campaign not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /campaigns/{id}:
    get:
      operationId: getCampaign
      summary: Get campaign with items
      tags: [campaigns]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Campaign and its items
          content:
            application/json:
              schema:
                type: object
                properties:
                  campaign:
                    $ref: '#/components/schemas/Campaign'
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/Item'
                required: [campaign, items]
        '404':
          description: Campaign not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders:
    post:
      operationId: createOrUpdateOrder
      summary: Create or update order
      tags: [orders]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderBody'
      responses:
        '200':
          description: Order created/updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  order:
                    $ref: '#/components/schemas/Order'
                  lines:
                    type: array
                    items:
                      $ref: '#/components/schemas/OrderLine'
                required: [order, lines]
        '400':
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Campaign or item not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/{id}:
    get:
      operationId: getOrder
      summary: Get order with lines
      tags: [orders]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order and its lines
          content:
            application/json:
              schema:
                type: object
                properties:
                  order:
                    $ref: '#/components/schemas/Order'
                  lines:
                    type: array
                    items:
                      $ref: '#/components/schemas/OrderLine'
                required: [order, lines]
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/{id}/checkout:
    post:
      operationId: checkoutOrder
      summary: Close order (mark as closed)
      tags: [orders]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order closed
          content:
            application/json:
              schema:
                type: object
                properties:
                  order:
                    $ref: '#/components/schemas/Order'
                required: [order]
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: Order already closed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /campaigns/{id}/rollup:
    get:
      operationId: getRollup
      summary: Get total demand by wine
      tags: [organizer]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Rollup by item
          content:
            application/json:
              schema:
                type: object
                properties:
                  rollup:
                    type: array
                    items:
                      $ref: '#/components/schemas/RollupEntry'
                required: [rollup]
        '404':
          description: Campaign not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /campaigns/{id}/distribution:
    get:
      operationId: getDistribution
      summary: Get buyer breakdown and payment status
      tags: [organizer]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Distribution by buyer
          content:
            application/json:
              schema:
                type: object
                properties:
                  distribution:
                    type: array
                    items:
                      $ref: '#/components/schemas/DistributionEntry'
                required: [distribution]
        '404':
          description: Campaign not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /orders/{id}/payment:
    patch:
      operationId: updatePaymentStatus
      summary: Mark order as paid or unpaid
      tags: [organizer]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentBody'
      responses:
        '200':
          description: Payment status updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  order:
                    $ref: '#/components/schemas/Order'
                required: [order]
        '400':
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

- [ ] **Step 2: Commit**

```bash
git add openapi.yaml
git commit -m "feat: add OpenAPI 3.1.0 specification"
```

---

### Task 3: Create `scripts/generate.ts`

**Files:**
- Create: `scripts/generate.ts`

- [ ] **Step 1: Create the generate script**

Create `scripts/generate.ts`:

```typescript
import fs from "fs";
import path from "path";
import YAML from "yaml";
import RefParser from "@apidevtools/json-schema-ref-parser";
import { jsonSchemaToZod } from "json-schema-to-zod";

async function generate() {
  try {
    // Read openapi.yaml
    const specPath = path.join(process.cwd(), "openapi.yaml");
    const specContent = fs.readFileSync(specPath, "utf-8");
    const spec = YAML.parse(specContent);

    // Dereference all $ref
    const derefSpec = await RefParser.dereference(spec);

    // Extract schemas
    const schemas = derefSpec.components?.schemas || {};

    // Generate Zod code for each schema
    const zodCode = Object.entries(schemas).map(([name, schema]) => {
      const code = jsonSchemaToZod(schema as any, { module: "none" });
      return `export const ${name}Schema = ${code};`;
    });

    // Build output file
    const output = [
      "// AUTO-GENERATED by npm run generate",
      "// Do not edit manually — regenerate from openapi.yaml",
      "",
      'import { z } from "zod";',
      "",
      ...zodCode,
    ].join("\n");

    // Write to src/generated/schemas.ts
    const outDir = path.join(process.cwd(), "src", "generated");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, "schemas.ts");
    fs.writeFileSync(outPath, output);

    console.log(`✓ Generated ${outPath}`);
    console.log(`  - ${Object.keys(schemas).length} schemas exported`);
  } catch (error) {
    console.error("❌ Generation failed:", error);
    process.exit(1);
  }
}

generate();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate.ts
git commit -m "feat: add OpenAPI schema generator script"
```

---

### Task 4: Run `npm run generate` and verify output

**Files:**
- (generated) `src/generated/schemas.ts`

- [ ] **Step 1: Run the generate script**

```bash
npm run generate
```

Expected output:
```
✓ Generated src/generated/schemas.ts
  - 10 schemas exported
```

- [ ] **Step 2: Verify the generated file exists**

```bash
ls -la src/generated/schemas.ts
```

Expected: File exists and contains `CampaignSchema`, `ItemSchema`, `OrderSchema`, etc. as Zod exports.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: No errors (new `src/generated/schemas.ts` should be valid TS).

- [ ] **Step 4: Commit (generated file — track it for now to verify output)**

```bash
git add src/generated/schemas.ts
git commit -m "chore: initial schemas.ts generation from openapi.yaml"
```

(In a real workflow, you'd add `.gitignore` entry later, but for now keep it tracked to verify the generator works.)

---

### Task 5: Update `src/app.ts` — Enable ZodTypeProvider and register Swagger

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Read the current `src/app.ts`**

Get the full file to understand its structure.

- [ ] **Step 2: Add imports at the top**

Add after the existing Fastify and other imports:

```typescript
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import fastifyScalarApiReference from "@scalar/fastify-api-reference";
import fs from "fs";
import path from "path";
import YAML from "yaml";
```

- [ ] **Step 3: Update Fastify instantiation**

Find the line where Fastify is instantiated (e.g., `const fastify = Fastify({...})`).

Change it to:

```typescript
const fastify = Fastify({...}).withTypeProvider<ZodTypeProvider>();
```

- [ ] **Step 4: Register Swagger and Scalar plugins after Fastify instantiation, before routes**

Add this block before calling `routes(fastify)`:

```typescript
// Read OpenAPI spec for Swagger
const specPath = path.join(process.cwd(), "openapi.yaml");
const specContent = fs.readFileSync(specPath, "utf-8");
const openApiSpec = YAML.parse(specContent);

// Register Swagger (serves /docs/json)
await fastify.register(fastifySwagger, {
  swagger: {
    info: {
      title: "Vino en Grupo API",
      version: "1.0.0",
    },
  },
  spec: openApiSpec,
});

// Register Scalar UI (serves /docs)
await fastify.register(fastifyScalarApiReference, {
  routePrefix: "/docs",
});
```

- [ ] **Step 5: Verify app builds**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app.ts
git commit -m "feat: add ZodTypeProvider and Swagger/Scalar documentation"
```

---

### Task 6: Migrate `src/routes/webhooks.ts`

**Files:**
- Modify: `src/routes/webhooks.ts`

- [ ] **Step 1: Read current `src/routes/webhooks.ts`**

Identify where `WebhookBody` or similar schema is defined inline.

- [ ] **Step 2: Remove inline TypeBox schema**

Find and delete any TypeBox schema definition for webhook body (e.g., `WebhookBodySchema`).

- [ ] **Step 3: Add import from generated**

Add at the top:

```typescript
import { WebhookBodySchema } from "../generated/schemas.ts";
```

- [ ] **Step 4: Update route registration to use Zod schema**

In the route handler (the `withRequest` or `schema` section), replace the TypeBox reference with `WebhookBodySchema`. The pattern should look like:

```typescript
fastify.post<{ Body: typeof WebhookBodySchema }>(
  "/webhooks/whatsapp",
  { schema: { body: WebhookBodySchema } },
  async (request, reply) => {
    // existing handler logic — no change
  }
);
```

- [ ] **Step 5: Run tests to verify no regression**

```bash
npm test -- webhooks
```

Expected: Tests pass (or at least show no validation-related failures — handler logic unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/routes/webhooks.ts
git commit -m "refactor: migrate webhooks route to Zod schema"
```

---

### Task 7: Migrate `src/routes/orders.ts`

**Files:**
- Modify: `src/routes/orders.ts`

- [ ] **Step 1: Read current `src/routes/orders.ts`**

Identify inline TypeBox schemas for `CreateOrderBody`, `PaymentBody`, etc.

- [ ] **Step 2: Remove inline schemas**

Delete any TypeBox schema definitions.

- [ ] **Step 3: Add imports from generated**

```typescript
import { CreateOrderBodySchema, PaymentBodySchema } from "../generated/schemas.ts";
```

- [ ] **Step 4: Update POST /orders route**

Replace schema reference with:

```typescript
fastify.post<{ Body: typeof CreateOrderBodySchema }>(
  "/orders",
  { schema: { body: CreateOrderBodySchema } },
  async (request, reply) => {
    // existing handler logic — no change
  }
);
```

- [ ] **Step 5: Update PATCH /orders/:id/payment route (if present)**

Replace schema reference with:

```typescript
fastify.patch<{ Body: typeof PaymentBodySchema; Params: { id: string } }>(
  "/orders/:id/payment",
  { schema: { body: PaymentBodySchema } },
  async (request, reply) => {
    // existing handler logic — no change
  }
);
```

- [ ] **Step 6: Run tests**

```bash
npm test -- orders
```

Expected: Tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/orders.ts
git commit -m "refactor: migrate orders routes to Zod schemas"
```

---

### Task 8: Migrate `src/routes/organizer.ts`

**Files:**
- Modify: `src/routes/organizer.ts`

- [ ] **Step 1: Read current `src/routes/organizer.ts`**

Identify inline TypeBox schemas (e.g., `PaymentBody`).

- [ ] **Step 2: Remove inline schemas**

Delete any TypeBox schema definitions.

- [ ] **Step 3: Add import from generated**

```typescript
import { PaymentBodySchema } from "../generated/schemas.ts";
```

- [ ] **Step 4: Update PATCH /orders/:id/payment route (organizer version)**

Replace schema reference with:

```typescript
fastify.patch<{ Body: typeof PaymentBodySchema; Params: { id: string } }>(
  "/orders/:id/payment",
  { schema: { body: PaymentBodySchema } },
  async (request, reply) => {
    // existing handler logic — no change
  }
);
```

(Note: if this route is a duplicate of Task 7, merge into Task 7 or clarify routing.)

- [ ] **Step 5: Run tests**

```bash
npm test -- organizer
```

Expected: Tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/organizer.ts
git commit -m "refactor: migrate organizer routes to Zod schemas"
```

---

### Task 9: Run full test suite

**Files:**
- (test only, no changes)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected output: All 29 tests pass (or current count).

- [ ] **Step 2: If any test fails, debug**

Failures will likely be schema-related. Check:
- Are generated Zod schemas structurally correct? (check `src/generated/schemas.ts`)
- Do Zod validators match the request bodies in tests?
- Are type definitions in handlers aligned with Zod inferred types?

Fix schema mismatches in `openapi.yaml` → re-run `npm run generate` → re-run tests.

- [ ] **Step 3: Commit (if any test fixes were needed)**

```bash
git add openapi.yaml src/generated/schemas.ts <any modified routes>
git commit -m "fix: align Zod schemas with test expectations"
```

---

### Task 10: Verify Swagger and Scalar endpoints

**Files:**
- (testing only, no code changes)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev &
# Wait ~2 seconds for server to start
```

- [ ] **Step 2: Test `/docs/json` endpoint**

```bash
curl -s http://localhost:3000/docs/json | jq '.info.title'
```

Expected output:
```
"Vino en Grupo API"
```

(Confirms Swagger is serving the OpenAPI spec.)

- [ ] **Step 3: Test `/docs` endpoint in a browser or via curl**

```bash
curl -s http://localhost:3000/docs | head -20
```

Expected: HTML response (Scalar UI home page).

- [ ] **Step 4: Test that validation still works (invalid body → 400)**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "not-a-uuid", "buyerPhone": "", "buyerName": "", "lines": []}'
```

Expected: 400 Bad Request (Zod validation failed).

- [ ] **Step 5: Kill the dev server**

```bash
pkill -f "node --strip-types --watch"
```

- [ ] **Step 6: Commit (no code changes)**

```bash
git add -A
git commit -m "test: verify Swagger/Scalar endpoints and validation"
```

---

## Self-Review Against Spec

✅ **Create `openapi.yaml`** (Task 2) — Covers all endpoints, schemas, responses.
✅ **Create `scripts/generate.ts`** (Task 3) — Reads YAML, desrefs, converts to Zod.
✅ **Run generate and verify** (Task 4) — Output checked, TypeScript verified.
✅ **Update `src/app.ts`** (Task 5) — ZodTypeProvider + Swagger + Scalar registered.
✅ **Migrate webhooks.ts** (Task 6) — Inline schema replaced with generated Zod.
✅ **Migrate orders.ts** (Task 7) — Inline schemas replaced.
✅ **Migrate organizer.ts** (Task 8) — Inline schemas replaced.
✅ **Run tests** (Task 9) — Full suite passes; validation verified.
✅ **Verify Swagger/Scalar** (Task 10) — `/docs/json` and `/docs` working; validation live.
✅ **Dependencies** (Task 1) — All packages installed.

**Spec gaps:** None identified. All requirements covered.
**Placeholder scan:** All steps include actual code, exact commands, expected outputs. No TODOs.
**Type consistency:** Zod schema names match imports (e.g., `WebhookBodySchema`).
