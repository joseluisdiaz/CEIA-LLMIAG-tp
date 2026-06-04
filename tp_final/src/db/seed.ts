import { openDb } from "./client.ts";
import { createCampaign, addItems, setCampaignStatus } from "./repositories.ts";

// Siembra una campaña de ejemplo (sin pasar por el LLM) para probar la app
// rápidamente. Útil para la demo y para desarrollo del frontend.
//   npm run seed
const db = openDb();
const id = createCampaign(db, "Selección Enófilo Joyas (datos de ejemplo)");
addItems(db, id, [
  { bodega: "Catena Zapata", vino: "Adrianna Malbec", cepa: "Malbec", anada: 2019, precioUnitario: 48500, condiciones: "mínimo caja x6", minCompra: 6, unidadesPorCaja: 6 },
  { bodega: "Rutini", vino: "Cabernet Franc", cepa: "Cabernet Franc", anada: 2021, precioUnitario: 15900, condiciones: null, minCompra: null, unidadesPorCaja: 6 },
  { bodega: "Zuccardi", vino: "Q Tempranillo", cepa: "Tempranillo", anada: 2020, precioUnitario: 11200, condiciones: "caja x12", minCompra: null, unidadesPorCaja: 12 },
]);
setCampaignStatus(db, id, "ready");

console.log(`Campaña de ejemplo creada con id=${id}.`);
console.log(`Abrí:  /shop.html?campaign=${id}   y   /admin.html?campaign=${id}`);
