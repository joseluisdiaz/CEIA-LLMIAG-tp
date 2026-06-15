// Esquema inicial inline (en vez de leer un .sql en runtime) para que el artefacto
// bundleado sea autocontenido. Idempotente: CREATE TABLE IF NOT EXISTS permite
// aplicarlo en cada arranque sin un sistema de migraciones más pesado.
export const SCHEMA_SQL = `
-- Una campaña nace de un mensaje de WhatsApp reenviado. Guarda el texto crudo y el
-- estado del procesamiento del LLM para poder observarlo de forma asíncrona.
CREATE TABLE IF NOT EXISTS campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  source_text TEXT,
  status      TEXT    NOT NULL DEFAULT 'processing'
              CHECK (status IN ('processing', 'ready', 'error')),
  error       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Cada vino en promoción extraído por el LLM. Los precios se guardan como enteros (pesos).
CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  bodega          TEXT    NOT NULL,
  vino            TEXT    NOT NULL,
  cepa            TEXT,
  anada           INTEGER,
  precio_unitario INTEGER NOT NULL,
  condiciones     TEXT,
  min_compra      INTEGER,
  units_per_case  INTEGER NOT NULL DEFAULT 6
);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- El pedido de un usuario dentro de una campaña. status 'closed' tras el checkout.
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'closed')),
  paid        INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, user_id)
);

-- Las líneas de un pedido: cuántas botellas de cada item.
CREATE TABLE IF NOT EXISTS order_lines (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  qty      INTEGER NOT NULL CHECK (qty > 0),
  UNIQUE (order_id, item_id)
);
`;
