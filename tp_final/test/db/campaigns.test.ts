import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate } from "../../src/db/client.ts";
import { getActiveCampaign, getCampaign } from "../../src/db/repositories.ts";

describe("getActiveCampaign", () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(":memory:");
    migrate(db);
  });

  it("returns null when no campaigns exist", () => {
    const active = getActiveCampaign(db);
    expect(active).toBeNull();
  });

  it("returns the most recent campaign when multiple exist", () => {
    db.exec(`
      INSERT INTO campaigns (name, created_at)
      VALUES ('Campaign 2026-06-15T10:00:00Z', '2026-06-15T10:00:00Z');
      INSERT INTO campaigns (name, created_at)
      VALUES ('Campaign 2026-06-15T11:00:00Z', '2026-06-15T11:00:00Z');
    `);

    const active = getActiveCampaign(db);
    expect(active).not.toBeNull();
    expect(active!.name).toBe('Campaign 2026-06-15T11:00:00Z');
  });

  it("returns the only campaign when one exists", () => {
    db.exec(`
      INSERT INTO campaigns (name, created_at)
      VALUES ('Campaign 2026-06-15T10:30:00Z', '2026-06-15T10:30:00Z');
    `);

    const active = getActiveCampaign(db);
    expect(active).not.toBeNull();
    expect(active!.name).toBe('Campaign 2026-06-15T10:30:00Z');
  });
});
