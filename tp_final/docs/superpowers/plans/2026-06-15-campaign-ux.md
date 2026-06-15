# Campaign UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar la campaña activa automáticamente en la página de compra y un historial resumido de las últimas 10 campañas en el panel del organizador.

**Architecture:** Nuevo repositorio `listRecentCampaigns` con SQL JOIN agrega compradores y totales en una sola query. Nuevo endpoint `GET /campaigns` expone ese listado. El shop usa `GET /campaigns/active` al cargar (sin input de usuario). El admin reemplaza el input manual de campaña por una tabla de historial que se auto-carga.

**Tech Stack:** TypeScript ESM, better-sqlite3 (síncrono), Fastify 5, HTML/JS vanilla, localStorage del navegador, Vitest.

---

## File Map

| Archivo | Cambio |
|---|---|
| `src/db/repositories.ts` | Agregar `RecentCampaignRow` + `listRecentCampaigns` |
| `src/routes/campaigns.ts` | Agregar `GET /campaigns`, importar `listRecentCampaigns` |
| `test/campaigns.test.ts` | Agregar tests de repositorio y endpoint |
| `public/shop.html` | Reescribir: auto-carga campaña activa, localStorage para nombre |
| `public/admin.html` | Reescribir: tabla de campañas recientes en lugar del input manual |

---

## Task 1: `listRecentCampaigns` en repositories.ts

**Files:**
- Modify: `src/db/repositories.ts` (agregar al final del archivo)
- Modify: `test/campaigns.test.ts` (actualizar import + agregar describe)

### Patrón de test establecido

Los tests de repositorio usan `db = openDb(":memory:")` en el `beforeEach` del nivel superior (que ya llama a `migrate` internamente). Los tests de API crean su propio `db` y `app` en un `beforeEach` anidado.

- [ ] **Step 1: Actualizar el import en `test/campaigns.test.ts`**

Reemplazar la línea de import de repositories (línea 4 del archivo actual):

```ts
import {
  createCampaign,
  getActiveCampaign,
  createCampaignWithName,
  listRecentCampaigns,
  addItems,
  upsertUser,
  getOrCreateOrder,
  replaceOrderLines,
} from "../src/db/repositories.ts";
```

- [ ] **Step 2: Agregar el describe block de tests al final de `test/campaigns.test.ts`**

```ts
describe("listRecentCampaigns", () => {
  it("returns empty array when no campaigns exist", () => {
    expect(listRecentCampaigns(db, 10)).toEqual([]);
  });

  it("returns campaign with null buyers and zero total when no orders placed", () => {
    createCampaign(db, "Promo A");
    const rows = listRecentCampaigns(db, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].buyers).toBeNull();
    expect(rows[0].total).toBe(0);
  });

  it("aggregates buyers comma-separated and sums total from order lines", () => {
    const campaignId = createCampaign(db, "Promo B");
    addItems(db, campaignId, [
      { bodega: "Bodega X", vino: "Malbec", precioUnitario: 1000 },
    ]);
    const item = db
      .prepare("SELECT id FROM items WHERE campaign_id = ?")
      .get(campaignId) as { id: number };
    const ana = upsertUser(db, "Ana");
    const bruno = upsertUser(db, "Bruno");
    replaceOrderLines(db, getOrCreateOrder(db, campaignId, ana.id).id, [
      { itemId: item.id, qty: 2 },
    ]);
    replaceOrderLines(db, getOrCreateOrder(db, campaignId, bruno.id).id, [
      { itemId: item.id, qty: 3 },
    ]);

    const [row] = listRecentCampaigns(db, 10);
    expect(row.total).toBe(5000); // (2+3) * 1000
    expect(row.buyers).toContain("Ana");
    expect(row.buyers).toContain("Bruno");
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 12; i++) createCampaign(db, `Promo ${i}`);
    expect(listRecentCampaigns(db, 10)).toHaveLength(10);
  });

  it("orders campaigns by created_at DESC (most recent first)", () => {
    createCampaign(db, "Primera");
    createCampaign(db, "Segunda");
    const rows = listRecentCampaigns(db, 10);
    expect(rows[0].name).toBe("Segunda");
    expect(rows[1].name).toBe("Primera");
  });
});
```

- [ ] **Step 3: Ejecutar tests y verificar que fallan**

```bash
npm test -- --reporter=verbose test/campaigns.test.ts
```

Expected: FAIL — `listRecentCampaigns is not a function`

- [ ] **Step 4: Agregar `RecentCampaignRow` y `listRecentCampaigns` al final de `src/db/repositories.ts`**

```ts
// --- Historial de campañas para el organizador ---

export interface RecentCampaignRow {
  id: number;
  name: string | null;
  created_at: string;
  status: CampaignStatus;
  buyers: string | null;
  total: number;
}

export function listRecentCampaigns(db: DB, limit: number = 10): RecentCampaignRow[] {
  return db
    .prepare(
      `SELECT c.id, c.name, c.created_at, c.status,
              GROUP_CONCAT(DISTINCT u.name) AS buyers,
              COALESCE(SUM(ol.qty * i.precio_unitario), 0) AS total
       FROM campaigns c
       LEFT JOIN orders o ON o.campaign_id = c.id
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN order_lines ol ON ol.order_id = o.id
       LEFT JOIN items i ON i.id = ol.item_id
       GROUP BY c.id
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ?`,
    )
    .all(limit) as RecentCampaignRow[];
}
```

- [ ] **Step 5: Ejecutar tests y verificar que pasan**

```bash
npm test -- --reporter=verbose test/campaigns.test.ts
```

Expected: todos los tests de `listRecentCampaigns` PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories.ts test/campaigns.test.ts
git commit -m "feat: add listRecentCampaigns repository with buyer aggregation"
```

---

## Task 2: Endpoint `GET /campaigns`

**Files:**
- Modify: `src/routes/campaigns.ts` (actualizar import, agregar route antes de `/campaigns/:id`)
- Modify: `test/campaigns.test.ts` (agregar describe block al final)

- [ ] **Step 1: Agregar tests del endpoint al final de `test/campaigns.test.ts`**

```ts
describe("GET /campaigns", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    db = openDb(":memory:");
    app = await buildApp({ db, parse: async () => [], logger: false });
  });

  it("returns empty array when no campaigns exist", async () => {
    const res = await app.inject({ method: "GET", url: "/campaigns" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns campaign with expected fields", async () => {
    await app.inject({ method: "POST", url: "/campaigns", payload: {} });

    const res = await app.inject({ method: "GET", url: "/campaigns" });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ buyers: null, total: 0 });
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("createdAt");
    expect(list[0]).toHaveProperty("status");
  });

  it("returns at most 10 campaigns", async () => {
    for (let i = 0; i < 12; i++) {
      await app.inject({ method: "POST", url: "/campaigns", payload: {} });
    }
    const res = await app.inject({ method: "GET", url: "/campaigns" });
    expect(res.json()).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Ejecutar tests y verificar que fallan**

```bash
npm test -- --reporter=verbose test/campaigns.test.ts
```

Expected: FAIL — 404 en `GET /campaigns`

- [ ] **Step 3: Reemplazar el contenido de `src/routes/campaigns.ts`**

```ts
import type { FastifyInstance } from "fastify";
import type { DB } from "../db/client.ts";
import {
  getCampaign,
  getItems,
  createCampaignWithName,
  getActiveCampaign,
  listRecentCampaigns,
} from "../db/repositories.ts";
import { presentCampaign, presentItem } from "./presenters.ts";

export function registerCampaignRoutes(app: FastifyInstance, db: DB): void {
  app.post("/campaigns", async () => {
    const campaign = createCampaignWithName(db, "");
    return presentCampaign(campaign);
  });

  app.get("/campaigns", async () => {
    return listRecentCampaigns(db, 10).map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.created_at,
      status: c.status,
      buyers: c.buyers,
      total: c.total,
    }));
  });

  app.get("/campaigns/active", async (_req, reply) => {
    const campaign = getActiveCampaign(db);
    if (!campaign) {
      return reply.code(404).send({ error: "no active campaign" });
    }
    return {
      ...presentCampaign(campaign),
      items: getItems(db, campaign.id).map(presentItem),
    };
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const campaign = getCampaign(db, id);
    if (!campaign) {
      return reply.code(404).send({ error: "campaña no encontrada" });
    }
    return {
      ...presentCampaign(campaign),
      items: getItems(db, id).map(presentItem),
    };
  });
}
```

- [ ] **Step 4: Ejecutar todos los tests**

```bash
npm test
```

Expected: toda la suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/campaigns.ts test/campaigns.test.ts
git commit -m "feat: add GET /campaigns endpoint returning last 10 campaigns with buyers and totals"
```

---

## Task 3: Actualizar `public/shop.html`

**Files:**
- Rewrite: `public/shop.html`

Sin tests automatizados (frontend vanilla). La verificación es manual.

Cambios principales respecto al archivo actual:
- Elimina input `#campaign` y botón `#load`
- Auto-carga `GET /campaigns/active` en `DOMContentLoaded`
- Muestra nombre de campaña en `<p id="campaignName">`
- Widget de nombre de usuario con localStorage (guarda en blur; muestra "Hola, X · cambiar" si ya existe)
- `save` y `checkout` usan variable `campaignId` y `getEffectiveUserName()` en lugar de los inputs eliminados

- [ ] **Step 1: Reemplazar `public/shop.html` con el nuevo contenido**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comprar · Vino en Grupo</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <header class="topbar">
    <h1>🍷 Vino en Grupo</h1>
    <nav>
      <a href="/">Inicio</a>
      <a href="/ingest.html">Ingesta</a>
      <a href="/shop.html" class="active">Comprar</a>
      <a href="/admin.html">Organizador</a>
    </nav>
  </header>
  <main>
    <h2>Armá tu pedido</h2>
    <p id="campaignName" class="muted" style="margin-top:-0.5rem; margin-bottom:1rem;"></p>
    <div id="msg"></div>
    <div class="card" id="nameWidget" style="margin-bottom:1rem;"></div>

    <div class="card" id="catalogCard" style="display:none;">
      <div id="catalog"></div>
      <div class="row" style="margin-top:1rem; align-items:center; justify-content:space-between;">
        <div class="total">Subtotal: <span id="subtotal">$0</span></div>
        <div>
          <button class="ghost" id="save">Guardar pedido</button>
          <button id="checkout">Cerrar pedido</button>
        </div>
      </div>
    </div>
  </main>

  <script>
    const $ = (id) => document.getElementById(id);
    const money = (n) => "$" + n.toLocaleString("es-AR");
    let items = [], qty = {}, orderId = null, campaignId = null;

    const NAME_KEY = "userName";
    function getUserName() { return localStorage.getItem(NAME_KEY) || ""; }
    function saveUserName(name) { if (name) localStorage.setItem(NAME_KEY, name); }

    function renderNameWidget() {
      const saved = getUserName();
      if (saved) {
        $("nameWidget").innerHTML =
          `Hola, <strong>${saved}</strong> · <a href="#" id="changeNameLink">cambiar</a>`;
        $("changeNameLink").onclick = (e) => {
          e.preventDefault();
          localStorage.removeItem(NAME_KEY);
          renderNameWidget();
        };
      } else {
        $("nameWidget").innerHTML =
          `<label for="userNameInput">Tu nombre</label>` +
          `<input type="text" id="userNameInput" placeholder="Ana" style="margin-top:0.4rem;" />`;
        $("userNameInput").addEventListener("blur", () => {
          saveUserName($("userNameInput").value.trim());
        });
      }
    }

    function getEffectiveUserName() {
      return getUserName() || ($("userNameInput") ? $("userNameInput").value.trim() : "");
    }

    document.addEventListener("DOMContentLoaded", async () => {
      renderNameWidget();
      const res = await fetch("/campaigns/active");
      if (!res.ok) {
        $("msg").innerHTML = '<div class="notice err">No hay ninguna campaña activa por ahora.</div>';
        $("nameWidget").style.display = "none";
        return;
      }
      const c = await res.json();
      campaignId = c.id;
      $("campaignName").textContent = c.name || `Campaña #${c.id}`;
      if (c.status !== "ready") {
        $("msg").innerHTML = `<div class="notice err">La campaña está en estado: ${c.status}</div>`;
        return;
      }
      items = c.items; qty = {}; orderId = null;
      items.forEach((it) => (qty[it.id] = 0));
      $("catalogCard").style.display = "block";
      renderCatalog();
    });

    function renderCatalog() {
      const rows = items.map((it) =>
        "<tr><td>" + it.bodega + " · " + it.vino + (it.anada ? " (" + it.anada + ")" : "") +
        "</td><td class='num'>" + money(it.precioUnitario) + "</td><td>" +
        "<div class='stepper'>" +
        "<button class='small ghost' data-dec='" + it.id + "'>−</button>" +
        "<input type='number' min='0' value='" + qty[it.id] + "' data-qty='" + it.id + "'/>" +
        "<button class='small ghost' data-inc='" + it.id + "'>+</button>" +
        "</div></td><td class='num' id='lt-" + it.id + "'>" + money(qty[it.id] * it.precioUnitario) + "</td></tr>"
      ).join("");
      $("catalog").innerHTML =
        "<table><thead><tr><th>Vino</th><th class='num'>Precio</th><th>Cantidad</th><th class='num'>Subtotal</th></tr></thead><tbody>" +
        rows + "</tbody></table>";
      bind();
      recompute();
    }

    function bind() {
      document.querySelectorAll("[data-inc]").forEach((b) =>
        b.onclick = () => setQty(+b.dataset.inc, qty[+b.dataset.inc] + 1));
      document.querySelectorAll("[data-dec]").forEach((b) =>
        b.onclick = () => setQty(+b.dataset.dec, Math.max(0, qty[+b.dataset.dec] - 1)));
      document.querySelectorAll("[data-qty]").forEach((inp) =>
        inp.onchange = () => setQty(+inp.dataset.qty, Math.max(0, parseInt(inp.value) || 0)));
    }

    function setQty(id, v) {
      qty[id] = v;
      const inp = document.querySelector("[data-qty='" + id + "']");
      if (inp) inp.value = v;
      const it = items.find((x) => x.id === id);
      $("lt-" + id).textContent = money(v * it.precioUnitario);
      recompute();
    }

    function recompute() {
      const sub = items.reduce((s, it) => s + qty[it.id] * it.precioUnitario, 0);
      $("subtotal").textContent = money(sub);
    }

    function lines() {
      return items.filter((it) => qty[it.id] > 0).map((it) => ({ itemId: it.id, qty: qty[it.id] }));
    }

    $("save").addEventListener("click", async () => {
      const userName = getEffectiveUserName();
      if (!userName) return ($("msg").innerHTML = '<div class="notice err">Ingresá tu nombre primero.</div>');
      saveUserName(userName);
      renderNameWidget();
      const res = await fetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, userName, lines: lines() }),
      });
      const data = await res.json();
      if (!res.ok) return ($("msg").innerHTML = '<div class="notice err">' + data.error + "</div>");
      orderId = data.id;
      $("msg").innerHTML = '<div class="notice ok">Pedido #' + data.id + " guardado. Subtotal " + money(data.subtotal) + ".</div>";
    });

    $("checkout").addEventListener("click", async () => {
      const userName = getEffectiveUserName();
      if (!userName) return ($("msg").innerHTML = '<div class="notice err">Ingresá tu nombre primero.</div>');
      saveUserName(userName);
      renderNameWidget();
      const save = await fetch("/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, userName, lines: lines() }),
      });
      const saved = await save.json();
      if (!save.ok) return ($("msg").innerHTML = '<div class="notice err">' + saved.error + "</div>");
      const res = await fetch("/orders/" + saved.id + "/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) return ($("msg").innerHTML = '<div class="notice err">' + data.error + "</div>");
      $("msg").innerHTML = '<div class="notice ok">Pedido cerrado ✓ Total ' + money(data.subtotal) + ". Ya no se puede modificar.</div>";
      $("save").disabled = true; $("checkout").disabled = true;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verificar manualmente**

```bash
npm run seed   # crea campaña de ejemplo con items
npm run dev
```

Abrir http://localhost:3000/shop.html y verificar:
1. El catálogo se carga automáticamente (sin tocar nada)
2. El nombre de la campaña aparece debajo del título
3. Aparece el widget "Tu nombre" con un input
4. Escribir un nombre y hacer clic afuera → recargar la página → debe aparecer "Hola, {nombre} · cambiar"
5. Clic en "cambiar" → vuelve a mostrar el input
6. "Guardar pedido" funciona (sin ingresar campaña manualmente)
7. "Cerrar pedido" funciona

Para verificar sin campaña activa, correr con DB vacía:
```bash
DB_PATH=./test-empty.sqlite npm run dev
```
Abrir shop.html → debe mostrar "No hay ninguna campaña activa por ahora."

- [ ] **Step 3: Commit**

```bash
git add public/shop.html
git commit -m "feat: shop auto-loads active campaign, user name persisted in localStorage"
```

---

## Task 4: Actualizar `public/admin.html`

**Files:**
- Rewrite: `public/admin.html`

Cambios principales respecto al archivo actual:
- Elimina la sección "Active Campaign" (con `loadActiveCampaign`, `getTimeSince`, `createCampaignBtn`, etc.)
- Elimina el input manual `#campaign` + botón `#load`
- Nueva sección: botón "+ Nueva campaña" + tabla `#campaignList` que se auto-carga
- La función `load(id)` recibe el id como argumento (antes leía de `$("campaign").value`)
- `renderRollup` y `renderDist` son idénticas a las actuales

- [ ] **Step 1: Reemplazar `public/admin.html` con el nuevo contenido**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Organizador · Vino en Grupo</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <header class="topbar">
    <h1>🍷 Vino en Grupo</h1>
    <nav>
      <a href="/">Inicio</a>
      <a href="/ingest.html">Ingesta</a>
      <a href="/shop.html">Comprar</a>
      <a href="/admin.html" class="active">Organizador</a>
    </nav>
  </header>
  <main>
    <h2>Panel del organizador</h2>

    <div class="card">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
        <h3 style="margin:0;">Campañas recientes</h3>
        <button id="createCampaignBtn">+ Nueva campaña</button>
      </div>
      <div id="createMsg"></div>
      <div id="campaignList"></div>
    </div>

    <div class="card" id="rollupCard" style="display:none;">
      <h3>Roll-up · qué comprarle al proveedor</h3>
      <div id="rollup"></div>
    </div>

    <div class="card" id="distCard" style="display:none;">
      <h3>Distribución · qué entregar y cobrar a cada uno</h3>
      <div id="dist"></div>
    </div>
  </main>

  <script>
    const $ = (id) => document.getElementById(id);
    const money = (n) => "$" + n.toLocaleString("es-AR");
    let campaignId = null;

    document.addEventListener("DOMContentLoaded", () => {
      loadCampaignList();

      $("createCampaignBtn").addEventListener("click", async () => {
        const res = await fetch("/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) {
          $("createMsg").innerHTML = '<div class="notice err">Error al crear campaña.</div>';
          return;
        }
        $("createMsg").innerHTML = '<div class="notice ok">Campaña creada.</div>';
        setTimeout(() => { $("createMsg").innerHTML = ""; }, 2000);
        loadCampaignList();
      });
    });

    async function loadCampaignList() {
      const res = await fetch("/campaigns");
      if (!res.ok) {
        $("campaignList").innerHTML = '<p class="muted">Error cargando campañas.</p>';
        return;
      }
      const campaigns = await res.json();
      if (!campaigns.length) {
        $("campaignList").innerHTML = '<p class="muted">Sin campañas aún. Creá una para empezar.</p>';
        return;
      }
      const rows = campaigns.map((c) => {
        const date = new Date(c.createdAt).toLocaleDateString("es-AR", {
          day: "numeric", month: "short", year: "numeric",
        });
        return (
          "<tr>" +
          "<td>" + (c.name || "Campaña #" + c.id) + "</td>" +
          "<td>" + date + "</td>" +
          "<td class='muted'>" + (c.buyers || "—") + "</td>" +
          "<td class='num'>" + money(c.total) + "</td>" +
          "<td><button class='small' data-load='" + c.id + "'>Cargar</button></td>" +
          "</tr>"
        );
      }).join("");
      $("campaignList").innerHTML =
        "<table><thead><tr>" +
        "<th>Campaña</th><th>Fecha</th><th>Compradores</th><th class='num'>Total</th><th></th>" +
        "</tr></thead><tbody>" + rows + "</tbody></table>";
      document.querySelectorAll("[data-load]").forEach((b) =>
        b.onclick = () => load(+b.dataset.load));
    }

    async function load(id) {
      campaignId = id;
      const r = await fetch("/campaigns/" + campaignId + "/rollup");
      if (!r.ok) return;
      renderRollup(await r.json());
      renderDist(await (await fetch("/campaigns/" + campaignId + "/distribution")).json());
    }

    function renderRollup(rows) {
      $("rollupCard").style.display = "block";
      if (!rows.length) { $("rollup").innerHTML = '<p class="muted">Sin items.</p>'; return; }
      const trs = rows.map((r) =>
        "<tr><td>" + r.bodega + " · " + r.vino + "</td>" +
        "<td class='num'>" + r.totalBotellas + "</td>" +
        "<td class='num'>" + r.cajas + " <span class='muted'>(x" + r.unidadesPorCaja + ")</span></td>" +
        "<td class='num'>" + money(r.precioUnitario) + "</td>" +
        "<td class='num'>" + money(r.totalEstimado) + "</td></tr>"
      ).join("");
      const total = rows.reduce((s, r) => s + r.totalEstimado, 0);
      $("rollup").innerHTML =
        "<table><thead><tr><th>Vino</th><th class='num'>Botellas</th><th class='num'>Cajas</th>" +
        "<th class='num'>Precio</th><th class='num'>Total</th></tr></thead><tbody>" + trs +
        "</tbody><tfoot><tr><th colspan='4'>Total estimado de la compra</th>" +
        "<th class='num total'>" + money(total) + "</th></tr></tfoot></table>";
    }

    function renderDist(rows) {
      $("distCard").style.display = "block";
      if (!rows.length) { $("dist").innerHTML = '<p class="muted">Nadie pidió todavía.</p>'; return; }
      $("dist").innerHTML = rows.map((d) => {
        const lines = d.lines.map((l) => l.qty + "× " + l.vino).join(", ") || "—";
        const payPill = d.paid
          ? '<span class="pill paid">pagado</span>'
          : '<span class="pill unpaid">sin pagar</span>';
        const statusPill = '<span class="pill ' + d.status + '">' + d.status + "</span>";
        return (
          '<div class="card" style="margin:0.6rem 0; padding:0.9rem 1rem;">' +
          "<strong>" + d.userName + "</strong> " + statusPill + " " + payPill +
          '<div class="muted" style="margin:0.3rem 0;">' + lines + "</div>" +
          '<div class="row" style="align-items:center; justify-content:space-between;">' +
          '<span class="total">' + money(d.subtotal) + "</span>" +
          '<button class="small ' + (d.paid ? "ghost" : "") + '" data-pay="' + d.orderId + '" data-val="' + (!d.paid) + '">' +
          (d.paid ? "Marcar sin pagar" : "Marcar pagado") + "</button></div></div>"
        );
      }).join("");
      document.querySelectorAll("[data-pay]").forEach((b) =>
        b.onclick = async () => {
          await fetch("/orders/" + b.dataset.pay + "/payment", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paid: b.dataset.val === "true" }),
          });
          load(campaignId);
        });
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verificar manualmente**

```bash
npm run seed
npm run dev
```

Abrir http://localhost:3000/admin.html y verificar:
1. La tabla de campañas se carga automáticamente al abrir la página
2. Cada fila muestra nombre, fecha, compradores (o "—") y total ($0 si sin pedidos)
3. Botón "+ Nueva campaña" crea una campaña y la tabla se recarga (nueva fila aparece arriba)
4. Botón "Cargar" en una fila muestra rollup y distribución debajo
5. Botones "Marcar pagado/sin pagar" siguen funcionando y recargan la distribución

- [ ] **Step 3: Correr la suite completa y typecheck**

```bash
npm test
npm run typecheck
```

Expected: todo PASS.

- [ ] **Step 4: Commit**

```bash
git add public/admin.html
git commit -m "feat: admin shows recent campaigns table with buyers and totals"
```
