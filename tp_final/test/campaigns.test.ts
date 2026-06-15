import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDb, migrate, type DB } from "../src/db/client.ts";
import { createCampaign, getActiveCampaign, createCampaignWithName } from "../src/db/repositories.ts";
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

  afterEach(async () => {
    await app.close();
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
    const res1 = await app.inject({
      method: "POST",
      url: "/campaigns",
      payload: {},
    });
    const campaign1 = res1.json();

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

  afterEach(async () => {
    await app.close();
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
