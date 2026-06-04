import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/client.ts";
import {
  createCampaign,
  setCampaignStatus,
  getCampaign,
  addItems,
  getItems,
  upsertUser,
  getOrCreateOrder,
  replaceOrderLines,
  getOrderLines,
  closeOrder,
  setOrderPaid,
  getOrder,
} from "../src/db/repositories.ts";

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
});

describe("campañas e items", () => {
  it("crea una campaña en estado processing y transiciona a ready", () => {
    const id = createCampaign(db, "Promo Malbec...");
    expect(getCampaign(db, id)?.status).toBe("processing");
    setCampaignStatus(db, id, "ready");
    expect(getCampaign(db, id)?.status).toBe("ready");
  });

  it("persiste items con defaults y normaliza camelCase -> columnas", () => {
    const campaignId = createCampaign(db, "raw");
    addItems(db, campaignId, [
      {
        bodega: "Catena",
        vino: "Malbec Reserva",
        cepa: "Malbec",
        anada: 2021,
        precioUnitario: 12500,
        condiciones: "mínimo caja de 6",
        minCompra: 6,
        unidadesPorCaja: 6,
      },
      { bodega: "Norton", vino: "Cabernet", precioUnitario: 9000 }, // sin opcionales
    ]);
    const items = getItems(db, campaignId);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      bodega: "Catena",
      precio_unitario: 12500,
      anada: 2021,
      units_per_case: 6,
    });
    expect(items[1].cepa).toBeNull();
    expect(items[1].units_per_case).toBe(6); // default
  });
});

describe("pedidos y líneas", () => {
  it("arma, modifica y cierra un pedido; concilia pago", () => {
    const campaignId = createCampaign(db, "raw");
    addItems(db, campaignId, [
      { bodega: "Catena", vino: "Malbec", precioUnitario: 12500 },
      { bodega: "Norton", vino: "Cabernet", precioUnitario: 9000 },
    ]);
    const [malbec, cabernet] = getItems(db, campaignId);
    const user = upsertUser(db, "Jose");

    const order = getOrCreateOrder(db, campaignId, user.id);
    expect(order.status).toBe("open");
    expect(order.paid).toBe(0);

    // get-or-create es idempotente
    expect(getOrCreateOrder(db, campaignId, user.id).id).toBe(order.id);

    replaceOrderLines(db, order.id, [
      { itemId: malbec.id, qty: 3 },
      { itemId: cabernet.id, qty: 1 },
    ]);
    expect(getOrderLines(db, order.id)).toHaveLength(2);

    // reemplazar líneas: qty 0 elimina
    replaceOrderLines(db, order.id, [
      { itemId: malbec.id, qty: 2 },
      { itemId: cabernet.id, qty: 0 },
    ]);
    const lines = getOrderLines(db, order.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ item_id: malbec.id, qty: 2 });

    closeOrder(db, order.id);
    expect(getOrder(db, order.id)?.status).toBe("closed");

    setOrderPaid(db, order.id, true);
    expect(getOrder(db, order.id)?.paid).toBe(1);
  });

  it("respeta unicidad (campaign_id, user_id)", () => {
    const campaignId = createCampaign(db, "raw");
    const user = upsertUser(db, "Ana");
    const a = getOrCreateOrder(db, campaignId, user.id);
    const b = getOrCreateOrder(db, campaignId, user.id);
    expect(a.id).toBe(b.id);
  });

  it("borrar la campaña cascada a items, orders y líneas", () => {
    const campaignId = createCampaign(db, "raw");
    addItems(db, campaignId, [
      { bodega: "X", vino: "Y", precioUnitario: 1000 },
    ]);
    const item = getItems(db, campaignId)[0];
    const user = upsertUser(db, "Z");
    const order = getOrCreateOrder(db, campaignId, user.id);
    replaceOrderLines(db, order.id, [{ itemId: item.id, qty: 1 }]);

    db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
    expect(getItems(db, campaignId)).toHaveLength(0);
    expect(getOrderLines(db, order.id)).toHaveLength(0);
  });
});
