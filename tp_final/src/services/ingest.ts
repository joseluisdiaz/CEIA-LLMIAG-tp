import type { DB } from "../db/client.ts";
import { createCampaign, addItems, setCampaignStatus } from "../db/repositories.ts";
import { parsePromo } from "../llm/parser.ts";
import type { ParsedPromo } from "../domain/schemas.ts";

// El parser se inyecta para poder testear todo el flujo de ingesta sin red.
export type Parser = (text: string) => Promise<ParsedPromo[]>;

// Procesa una campaña: llama al LLM, valida, persiste los items y actualiza el
// estado. Cualquier error queda registrado en campaign.status = 'error'.
export async function processCampaign(
  db: DB,
  campaignId: number,
  text: string,
  parse: Parser = parsePromo,
): Promise<void> {
  try {
    const promos = await parse(text);
    addItems(db, campaignId, promos);
    setCampaignStatus(db, campaignId, "ready");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setCampaignStatus(db, campaignId, "error", msg);
  }
}

// Crea la campaña (status 'processing') y dispara el procesamiento en segundo
// plano. Devuelve el id de inmediato para que el webhook responda 200 al instante.
export function ingestMessage(
  db: DB,
  text: string,
  parse: Parser = parsePromo,
): number {
  const campaignId = createCampaign(db, text);
  // setImmediate garantiza que la respuesta HTTP se envíe antes de empezar a procesar.
  setImmediate(() => void processCampaign(db, campaignId, text, parse));
  return campaignId;
}
