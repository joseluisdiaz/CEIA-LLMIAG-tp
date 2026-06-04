// Carga de configuración desde el entorno.
// Usa el cargador nativo de Node (process.loadEnvFile, Node >=20.6) para leer .env
// sin dependencias extra. Si el archivo no existe, se ignora (en CI/build las vars
// pueden venir del entorno directamente).

try {
  process.loadEnvFile();
} catch {
  // No hay .env: se usan las variables del entorno o los defaults de abajo.
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./vino.sqlite",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
} as const;
