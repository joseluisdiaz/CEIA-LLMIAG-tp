# Stage 0 — Bootstrap del proyecto

## Objetivo
Inicializar `tp_final/` como un proyecto Node+TypeScript funcional con Fastify y un endpoint de salud.

## Alcance
- `package.json`: nombre, version, `"type": "module"`, scripts, dependencias de producción y dev.
- `tsconfig.json`: base para typecheck (noEmit, allowImportingTsExtensions, moduleResolution Bundler).
- `tsconfig.build.json`: extiende el base, emite a `dist/`, reescribe `.ts` → `.js`.
- `.env.example`: documenta las cuatro variables (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `PORT`, `DB_PATH`).
- `.gitignore`: `node_modules/`, `dist/`, `.env`, `*.sqlite`.
- `.nvmrc`: fija la versión de Node (24 LTS).
- `src/config.ts`: carga `.env` con `process.loadEnvFile()` y exporta `config` tipado.
- `src/app.ts`: `buildApp(opts?)` construye la instancia de Fastify con `GET /health`.
- `src/server.ts`: levanta el server en `config.port`, avisa si falta `ANTHROPIC_API_KEY`.

## Scripts obligatorios
| Script | Comando |
|---|---|
| `dev` | `node --strip-types --watch src/server.ts` |
| `start` | `node dist/server.js` |
| `build` | `tsc --project tsconfig.build.json` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |

## Criterios de validación
```bash
npm run typecheck        # sin errores
npm run dev &            # arranca
curl localhost:3000/health   # → 200 {"status":"ok"}
```
