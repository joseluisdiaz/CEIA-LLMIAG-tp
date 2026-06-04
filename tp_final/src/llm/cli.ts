import { readFileSync } from "node:fs";
import { parsePromo } from "./parser.ts";

// CLI manual: lee un archivo de texto (mensaje de WhatsApp) y muestra el JSON
// validado que produce el parser. Requiere ANTHROPIC_API_KEY en .env.
//   npm run parse -- test/fixtures/enofilo.txt
async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Uso: npm run parse -- <ruta-al-mensaje.txt>");
    process.exit(1);
  }
  const text = readFileSync(path, "utf8");
  const promos = await parsePromo(text);
  console.log(JSON.stringify(promos, null, 2));
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
