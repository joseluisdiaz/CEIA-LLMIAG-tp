# Stage 6 — Frontend estático

## Objetivo
Tres vistas HTML/CSS/JS vanilla que cubren el flujo completo sin framework. Servidas por Fastify a través de `@fastify/static` desde `public/`.

## Vistas

### ingest.html — `/ingest.html`
- Textarea para pegar el mensaje de WhatsApp.
- Botón "Procesar con IA" → `POST /webhooks/whatsapp`.
- Muestra "200 OK — procesando..." al instante.
- Pollea `GET /campaigns/:id` hasta que status ≠ processing (máx ~21 seg).
- Muestra el catálogo extraído en una tabla (bodega, vino, cepa, añada, precio, condiciones).
- Si status = error, muestra el mensaje de error.
- Al terminar, ofrece el link directo a `/shop.html?campaign=:id`.

### shop.html — `/shop.html`
- Inputs para N° de campaña y nombre del comprador.
- Botón "Cargar catálogo" → `GET /campaigns/:id`.
- Por cada vino: stepper +/− de cantidad + subtotal de esa línea.
- Calculadora en tiempo real del subtotal total (calculado localmente para UX; el valor definitivo viene del servidor).
- "Guardar pedido" → `POST /orders` (idempotente, puede llamarse varias veces).
- "Cerrar pedido" → `POST /orders` + `POST /orders/:id/checkout`. Deshabilita los controles.
- Acepta `?campaign=N` en la URL para precargar el N° de campaña.

### admin.html — `/admin.html`
- Input para N° de campaña + botón Cargar.
- **Sección roll-up**: tabla con vino, botellas, cajas (con `×N` de `unidadesPorCaja`), precio unitario, total estimado, y el gran total al pie.
- **Sección distribution**: un card por persona con sus líneas, subtotal, pills de status (`open`/`closed`) y pago (`pagado`/`sin pagar`), y botón para alternar el estado de pago.
- Botón de pago hace `PATCH /orders/:id/payment` y recarga las dos secciones.
- Acepta `?campaign=N` en la URL.

### style.css
Hoja compartida con variables CSS (paleta burdeos/dorado), componentes: `.card`, `.stepper`, `.pill`, `.total`, tabla, `.notice`.

## Estructura de `public/`
```
public/
  index.html    landing con tiles hacia las 3 vistas
  ingest.html
  shop.html
  admin.html
  style.css
```

## Registro en Fastify
```ts
app.register(fastifyStatic, {
  root: join(dirname(fileURLToPath(import.meta.url)), "..", "public"),
  prefix: "/"
})
```
El `".."` funciona tanto desde `src/app.ts` (dev) como desde `dist/app.js` (prod) porque ambos son un nivel dentro del proyecto.

## Criterios de validación
Flujo manual completo:
1. `npm run seed` → campaña de ejemplo.
2. `npm run dev`.
3. `/shop.html?campaign=1`: dos usuarios distintos arman pedidos y hacen checkout.
4. `/admin.html?campaign=1`: roll-up muestra las cajas correctas; marcar pagos se refleja.

Smoke automático (en el CI de stages anteriores):
```bash
curl -o /dev/null -w "%{http_code}" localhost:PORT/shop.html   # → 200
```
