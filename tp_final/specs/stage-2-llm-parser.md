# Stage 2 — Parser LLM estructurado

## Objetivo
Extraer entidades de vino de texto crudo usando Claude con *forced tool use* y validar/normalizar la salida antes de que toque la DB. Este stage es **completamente aislado**: no depende de DB ni de HTTP.

## Contrato de extracción (TypeBox)
```ts
ExtractionResultSchema = {
  promos: Array<{
    bodega: string
    vino: string
    cepa: string | null
    anada: integer | null
    precioTexto: string        // precio TAL CUAL aparece, ej. "$12.500"
    condiciones: string | null
    minCompra: integer | null
    unidadesPorCaja: integer | null
  }>
}
```
El `precioTexto` es string deliberadamente: la normalización de moneda es responsabilidad nuestra, no del modelo.

## Tipo de salida normalizada
```ts
ParsedPromo = {
  bodega, vino, cepa, anada,
  precioUnitario: number,   // entero de pesos
  condiciones, minCompra, unidadesPorCaja
}
```

## Archivos
- `src/domain/schemas.ts`: `ExtractionResultSchema` (TypeBox) + `ParsedPromo` (interface).
- `src/llm/prompts.ts`: `SYSTEM_PROMPT` (estable byte a byte → prompt caching) + `TOOL_NAME`.
- `src/llm/normalize.ts`: `normalizePrice(raw: string): number` + `normalizeExtraction(raw): ParsedPromo[]`.
- `src/llm/parser.ts`: `parsePromo(text): Promise<ParsedPromo[]>` — Claude tool use, `cache_control` en el system block.
- `src/llm/cli.ts`: `npm run parse -- <archivo.txt>`.
- `test/fixtures/enofilo.txt`, `simple.txt`: mensajes de ejemplo.

## Mecánica del parser
1. Llama a Claude con `tool_choice: {type: "tool", name: "extract_promos"}` (forced tool use).
2. El `input_schema` de la tool es `ExtractionResultSchema` — TypeBox como fuente de verdad.
3. `cache_control: {type: "ephemeral"}` en el system block → cachea system + tools.
4. Recibe la respuesta, extrae el bloque `tool_use`, pasa el `.input` a `normalizeExtraction()`.

## Normalización de precios (locale es-AR)
- `"$12.500"` → `12500` (punto = miles)
- `"$1.250,50"` → `1251` (punto = miles, coma = decimal, redondeado)
- `"9000"` → `9000`
- Punto con ≤2 dígitos tras él → decimal (`"12.5"` → `13`)
- Lanza si no hay número positivo extraíble.

## Criterios de validación
```bash
npm test -- parser.test.ts   # 10 tests: normalizePrice y normalizeExtraction
# Con ANTHROPIC_API_KEY:
npm run parse -- test/fixtures/enofilo.txt   # imprime JSON validado
```
Los tests son deterministas (sin red). El CLI prueba el LLM real.
