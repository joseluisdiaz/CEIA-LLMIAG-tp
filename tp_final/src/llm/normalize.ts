import { Value } from "@sinclair/typebox/value";
import { ExtractionResultSchema, type ParsedPromo } from "../domain/schemas.ts";

// Normaliza un precio escrito en formato es-AR a un entero de pesos.
// Reglas: "." es separador de miles y "," separador decimal.
//   "$12.500"      -> 12500
//   "$ 1.250,50"   -> 1250  (redondeado)
//   "9000"         -> 9000
// Lanza si no se puede extraer un número positivo.
export function normalizePrice(raw: string): number {
  let s = raw.replace(/[^\d.,]/g, ""); // descarta $, espacios, letras
  if (!s) throw new Error(`Precio no parseable: "${raw}"`);

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // "1.250,50" -> miles con ".", decimal con ","
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // "1250,50" -> coma decimal
    s = s.replace(",", ".");
  } else if (hasDot) {
    // Ambiguo: si el último grupo tras un "." tiene 3 dígitos lo tratamos como
    // separador de miles ("12.500"); si no, como decimal ("12.5").
    const lastGroup = s.slice(s.lastIndexOf(".") + 1);
    if (lastGroup.length === 3) s = s.replace(/\./g, "");
  }

  const n = Math.round(Number(s));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Precio no parseable: "${raw}"`);
  }
  return n;
}

const trimOrNull = (v: string | null): string | null => {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
};

// "Capa de validación": valida la salida cruda del LLM contra el esquema TypeBox
// y la normaliza a ParsedPromo[]. Es una función pura — testeable sin red ni DB.
export function normalizeExtraction(raw: unknown): ParsedPromo[] {
  if (!Value.Check(ExtractionResultSchema, raw)) {
    const errors = [...Value.Errors(ExtractionResultSchema, raw)]
      .slice(0, 5)
      .map((e) => `${e.path}: ${e.message}`)
      .join("; ");
    throw new Error(`Salida del LLM no válida: ${errors}`);
  }

  return raw.promos.map((p) => ({
    bodega: p.bodega.trim(),
    vino: p.vino.trim(),
    cepa: trimOrNull(p.cepa),
    anada: p.anada,
    precioUnitario: normalizePrice(p.precioTexto),
    condiciones: trimOrNull(p.condiciones),
    minCompra: p.minCompra,
    unidadesPorCaja: p.unidadesPorCaja,
  }));
}
