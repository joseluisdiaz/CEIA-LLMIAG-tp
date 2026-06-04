import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import fastifyScalarApiReference from "@scalar/fastify-api-reference";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { getDb, type DB } from "./db/client.ts";
import type { Parser } from "./services/ingest.ts";
import { registerWebhookRoutes } from "./routes/webhooks.ts";
import { registerCampaignRoutes } from "./routes/campaigns.ts";
import { registerOrderRoutes } from "./routes/orders.ts";
import { registerOrganizerRoutes } from "./routes/organizer.ts";

export interface AppOptions {
  db?: DB;
  // Parser inyectable: en tests se pasa un fake para no pegarle a la API de Claude.
  parse?: Parser;
  logger?: boolean;
}

// Construye la instancia de Fastify con sus rutas y plugins.
// Separado de server.ts para poder instanciar la app en los tests sin abrir un puerto.
export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const db = opts.db ?? getDb();
  const app = Fastify({ logger: opts.logger ?? true }).withTypeProvider<ZodTypeProvider>();

  // Frontend estático (public/). El directorio está en la raíz del proyecto, un
  // nivel arriba tanto de src/ (dev con tsx) como de dist/ (artefacto compilado).
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  app.register(fastifyStatic, { root: publicDir, prefix: "/" });

  app.get("/health", async () => ({ status: "ok" }));

  // Read OpenAPI spec
  const specPath = path.join(process.cwd(), "openapi.yaml");
  const specContent = fs.readFileSync(specPath, "utf-8");
  const openApiSpec = YAML.parse(specContent);

  // Serve OpenAPI spec as JSON at /docs/json
  app.get("/docs/json", async () => openApiSpec);

  // Serve Scalar UI HTML at /docs
  app.get("/docs", async (request, reply) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Vino en Grupo API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://cdn.jsdelivr.net/npm/@scalar/themes@latest/dist/scalar_sunken.css" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/scalar_api_reference.css" />
</head>
<body>
  <script id="api-reference" data-url="/docs/json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/scalar_api_reference.js"></script>
</body>
</html>
    `;
    reply.type("text/html").send(html);
  });

  registerWebhookRoutes(app, db, opts.parse);
  registerCampaignRoutes(app, db);
  registerOrderRoutes(app, db);
  registerOrganizerRoutes(app, db);

  return app;
}
