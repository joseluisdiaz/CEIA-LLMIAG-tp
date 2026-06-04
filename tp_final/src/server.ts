import { buildApp } from "./app.ts";
import { config } from "./config.ts";

// Punto de entrada: levanta el servidor HTTP.
const app = await buildApp();

if (!config.anthropicApiKey) {
  app.log.warn(
    "ANTHROPIC_API_KEY no configurada: la ingesta vía LLM fallará. " +
      "La UI y `npm run seed` funcionan igual. Completá .env para habilitar el parsing.",
  );
}

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
