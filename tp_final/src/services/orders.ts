import type { DB } from "../db/client.ts";
import { getOrder, getOrderLines, getItem } from "../db/repositories.ts";

export interface OrderLineView {
  itemId: number;
  bodega: string;
  vino: string;
  qty: number;
  precioUnitario: number;
  lineTotal: number;
}

export interface OrderView {
  id: number;
  campaignId: number;
  userId: number;
  status: "open" | "closed";
  paid: boolean;
  lines: OrderLineView[];
  subtotal: number;
}

// Arma la vista de un pedido con subtotal calculado en el servidor (nunca confiamos
// en totales del cliente). Reutilizada por el comprador y por el drill-down del organizador.
export function getOrderView(db: DB, orderId: number): OrderView | undefined {
  const order = getOrder(db, orderId);
  if (!order) return undefined;

  const lines: OrderLineView[] = getOrderLines(db, orderId).map((l) => {
    const item = getItem(db, l.item_id);
    if (!item) throw new Error(`Item ${l.item_id} no existe`);
    return {
      itemId: item.id,
      bodega: item.bodega,
      vino: item.vino,
      qty: l.qty,
      precioUnitario: item.precio_unitario,
      lineTotal: l.qty * item.precio_unitario,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return {
    id: order.id,
    campaignId: order.campaign_id,
    userId: order.user_id,
    status: order.status,
    paid: order.paid === 1,
    lines,
    subtotal,
  };
}
