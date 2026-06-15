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
    { bodega: "Catena", vino: "Malbec", precioUnitario: 12500, unidadesPorCaja: 6 },
    { bodega: "Norton", vino: "Cabernet", precioUnitario: 9000, unidadesPorCaja: 6 },
  ]);
  setCampaignStatus(db, campaignId, "ready");
  const items = getItems(db, campaignId);
  malbecId = items[0].id;
  cabernetId = items[1].id;
  app = await buildApp({ db, logger: false });

  // Dos compradores arman pedidos.
  await app.inject({
    method: "POST",
    url: "/orders",
    payload: {
      campaignId,
      userName: "Ana",
      lines: [{ itemId: malbecId, qty: 3 }, { itemId: cabernetId, qty: 1 }],
    },
  });
  await app.inject({
    method: "POST",
    url: "/orders",
    payload: { campaignId, userName: "Beto", lines: [{ itemId: malbecId, qty: 4 }] },
  });
});

describe("roll-up (agregación)", () => {
  it("suma la demanda y calcula cajas = ceil(total/unidadesPorCaja)", async () => {
    const res = await app.inject({ method: "GET", url: `/campaigns/${campaignId}/rollup` });
    expect(res.statusCode).toBe(200);
    const rollup = res.json();
    const malbec = rollup.find((r: any) => r.itemId === malbecId);
    const cabernet = rollup.find((r: any) => r.itemId === cabernetId);

    expect(malbec.totalBotellas).toBe(7); // 3 + 4
    expect(malbec.cajas).toBe(2); // ceil(7/6)
    expect(malbec.totalEstimado).toBe(7 * 12500);

    expect(cabernet.totalBotellas).toBe(1);
    expect(cabernet.cajas).toBe(1); // ceil(1/6)
  });
});

describe("distribution (drill-down) y conciliación", () => {
  it("desglosa por persona con su subtotal", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/campaigns/${campaignId}/distribution`,
    });
    const dist = res.json();
    expect(dist).toHaveLength(2);
    const ana = dist.find((d: any) => d.userName === "Ana");
    expect(ana.subtotal).toBe(3 * 12500 + 9000);
    expect(ana.paid).toBe(false);
  });

  it("marca un pedido como pagado y se refleja en la distribución", async () => {
    const dist = (
      await app.inject({ method: "GET", url: `/campaigns/${campaignId}/distribution` })
    ).json();
    const anaOrderId = dist.find((d: any) => d.userName === "Ana").orderId;

    const pay = await app.inject({
      method: "PATCH",
      url: `/orders/${anaOrderId}/payment`,
      payload: { paid: true },
    });
    expect(pay.statusCode).toBe(200);
    expect(pay.json().paid).toBe(true);

    const after = (
      await app.inject({ method: "GET", url: `/campaigns/${campaignId}/distribution` })
    ).json();
    expect(after.find((d: any) => d.userName === "Ana").paid).toBe(true);
  });

  it("404 en rollup de campaña inexistente", async () => {
    const res = await app.inject({ method: "GET", url: `/campaigns/7777/rollup` });
    expect(res.statusCode).toBe(404);
  });
});
