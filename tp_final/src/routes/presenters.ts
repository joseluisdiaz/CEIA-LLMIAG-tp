import type { CampaignRow, ItemRow } from "../db/repositories.ts";

// Mapean filas snake_case de SQLite a DTOs camelCase para la API.

export function presentItem(it: ItemRow) {
  return {
    id: it.id,
    bodega: it.bodega,
    vino: it.vino,
    cepa: it.cepa,
    anada: it.anada,
    precioUnitario: it.precio_unitario,
    condiciones: it.condiciones,
    minCompra: it.min_compra,
    unidadesPorCaja: it.units_per_case,
  };
}

export function presentCampaign(c: CampaignRow) {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    error: c.error,
    createdAt: c.created_at,
  };
}
