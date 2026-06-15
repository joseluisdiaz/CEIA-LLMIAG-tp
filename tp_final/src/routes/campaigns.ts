import type { FastifyInstance } from "fastify";
import type { DB } from "../db/client.ts";
import { getCampaign, getItems, createCampaignWithName, getActiveCampaign } from "../db/repositories.ts";
import { presentCampaign, presentItem } from "./presenters.ts";

// Rutas de lectura de campañas. GET /campaigns/:id devuelve el estado del
// procesamiento y el catálogo de items extraídos (vista del comprador).
export function registerCampaignRoutes(app: FastifyInstance, db: DB): void {
  app.post("/campaigns", async () => {
    const campaign = createCampaignWithName(db, "");
    return presentCampaign(campaign);
  });

  app.get("/campaigns/active", async (_req, reply) => {
    const campaign = getActiveCampaign(db);
    if (!campaign) {
      return reply.code(404).send({ error: "no active campaign" });
    }
    return {
      ...presentCampaign(campaign),
      items: getItems(db, campaign.id).map(presentItem),
    };
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const campaign = getCampaign(db, id);
    if (!campaign) {
      return reply.code(404).send({ error: "campaña no encontrada" });
    }
    return {
      ...presentCampaign(campaign),
      items: getItems(db, id).map(presentItem),
    };
  });
}
