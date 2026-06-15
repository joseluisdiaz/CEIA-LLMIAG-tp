import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDb, type DB } from "../src/db/client.ts";
import { buildApp } from "../src/app.ts";
import { createCampaign, addItems, getItems, setCampaignStatus } from "../src/db/repositories.ts";

let db: DB;
let app: FastifyInstance;
let campaignId: number;
let malbecId: number;
let cabernetId: number;

beforeEach(async () => {
  db = openDb(":memory:");
  campaignId = createCampaign(db, "raw");
  addItems(db, campaignId, [
    { bodega: "Catena", vino: "Malbec", precioUnitario: 12500 },
    { bodega: "Norton", vino: "Cabernet", precioUnitario: 9000 },
  ]);
  setCampaignStatus(db, campaignId, "ready");
  const items = getItems(db, campaignId);
  malbecId = items[0].id;
  cabernetId = items[1].id;
  app = await buildApp({ db, logger: false });
});

async function postOrder(lines: { itemId: number; qty: number }[], userName = "Jose") {
  return app.inject({
    method: "POST",
    url: "/orders",
    payload: { campaignId, userName, lines },
  });
}

describe("API del comprador", () => {
  it("calcula el subtotal en el servidor", async () => {
    const res = await postOrder([
      { itemId: malbecId, qty: 3 },
      { itemId: cabernetId, qty: 1 },
    ]);
    expect(res.statusCode).toBe(200);
    const order = res.json();
    expect(order.subtotal).toBe(3 * 12500 + 9000); // 46500
    expect(order.lines).toHaveLength(2);
  });

  it("actualiza el pedido del mismo usuario (idempotente por campaña/usuario)", async () => {
    const a = (await postOrder([{ itemId: malbecId, qty: 1 }])).json();
    const b = (await postOrder([{ itemId: malbecId, qty: 5 }])).json();
    expect(b.id).toBe(a.id);
    expect(b.subtotal).toBe(5 * 12500);
  });

  it("bloquea modificaciones tras el checkout", async () => {
    const order = (await postOrder([{ itemId: malbecId, qty: 2 }])).json();

    const checkout = await app.inject({
      method: "POST",
      url: `/orders/${order.id}/checkout`,
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().status).toBe("closed");

    const retry = await postOrder([{ itemId: malbecId, qty: 4 }]);
    expect(retry.statusCode).toBe(409);
  });

  it("rechaza items que no pertenecen a la campaña", async () => {
    const res = await postOrder([{ itemId: 99999, qty: 1 }]);
    expect(res.statusCode).toBe(400);
  });

  it("404 al crear pedido sobre campaña inexistente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      payload: { campaignId: 8888, userName: "X", lines: [] },
    });
    expect(res.statusCode).toBe(404);
  });
});
