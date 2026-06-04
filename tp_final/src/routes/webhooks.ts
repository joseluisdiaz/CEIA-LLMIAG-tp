import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { DB } from "../db/client.ts";
import { ingestMessage, type Parser } from "../services/ingest.ts";
import { WebhookBodySchema } from "../generated/schemas.ts";

// Webhook simulado de WhatsApp. Mismo contrato que recibiríamos de Meta:
// recibe el texto crudo, responde 200 OK al instante y procesa en segundo plano.
export function registerWebhookRoutes(
  app: FastifyInstance,
  db: DB,
  parse?: Parser,
): void {
  app.withTypeProvider<ZodTypeProvider>().post<{ Body: typeof WebhookBodySchema }>(
    "/webhooks/whatsapp",
    async (req, reply) => {
      const validation = WebhookBodySchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: "Invalid request body" });
      }
      const { message } = validation.data;
      const campaignId = ingestMessage(db, message, parse);
      reply.code(200).send({ campaignId, status: "processing" });
    },
  );
}
