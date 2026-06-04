import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { DB } from "../db/client.ts";
import {
  getCampaign,
  getItems,
  upsertUser,
  getOrCreateOrder,
  getOrder,
  replaceOrderLines,
  closeOrder,
} from "../db/repositories.ts";
import { getOrderView } from "../services/orders.ts";
import { CreateOrderBodySchema } from "../generated/schemas.ts";

// Rutas del comprador: armar/actualizar un pedido y cerrarlo (checkout).
export function registerOrderRoutes(app: FastifyInstance, db: DB): void {
  // Upsert del pedido de un usuario en una campaña. Devuelve el subtotal calculado.
  app.withTypeProvider<ZodTypeProvider>().post<{ Body: typeof CreateOrderBodySchema }>(
    "/orders",
    async (req, reply) => {
      const validation = CreateOrderBodySchema.safeParse(req.body);
      if (!validation.success) {
        return reply.code(400).send({ error: "Invalid request body" });
      }
      const { campaignId, userName, lines } = validation.data;

      const campaign = getCampaign(db, campaignId);
      if (!campaign) return reply.code(404).send({ error: "campaña no encontrada" });

      const validIds = new Set(getItems(db, campaignId).map((i) => i.id));
      const bad = lines.find((l) => !validIds.has(l.itemId));
      if (bad) {
        return reply
          .code(400)
          .send({ error: `el item ${bad.itemId} no pertenece a la campaña` });
      }

      const user = upsertUser(db, userName.trim());
      const order = getOrCreateOrder(db, campaignId, user.id);
      if (order.status === "closed") {
        return reply
          .code(409)
          .send({ error: "el pedido ya fue cerrado (checkout); no se puede modificar" });
      }

      replaceOrderLines(db, order.id, lines);
      return getOrderView(db, order.id);
    },
  );

  // Cierra el pedido: bloquea futuras modificaciones y notifica el cierre.
  app.post("/orders/:id/checkout", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const order = getOrder(db, id);
    if (!order) return reply.code(404).send({ error: "pedido no encontrado" });
    closeOrder(db, id);
    return getOrderView(db, id);
  });

  // Lectura de un pedido (para refrescar el carrito).
  app.get("/orders/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const view = getOrderView(db, id);
    if (!view) return reply.code(404).send({ error: "pedido no encontrado" });
    return view;
  });
}
