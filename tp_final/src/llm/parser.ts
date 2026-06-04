import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.ts";
import { ExtractionResultSchema, type ParsedPromo } from "../domain/schemas.ts";
import { normalizeExtraction } from "./normalize.ts";
import {
  SYSTEM_PROMPT,
  TOOL_NAME,
  TOOL_DESCRIPTION,
} from "./prompts.ts";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Copiá .env.example a .env y completá la clave.",
    );
  }
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

// Extrae promociones de vino del texto crudo de un mensaje de WhatsApp.
// Usa forced tool use: Claude está obligado a llamar `extract_promos`, cuyo
// input_schema es nuestro esquema TypeBox. La respuesta cruda pasa por la capa
// de validación/normalización antes de devolverse.
export async function parsePromo(text: string): Promise<ParsedPromo[]> {
  const res = await getClient().messages.create({
    model: config.anthropicModel,
    max_tokens: 2048,
    // cache_control en el system cachea también las tools (render order: tools -> system).
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: TOOL_DESCRIPTION,
        input_schema: ExtractionResultSchema as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: text }],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("El modelo no llamó a la herramienta extract_promos.");
  }

  return normalizeExtraction(toolUse.input);
}
