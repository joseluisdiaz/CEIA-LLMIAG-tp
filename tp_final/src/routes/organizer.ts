import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { DB } from "../db/client.ts";
import { getCampaign, getOrder, setOrderPaid } from "../db/repositories.ts";
import { getRollup, getDistribution } from "../services/organizer.ts";
import { getOrderView } from "../services/orders.ts";
import { PaymentBodySchema } from "../generated/schemas.ts";

// Panel de control del organizador: agregación, distribución y conciliación de pagos.
export function registerOrganizerRoutes(app: FastifyInstance, db: DB): void {
  // Roll-up: demanda total por vino (para comprarle al proveedor).
  app.get("/campaigns/:id/rollup", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!getCampaign(db, id)) {
      return reply.code(404).send({ error: "campaña no encontrada" });
    }
    return getRollup(db, id);
  });

  // Drill-down: desglose por persona (qué entregar y cuánto cobrar).
  app.get("/campaigns/:id/distribution", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!getCampaign(db, id)) {
      return reply.code(404).send({ error: "campaña no encontrada" });
    }
    return getDistribution(db, id);
  });

  // Conciliación: marcar un pedido como pagado / no pagado.
  app.withTypeProvider<ZodTypeProvider>().patch<{ Body: typeof PaymentBodySchema }>(
    "/orders/:id/payment",
    async (req, reply) => {
      const validation = PaymentBodySchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: "Invalid request body" });
      }
      const id = Number((req.params as { id: string }).id);
      if (!getOrder(db, id)) {
        return reply.code(404).send({ error: "pedido no encontrado" });
      }
      const { paid } = validation.data;
      setOrderPaid(db, id, paid);
      return getOrderView(db, id);
    },
  );
}
