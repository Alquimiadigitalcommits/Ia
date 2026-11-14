import fichas from "../clientes.json" with { type: "json" };

/** Ficha de cada cliente. Claude la usa para decidir a quién le sirve una idea. */
export interface FichaCliente {
  nombre: string;
  rubro: string;
  publico: string;
  temas: string[];
  tono: string;
  evitar: string[];
}

export const CLIENTES: FichaCliente[] = fichas;
export const nombresClientes = () => CLIENTES.map((c) => c.nombre);

export const fichasComoTexto = () =>
  CLIENTES.map(
    (c) =>
      `- ${c.nombre}: ${c.rubro}. Público: ${c.publico}. Temas: ${c.temas.join(", ")}. Tono: ${c.tono}.` +
      (c.evitar.length ? ` Evitar: ${c.evitar.join(", ")}.` : ""),
  ).join("\n");
