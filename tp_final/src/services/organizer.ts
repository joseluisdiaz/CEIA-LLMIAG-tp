import type { DB } from "../db/client.ts";
import { rollupCampaign, listOrders, getUserById } from "../db/repositories.ts";
import { getOrderView, type OrderLineView } from "./orders.ts";

export interface RollupEntry {
  itemId: number;
  bodega: string;
  vino: string;
  totalBotellas: number;
  unidadesPorCaja: number;
  cajas: number;
  precioUnitario: number;
  totalEstimado: number;
}

// Vista de agregación (roll-up): cuánto comprarle al proveedor.
// cajas = ceil(totalBotellas / unidadesPorCaja).
export function getRollup(db: DB, campaignId: number): RollupEntry[] {
  return rollupCampaign(db, campaignId).map((r) => ({
    itemId: r.item_id,
    bodega: r.bodega,
    vino: r.vino,
    totalBotellas: r.total,
    unidadesPorCaja: r.units_per_case,
    cajas: Math.ceil(r.total / r.units_per_case),
    precioUnitario: r.precio_unitario,
    totalEstimado: r.total * r.precio_unitario,
  }));
}

export interface DistributionEntry {
  orderId: number;
  userName: string;
  status: "open" | "closed";
  paid: boolean;
  lines: OrderLineView[];
  subtotal: number;
}

// Vista de distribución (drill-down): qué entregarle y cobrarle a cada persona.
export function getDistribution(db: DB, campaignId: number): DistributionEntry[] {
  return listOrders(db, campaignId).map((order) => {
    const view = getOrderView(db, order.id)!;
    const user = getUserById(db, order.user_id);
    return {
      orderId: order.id,
      userName: user?.name ?? `usuario ${order.user_id}`,
      status: view.status,
      paid: view.paid,
      lines: view.lines,
      subtotal: view.subtotal,
    };
  });
}
