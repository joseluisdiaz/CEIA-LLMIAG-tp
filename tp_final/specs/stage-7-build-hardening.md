# Stage 7 — Empaquetado, hardening y docs

## Objetivo
Compilar la API con `tsc`, asegurar que el artefacto sea autocontenido y reproducible, y documentar cómo reproducir el flujo completo desde cero.

## Build

### Compilador: tsc
```bash
npm run build   # tsc --project tsconfig.build.json
```
- `tsconfig.build.json` extiende `tsconfig.json` y añade `outDir: "dist"`, `rootDir: "src"`, `rewriteRelativeImportExtensions: true`.
- `rewriteRelativeImportExtensions`: convierte los imports `.ts` → `.js` en el output, sin que el programador tenga que escribir `.js` en el source.
- No se bundlea: `dist/` tiene la misma estructura de carpetas que `src/`, con cada `.ts` → `.js`. Las dependencias de `node_modules` permanecen externas (incluyendo `better-sqlite3`, que es un addon nativo).

### Autocontención del schema SQL
El DDL de la DB se guarda como string inline en `src/db/schema.ts` (no como archivo `.sql`). Esto evita que el artefacto compilado necesite resolver rutas de archivos en tiempo de ejecución.

## Hardening

### Advertencia de API key ausente
`src/server.ts` verifica `config.anthropicApiKey` al boot:
```
[warn] ANTHROPIC_API_KEY no configurada: la ingesta vía LLM fallará.
       La UI y `npm run seed` funcionan igual.
```
El servidor arranca igual — la UI y el seed no dependen del LLM.

### Validación de body con TypeBox
Todos los endpoints que reciben body usan `schema: { body: ... }` con un schema TypeBox. Fastify valida y rechaza con 400 automáticamente.

## Dependencia de Node
- Runtime target: Node 24 LTS (`.nvmrc`, `engines: ">=22.6.0"`).
- `better-sqlite3` es un addon nativo que debe compilarse para la versión de Node activa. Si se cambia de versión: `npm rebuild`.

## Docs: README.md
Cubre:
- Qué hace el sistema (flujo en 3 pasos).
- Stack técnico.
- Setup en 3 comandos (`npm install`, `.env`, `npm run dev`).
- Tabla de scripts.
- Demo sin API key (`npm run seed` + dev + navegador).
- Demo con LLM (`npm run parse`).
- Mapa de carpetas.
- Tabla de endpoints.

## Criterios de validación
```bash
npm run build                  # sin errores de tsc
node dist/server.js &          # arranca
curl localhost:3000/health     # → 200 {"status":"ok"}
curl -o /dev/null -w "%{http_code}" localhost:3000/   # → 200 (estático)
```
El log de arranque debe mostrar el warn de API key si no está configurada.

Verificación del rewrite de extensiones en el output:
```bash
grep 'from "\..*\.js"' dist/server.js   # debe encontrar imports .js (no .ts)
```
