import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDb, migrate, type DB } from "../src/db/client.ts";
import {
  createCampaign,
  getActiveCampaign,
  createCampaignWithName,
  listRecentCampaigns,
  addItems,
  upsertUser,
  getOrCreateOrder,
  replaceOrderLines,
} from "../src/db/repositories.ts";
import { buildApp } from "../src/app.ts";

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
});

describe("getActiveCampaign", () => {
  it("returns null when no campaigns exist", () => {
    const active = getActiveCampaign(db);
    expect(active).toBeNull();
  });

  it("returns the most recent campaign when multiple exist", () => {
    createCampaign(db, "Campaign 2026-06-15T10:00:00Z");
    createCampaign(db, "Campaign 2026-06-15T11:00:00Z");

    const active = getActiveCampaign(db);
    expect(active).not.toBeNull();
    expect(active!.name).toBe("Campaign 2026-06-15T11:00:00Z");
  });

  it("returns the only campaign when one exists", () => {
    createCampaign(db, "Campaign 2026-06-15T10:30:00Z");

    const active = getActiveCampaign(db);
    expect(active).not.toBeNull();
    expect(active!.name).toBe("Campaign 2026-06-15T10:30:00Z");
  });
});

describe("createCampaignWithName", () => {
  it("creates a campaign with provided name", () => {
    const name = "Campaign 2026-06-15T12:00:00Z";
    const campaign = createCampaignWithName(db, name);

    expect(campaign.id).toBeGreaterThan(0);
    expect(campaign.name).toBe(name);
    expect(campaign.status).toBe("processing");
    expect(campaign.source_text).toBeNull();
  });

  it("makes the new campaign the active one", () => {
    const name1 = "Campaign 2026-06-15T10:00:00Z";
    const name2 = "Campaign 2026-06-15T11:00:00Z";

    createCampaignWithName(db, name1);
    createCampaignWithName(db, name2);

    const active = getActiveCampaign(db);
    expect(active!.name).toBe(name2);
  });

  it("generates a valid ISO timestamp name if none provided", () => {
    const campaign = createCampaignWithName(db, "");
    expect(campaign.name).toMatch(/^Campaign \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("POST /campaigns", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    db = openDb(":memory:");
    migrate(db);
    app = await buildApp({ db, parse: async () => [], logger: false });
  });

  it("creates a new campaign with auto-generated name", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.name).toMatch(/^Campaign \d{4}-/);
    expect(body.status).toBe("processing");
  });

  it("makes the new campaign the active one", async () => {
    await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });

    const res2 = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });
    const campaign2 = res2.json();

    const res3 = await app.inject({
      method: "GET",
      url: `/campaigns/${campaign2.id}`,
    });

    expect(res3.statusCode).toBe(200);
    const active = res3.json();
    expect(active.id).toBe(campaign2.id);
  });
});

describe("GET /campaigns/active", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    db = openDb(":memory:");
    migrate(db);
    app = await buildApp({ db, parse: async () => [], logger: false });
  });

  it("returns the active campaign", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });
    const campaign = createRes.json();

    const res = await app.inject({
      method: "GET",
      url: "/campaigns/active",
    });

    expect(res.statusCode).toBe(200);
    const active = res.json();
    expect(active.id).toBe(campaign.id);
  });

  it("returns 404 when no campaigns exist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/campaigns/active",
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("listRecentCampaigns", () => {
  it("returns empty array when no campaigns exist", () => {
    expect(listRecentCampaigns(db, 10)).toEqual([]);
  });

  it("returns campaign with null buyers and zero total when no orders placed", () => {
    createCampaign(db, "Promo A");
    const rows = listRecentCampaigns(db, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].buyers).toBeNull();
    expect(rows[0].total).toBe(0);
  });

  it("aggregates buyers comma-separated and sums total from order lines", () => {
    const campaignId = createCampaign(db, "Promo B");
    addItems(db, campaignId, [
      { bodega: "Bodega X", vino: "Malbec", precioUnitario: 1000 },
    ]);
    const item = db
      .prepare("SELECT id FROM items WHERE campaign_id = ?")
      .get(campaignId) as { id: number };
    const ana = upsertUser(db, "Ana");
    const bruno = upsertUser(db, "Bruno");
    replaceOrderLines(db, getOrCreateOrder(db, campaignId, ana.id).id, [
      { itemId: item.id, qty: 2 },
    ]);
    replaceOrderLines(db, getOrCreateOrder(db, campaignId, bruno.id).id, [
      { itemId: item.id, qty: 3 },
    ]);

    const [row] = listRecentCampaigns(db, 10);
    expect(row.total).toBe(5000); // (2+3) * 1000
    expect(row.buyers).toContain("Ana");
    expect(row.buyers).toContain("Bruno");
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 12; i++) createCampaign(db, `Promo ${i}`);
    expect(listRecentCampaigns(db, 10)).toHaveLength(10);
  });

  it("orders campaigns by created_at DESC (most recent first)", () => {
    createCampaign(db, "Primera");
    createCampaign(db, "Segunda");
    const rows = listRecentCampaigns(db, 10);
    expect(rows[0].name).toBe("Segunda");
    expect(rows[1].name).toBe("Primera");
  });
});
