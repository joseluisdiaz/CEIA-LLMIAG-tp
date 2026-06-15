import { openDb } from "./src/db/client.ts";
import { createCampaign, getActiveCampaign } from "./src/db/repositories.ts";

const db = openDb(":memory:");

const id1 = createCampaign(db, "Campaign 2026-06-15T10:00:00Z");
console.log("Created campaign 1 with id:", id1);

const id2 = createCampaign(db, "Campaign 2026-06-15T11:00:00Z");
console.log("Created campaign 2 with id:", id2);

const active = getActiveCampaign(db);
console.log("Active campaign:", active);

// Let's also check all campaigns
const all = db.prepare("SELECT * FROM campaigns ORDER BY created_at").all();
console.log("All campaigns:", all);
