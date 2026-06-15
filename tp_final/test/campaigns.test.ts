import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/client.ts";
import { createCampaign, getActiveCampaign } from "../src/db/repositories.ts";

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
