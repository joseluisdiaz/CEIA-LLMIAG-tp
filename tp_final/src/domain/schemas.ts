import { Type, type Static } from "@sinclair/typebox";

// --- Contrato de extracción del LLM (el "crudo" que devuelve Claude) ---
//
// Es la ÚNICA fuente de verdad para lo que pedimos al modelo: este mismo objeto
// se usa como `input_schema` de la tool de Claude (forced tool use) y como esquema
// de validación de la respuesta. additionalProperties:false mantiene la salida acotada.
//
// El precio se pide como STRING tal cual aparece en el mensaje (ej. "$12.500"): la
// normalización a number (locale es-AR) la hace nuestra "capa de validación", no el
// modelo. Esto evita que el LLM malinterprete "12.500" como 12,5.

const Nullable = <T extends import("@sinclair/typebox").TSchema>(schema: T) =>
  Type.Union([schema, Type.Null()]);

export const ExtractionItemSchema = Type.Object(
  {
    bodega: Type.String({ description: "Nombre de la bodega o productor." }),
    vino: Type.String({ description: "Nombre comercial del vino." }),
    cepa: Nullable(
      Type.String({ description: "Cepa/varietal (Malbec, Cabernet, etc.) o null." }),
    ),
    anada: Nullable(
      Type.Integer({ description: "Año de cosecha (añada) o null si no figura." }),
    ),
    precioTexto: Type.String({
      description:
        "Precio unitario EXACTAMENTE como aparece en el texto, con símbolos y separadores (ej. \"$12.500\"). No lo conviertas a número.",
    }),
    condiciones: Nullable(
      Type.String({ description: "Condiciones de compra (ej. 'mínimo caja de 6') o null." }),
    ),
    minCompra: Nullable(
      Type.Integer({ description: "Cantidad mínima de botellas a comprar, o null." }),
    ),
    unidadesPorCaja: Nullable(
      Type.Integer({ description: "Botellas por caja si se menciona, o null." }),
    ),
  },
  { additionalProperties: false },
);

export const ExtractionResultSchema = Type.Object(
  {
    promos: Type.Array(ExtractionItemSchema, {
      description: "Una entrada por cada vino en promoción detectado en el mensaje.",
    }),
  },
  { additionalProperties: false },
);

export type ExtractionItem = Static<typeof ExtractionItemSchema>;
export type ExtractionResult = Static<typeof ExtractionResultSchema>;

// --- Promo normalizada y validada (lo que persistimos) ---
// Estructuralmente compatible con NewItem de la capa de repositorios.
export interface ParsedPromo {
  bodega: string;
  vino: string;
  cepa: string | null;
  anada: number | null;
  precioUnitario: number;
  condiciones: string | null;
  minCompra: number | null;
  unidadesPorCaja: number | null;
}
