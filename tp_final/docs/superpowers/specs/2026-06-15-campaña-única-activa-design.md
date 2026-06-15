# Diseño: Una Campaña Activa por Fecha

**Fecha:** 2026-06-15  
**Contexto:** Actualmente cada mensaje WhatsApp crea una campaña nueva. Este diseño permite que múltiples mensajes se acumulen en una única campaña activa.

---

## Objetivo

Cambiar el flujo de ingesta para que:
1. Siempre exista una campaña activa (la más reciente por `created_at`)
2. Los mensajes WhatsApp se agreguen a esa campaña activa
3. Se pueda crear una nueva campaña desde la UI admin (nombres auto-generados)
4. Si llega un mensaje sin campaña activa, se cree una automáticamente

---

## Arquitectura

### Base de Datos

**Cambio mínimo:** Agregar columna `name` a `campaigns`.

```sql
-- SCHEMA ACTUAL (src/db/schema.ts)
CREATE TABLE campaigns (
  id          INTEGER PRIMARY KEY,
  source_text TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'processing',
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NUEVO SCHEMA
CREATE TABLE campaigns (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,              -- NUEVO: nombre auto-generado
  source_text TEXT,                       -- PUEDE SER NULL (si se crea manualmente sin mensaje)
  status      TEXT NOT NULL DEFAULT 'processing',
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Campaña activa** = la más reciente por `created_at`:
```sql
SELECT * FROM campaigns 
ORDER BY created_at DESC 
LIMIT 1;
```

### Lógica de Nombres

Todos los nombres de campaña se generan automáticamente con formato:
```
"Campaign {ISO_DATETIME}"
```
Ejemplo: `"Campaign 2026-06-15T10:30:45Z"`

### Flujo de Ingesta (Webhook WhatsApp)

1. **Recibir mensaje** en `POST /webhooks/whatsapp`
2. **Buscar campaña activa:**
   - `SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 1`
3. **Si NO existe campaña activa:**
   - Crear nueva: `INSERT INTO campaigns (name, created_at) VALUES ("Campaign {NOW}", NOW)`
4. **Procesar mensaje** hacia esa campaña (existente o recién creada)
5. **Responder 200 OK inmediato** (procesamiento async como antes)

---

## API

### POST /campaigns

**Crear una nueva campaña (y desactivar la anterior).**

- **Request:** `{}` (body vacío, o parámetros ignorados)
- **Response:** `{ id, name, created_at, status }`
- **Efecto:** La campaña anterior deja de ser activa automáticamente (porque la nueva es más reciente)

**Ejemplo:**
```bash
POST /campaigns
{}

Response:
{
  "id": 42,
  "name": "Campaign 2026-06-15T14:22:30Z",
  "created_at": "2026-06-15T14:22:30Z",
  "status": "processing"  // estado del procesamiento LLM (no tiene items si se crea sin mensaje)
}
```

---

## UI Admin

### Cambios en `admin.html`

1. **Mostrar campaña activa actual** (en un panel visible)
   - Nombre + fecha de creación + estado de procesamiento
   - Ejemplo: "**Active Campaign:** Campaign 2026-06-15T14:22:30Z (created 2h ago, processing)"
   - Si no hay campaña → mostrar "No campaign created yet"

2. **Botón "Create Campaign"**
   - Onclick → `POST /campaigns` → crea nueva campaña
   - Recarga la UI para mostrar la nueva campaña activa

### Respuesta a Errores

- Si POST /campaigns falla → mostrar toast error

---

## Casos Edge

### 1. Primer uso (sin campañas)
- Llega primer mensaje WhatsApp
- No existe campaña activa
- Sistema crea automáticamente: `"Campaign 2026-06-15T..."`
- Mensaje se ingesta hacia esa campaña

### 2. Admin crea campaña nueva mientras hay mensajes en cola
- Nueva campaña se vuelve activa automáticamente
- Próximos mensajes van a la nueva campaña
- Campaña anterior queda "inactiva" pero con sus datos (no se borra)

### 3. ¿Puedo acceder a campañas viejas?
- `GET /campaigns/:id` funciona para cualquier campaña (activa o no) — existente, no cambia
- No hay `GET /campaigns` (listado) — solo la activa es conocida desde la UI admin

---

## Cambios por Archivo

| Archivo | Cambio |
|---------|--------|
| `src/routes/campaigns.ts` | Agregar `POST /campaigns` |
| `src/services/ingest.ts` | En `ingestMessage()`, buscar campaña activa; si no existe, crear |
| `src/db/repositories.ts` | Helper: `getActiveCampaign()` |
| `public/admin.html` | Mostrar campaña activa + botón "Create Campaign" |
| `src/services/organizer.ts` | (Opcional) Mostrar campaña activa en rollup |

---

## Testing

### Unit Tests
- `getActiveCampaign()` devuelve la campaña más reciente (o null si no hay)
- `createCampaign()` genera nombre con timestamp válido
- Crear campaña nueva → campaña anterior no es activa

### Integration Tests
- Webhook sin campaña activa → se crea y procesa mensaje
- Webhook con campaña activa → usa esa
- POST /campaigns → nueva campaña es activa

---

## Preguntas Resueltas

- ✅ ¿Cómo se inicia una campaña? → Por el organizador vía UI, o automáticamente si llega mensaje
- ✅ ¿Cómo sé cuál es activa? → La más reciente por `created_at`
- ✅ ¿Qué pasa si no hay campaña? → Se crea automáticamente
- ✅ ¿Nombres? → Auto-generados siempre

---

## Scope y Limitaciones

- **No hay "cierre" explícito de campaña** — simplemente se vuelve inactiva cuando se crea una nueva
- **Sin soft-delete** — campañas viejas quedan en la DB. Cleanup manual o migración futura
- **Sin UI para ver histórico de campañas** — solo la activa es visible. Acceso vía API directo si es necesario

