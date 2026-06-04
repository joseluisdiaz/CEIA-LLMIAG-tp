import { describe, it, expect } from "vitest";
import { normalizePrice, normalizeExtraction } from "../src/llm/normalize.ts";

describe("normalizePrice (locale es-AR)", () => {
  it("trata el punto como separador de miles", () => {
    expect(normalizePrice("$12.500")).toBe(12500);
    expect(normalizePrice("$48.500 c/u")).toBe(48500);
  });

  it("trata la coma como decimal y redondea", () => {
    expect(normalizePrice("$1.250,50")).toBe(1251);
    expect(normalizePrice("9000,40")).toBe(9000);
  });

  it("maneja números sin separadores", () => {
    expect(normalizePrice("9000")).toBe(9000);
    expect(normalizePrice("$ 11200")).toBe(11200);
  });

  it("trata punto + 1-2 dígitos como decimal", () => {
    expect(normalizePrice("12.5")).toBe(13); // redondeo
  });

  it("lanza si no hay número", () => {
    expect(() => normalizePrice("gratis")).toThrow();
    expect(() => normalizePrice("")).toThrow();
  });
});

describe("normalizeExtraction (capa de validación)", () => {
  it("valida y normaliza una salida correcta del LLM", () => {
    const raw = {
      promos: [
        {
          bodega: "  Catena Zapata ",
          vino: "Adrianna Malbec",
          cepa: "Malbec",
          anada: 2019,
          precioTexto: "$48.500",
          condiciones: "mínimo caja x6",
          minCompra: 6,
          unidadesPorCaja: 6,
        },
        {
          bodega: "Norton",
          vino: "Reserva",
          cepa: null,
          anada: null,
          precioTexto: "9000",
          condiciones: null,
          minCompra: null,
          unidadesPorCaja: null,
        },
      ],
    };
    const out = normalizeExtraction(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      bodega: "Catena Zapata", // trim
      precioUnitario: 48500, // string -> number
      anada: 2019,
    });
    expect(out[1].precioUnitario).toBe(9000);
    expect(out[1].cepa).toBeNull();
  });

  it("acepta promos vacío (mensaje sin promociones)", () => {
    expect(normalizeExtraction({ promos: [] })).toEqual([]);
  });

  it("rechaza salida con tipos incorrectos", () => {
    expect(() => normalizeExtraction({ promos: [{ bodega: 123 }] })).toThrow(
      /no válida/,
    );
  });

  it("rechaza salida sin la clave promos", () => {
    expect(() => normalizeExtraction({ items: [] })).toThrow(/no válida/);
  });

  it("convierte cadena vacía de cepa a null", () => {
    const out = normalizeExtraction({
      promos: [
        {
          bodega: "X",
          vino: "Y",
          cepa: "   ",
          anada: null,
          precioTexto: "$1.000",
          condiciones: null,
          minCompra: null,
          unidadesPorCaja: null,
        },
      ],
    });
    expect(out[0].cepa).toBeNull();
    expect(out[0].precioUnitario).toBe(1000);
  });
});
