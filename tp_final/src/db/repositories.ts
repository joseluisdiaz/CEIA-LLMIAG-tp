import type { DB } from "./client.ts";

// --- Tipos de fila (snake_case, tal como vienen de SQLite) ---

export type CampaignStatus = "processing" | "ready" | "error";

export interface CampaignRow {
  id: number;
  name: string | null;
  source_text: string | null;
  status: CampaignStatus;
  error: string | null;
  created_at: string;
}

export interface ItemRow {
  id: number;
  campaign_id: number;
  bodega: string;
  vino: string;
  cepa: string | null;
  anada: number | null;
  precio_unitario: number;
  condiciones: string | null;
  min_compra: number | null;
  units_per_case: number;
}

export interface UserRow {
  id: number;
  name: string;
  created_at: string;
}

export interface OrderRow {
  id: number;
  campaign_id: number;
  user_id: number;
  status: "open" | "closed";
  paid: 0 | 1;
  created_at: string;
}

export interface OrderLineRow {
  id: number;
  order_id: number;
  item_id: number;
  qty: number;
}

// Item a insertar (camelCase, como lo produce el parser del LLM).
export interface NewItem {
  bodega: string;
  vino: string;
  cepa?: string | null;
  anada?: number | null;
  precioUnitario: number;
  condiciones?: string | null;
  minCompra?: number | null;
  unidadesPorCaja?: number | null;
}

// --- Campañas ---

export function createCampaign(db: DB, name: string, sourceText?: string): number {
  const info = db
    .prepare("INSERT INTO campaigns (name, source_text) VALUES (?, ?)")
    .run(name, sourceText ?? null);
  return Number(info.lastInsertRowid);
}

export function getActiveCampaign(db: DB): CampaignRow | null {
  const row = db
    .prepare(
      `SELECT id, name, source_text, status, error, created_at
       FROM campaigns
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    )
    .get() as CampaignRow | undefined;
  return row ?? null;
}

export function setCampaignStatus(
  db: DB,
  id: number,
  status: CampaignStatus,
  error: string | null = null,
): void {
  db.prepare("UPDATE campaigns SET status = ?, error = ? WHERE id = ?").run(
    status,
    error,
    id,
  );
}

export function getCampaign(db: DB, id: number): CampaignRow | undefined {
  return db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as
    | CampaignRow
    | undefined;
}

// --- Items ---

export function addItems(db: DB, campaignId: number, items: NewItem[]): void {
  const stmt = db.prepare(
    `INSERT INTO items
       (campaign_id, bodega, vino, cepa, anada, precio_unitario, condiciones, min_compra, units_per_case)
     VALUES (@campaign_id, @bodega, @vino, @cepa, @anada, @precio_unitario, @condiciones, @min_compra, @units_per_case)`,
  );
  const tx = db.transaction((rows: NewItem[]) => {
    for (const it of rows) {
      stmt.run({
        campaign_id: campaignId,
        bodega: it.bodega,
        vino: it.vino,
        cepa: it.cepa ?? null,
        anada: it.anada ?? null,
        precio_unitario: it.precioUnitario,
        condiciones: it.condiciones ?? null,
        min_compra: it.minCompra ?? null,
        units_per_case: it.unidadesPorCaja ?? 6,
      });
    }
  });
  tx(items);
}

export function getItems(db: DB, campaignId: number): ItemRow[] {
  return db
    .prepare("SELECT * FROM items WHERE campaign_id = ? ORDER BY id")
    .all(campaignId) as ItemRow[];
}

export function getItem(db: DB, id: number): ItemRow | undefined {
  return db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
    | ItemRow
    | undefined;
}

// --- Usuarios ---

// Crea el usuario si no existe (por nombre) y lo devuelve.
export function upsertUser(db: DB, name: string): UserRow {
  db.prepare("INSERT OR IGNORE INTO users (name) VALUES (?)").run(name);
  return db.prepare("SELECT * FROM users WHERE name = ?").get(name) as UserRow;
}

export function getUserById(db: DB, id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

// --- Agregación para el organizador ---

export interface RollupRow {
  item_id: number;
  bodega: string;
  vino: string;
  units_per_case: number;
  precio_unitario: number;
  total: number; // total de botellas pedidas (todos los pedidos)
}

// Demanda total por item en la campaña, sumando todos los pedidos.
export function rollupCampaign(db: DB, campaignId: number): RollupRow[] {
  return db
    .prepare(
      `SELECT i.id AS item_id, i.bodega, i.vino, i.units_per_case, i.precio_unitario,
              COALESCE(SUM(ol.qty), 0) AS total
       FROM items i
       LEFT JOIN order_lines ol ON ol.item_id = i.id
       WHERE i.campaign_id = ?
       GROUP BY i.id
       ORDER BY i.id`,
    )
    .all(campaignId) as RollupRow[];
}

// --- Pedidos ---

// Devuelve el pedido (open) del usuario para la campaña, creándolo si no existe.
export function getOrCreateOrder(
  db: DB,
  campaignId: number,
  userId: number,
): OrderRow {
  db.prepare(
    "INSERT OR IGNORE INTO orders (campaign_id, user_id) VALUES (?, ?)",
  ).run(campaignId, userId);
  return db
    .prepare("SELECT * FROM orders WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId) as OrderRow;
}

export function getOrder(db: DB, id: number): OrderRow | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | OrderRow
    | undefined;
}

export function listOrders(db: DB, campaignId: number): OrderRow[] {
  return db
    .prepare("SELECT * FROM orders WHERE campaign_id = ? ORDER BY id")
    .all(campaignId) as OrderRow[];
}

// Reemplaza por completo las líneas de un pedido (qty 0 elimina la línea).
export function replaceOrderLines(
  db: DB,
  orderId: number,
  lines: { itemId: number; qty: number }[],
): void {
  const del = db.prepare("DELETE FROM order_lines WHERE order_id = ?");
  const ins = db.prepare(
    "INSERT INTO order_lines (order_id, item_id, qty) VALUES (?, ?, ?)",
  );
  const tx = db.transaction(() => {
    del.run(orderId);
    for (const l of lines) {
      if (l.qty > 0) ins.run(orderId, l.itemId, l.qty);
    }
  });
  tx();
}

export function getOrderLines(db: DB, orderId: number): OrderLineRow[] {
  return db
    .prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id")
    .all(orderId) as OrderLineRow[];
}

export function closeOrder(db: DB, id: number): void {
  db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?").run(id);
}

export function setOrderPaid(db: DB, id: number, paid: boolean): void {
  db.prepare("UPDATE orders SET paid = ? WHERE id = ?").run(paid ? 1 : 0, id);
}
