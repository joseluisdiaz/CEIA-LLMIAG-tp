import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDb, migrate, type DB } from "../../src/db/client.ts";
import { buildApp } from "../../src/app.ts";
import type { ParsedPromo } from "../../src/domain/schemas.ts";

const mockParser = async (_text: string): Promise<ParsedPromo[]> => [
  {
    bodega: "Bodega Test",
    vino: "Vino Test",
    precioUnitario: 1500,
    cepa: null,
    anada: null,
    condiciones: null,
    minCompra: null,
    unidadesPorCaja: 6,
  },
];

describe("Integration: Webhook and Campaign Management", () => {
  let db: DB;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = openDb(":memory:");
    migrate(db);
    app = await buildApp({ db, parse: mockParser, logger: false });
  });

  it("webhook creates campaign if none exists", async () => {
    const webhookRes = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { message: "Vino A - $1000" },
    });

    expect(webhookRes.statusCode).toBe(200);
    const webhookBody = webhookRes.json();
    expect(typeof webhookBody.campaignId).toBe("number");

    const activeRes = await app.inject({
      method: "GET",
      url: "/campaigns/active",
    });

    expect(activeRes.statusCode).toBe(200);
    const active = activeRes.json();
    expect(active.id).toBe(webhookBody.campaignId);
    expect(active.name).toMatch(/^Campaign \d{4}-/);
  });

  it("webhook uses existing active campaign", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });
    expect(createRes.statusCode).toBe(200);
    const campaign1 = createRes.json();

    const webhookRes = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      payload: { message: "Vino B - $2000" },
    });

    expect(webhookRes.statusCode).toBe(200);
    const webhookBody = webhookRes.json();
    expect(webhookBody.campaignId).toBe(campaign1.id);

    const activeRes = await app.inject({
      method: "GET",
      url: "/campaigns/active",
    });

    expect(activeRes.statusCode).toBe(200);
    const active = activeRes.json();
    expect(active.id).toBe(campaign1.id);
  });

  it("create new campaign makes it active", async () => {
    const res1 = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });
    expect(res1.statusCode).toBe(200);
    const c1 = res1.json();

    const res2 = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });
    expect(res2.statusCode).toBe(200);
    const c2 = res2.json();

    const activeRes = await app.inject({
      method: "GET",
      url: "/campaigns/active",
    });

    expect(activeRes.statusCode).toBe(200);
    const active = activeRes.json();
    expect(active.id).toBe(c2.id);
    expect(active.id).not.toBe(c1.id);
  });
});
