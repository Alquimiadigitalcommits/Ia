// Finanzas personales en la base "Finanzas personales" de Notion (página "Mi día").

import { escribir, leer, type ClienteNotion } from "../conectores/notion.js";
import { fechaISO } from "./personal.js";

export const CATEGORIAS_PERSONALES = [
  "Comida", "Supermercado", "Transporte", "Arriendo", "Cuentas", "Salud", "Ropa y cuidado", "Ocio",
  "Suscripciones", "Educación", "Regalos", "Deudas", "Sueldo", "Freelance", "Otro",
] as const;
export const MEDIOS_PAGO = ["Débito", "Crédito", "Efectivo", "Transferencia"] as const;

export interface MovimientoPersonal {
  tipo: "Gasto" | "Ingreso" | "Ahorro";
  monto: number;
  categoria: (typeof CATEGORIAS_PERSONALES)[number];
  descripcion: string;
  medioPago?: (typeof MEDIOS_PAGO)[number] | null;
  fecha?: string | null;
}

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export async function registrarMovimiento(notion: ClienteNotion, db: string, m: MovimientoPersonal, ahora = new Date()) {
  const props: Record<string, unknown> = {
    Movimiento: escribir.titulo(m.descripcion),
    Fecha: escribir.fecha(m.fecha ?? fechaISO(ahora)),
    Tipo: escribir.opcion(m.tipo),
    "Categoría": escribir.opcion(m.categoria),
    Monto: escribir.numero(Math.round(m.monto)),
    Origen: escribir.opcion("WhatsApp"),
  };
  if (m.medioPago) props["Medio de pago"] = escribir.opcion(m.medioPago);
  const pagina = await notion.crearPagina(db, props);
  return { pagina, resumen: `${m.tipo} personal: ${m.descripcion} ${clp(m.monto)} · ${m.categoria}${m.medioPago ? ` · ${m.medioPago}` : ""}` };
}

export async function resumenFinanzasMes(notion: ClienteNotion, db: string, ahora = new Date()) {
  const hoy = fechaISO(ahora);
  const mes = hoy.slice(0, 7);
  const filas = await notion.consultar(db, { filter: { property: "Fecha", date: { on_or_after: `${mes}-01` } } });
  let gastos = 0, ingresos = 0, ahorro = 0;
  const porCategoria = new Map<string, number>();
  for (const f of filas) {
    const p = f.properties;
    if (!(leer.fecha(p.Fecha) ?? "").startsWith(mes)) continue;
    const monto = leer.numero(p.Monto) ?? 0;
    const tipo = leer.opcion(p.Tipo);
    if (tipo === "Ingreso") ingresos += monto;
    else if (tipo === "Ahorro") ahorro += monto;
    else {
      gastos += monto;
      const cat = leer.opcion(p["Categoría"]) ?? "Otro";
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + monto);
    }
  }
  return {
    mes,
    gastos,
    ingresos,
    ahorro,
    balance: ingresos - gastos - ahorro,
    porCategoria: [...porCategoria.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto),
    movimientos: filas.length,
  };
}
