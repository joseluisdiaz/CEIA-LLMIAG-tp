import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate, type DB } from "../src/db/client.ts";
import { createCampaign, getActiveCampaign, createCampaignWithName } from "../src/db/repositories.ts";

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
