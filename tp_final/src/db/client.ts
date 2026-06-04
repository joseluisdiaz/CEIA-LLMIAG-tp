import Database from "better-sqlite3";
import { config } from "../config.ts";
import { SCHEMA_SQL } from "./schema.ts";

export type DB = Database.Database;

// Abre (o crea) la base SQLite, activa claves foráneas + WAL y aplica el esquema.
// El esquema es idempotente, así que correr migrate() en cada arranque es seguro.
export function openDb(path: string = config.dbPath): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: DB): void {
  db.exec(SCHEMA_SQL);
}

// Instancia compartida para el servidor. Los tests crean la suya (p.ej. en :memory:).
let shared: DB | undefined;
export function getDb(): DB {
  if (!shared) shared = openDb();
  return shared;
}
