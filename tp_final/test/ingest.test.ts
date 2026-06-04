import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDb, type DB } from "../src/db/client.ts";
import { buildApp } from "../src/app.ts";
import { processCampaign } from "../src/services/ingest.ts";
import { createCampaign, getCampaign, getItems } from "../src/db/repositories.ts";
import type { ParsedPromo } from "../src/domain/schemas.ts";

const fakePromos: ParsedPromo[] = [
  {
    bodega: "Catena",
    vino: "Malbec",
    cepa: "Malbec",
    anada: 2021,
    precioUnitario: 12500,
    condiciones: "caja x6",
    minCompra: 6,
    unidadesPorCaja: 6,
  },
];
const fakeParse = async () => fakePromos;

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
});

describe("processCampaign", () => {
  it("persiste items y marca ready en éxito", async () => {
    const id = createCampaign(db, "raw");
    await processCampaign(db, id, "raw", fakeParse);
    expect(getCampaign(db, id)?.status).toBe("ready");
    expect(getItems(db, id)).toHaveLength(1);
  });

  it("marca error y guarda el mensaje si el parser falla", async () => {
    const id = createCampaign(db, "raw");
    await processCampaign(db, id, "raw", async () => {
      throw new Error("LLM caído");
    });
    const c = getCampaign(db, id);
    expect(c?.status).toBe("error");
    expect(c?.error).toContain("LLM caído");
    expect(getItems(db, id)).toHaveLength(0);
  });
});

describe("POST /webhooks/whatsapp", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ db, parse: fakeParse, logger: false });
  });
  afterEach(async () => {
    await app.close();
  });

  it("responde 200 al instante con la campaña en processing y luego queda ready", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { message: "Catena Malbec 2021 $12.500 caja x6" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("processing");
    expect(typeof body.campaignId).toBe("number");

    // Esperar a que el procesamiento en segundo plano (setImmediate) termine.
    let campaign;
    for (let i = 0; i < 20; i++) {
      const got = await app.inject({ method: "GET", url: `/campaigns/${body.campaignId}` });
      campaign = got.json();
      if (campaign.status === "ready") break;
      await new Promise((r) => setImmediate(r));
    }
    expect(campaign.status).toBe("ready");
    expect(campaign.items).toHaveLength(1);
    expect(campaign.items[0]).toMatchObject({ bodega: "Catena", precioUnitario: 12500 });
  });

  it("rechaza body sin message con 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("404 para campaña inexistente", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns/9999" });
    expect(res.statusCode).toBe(404);
  });
});
