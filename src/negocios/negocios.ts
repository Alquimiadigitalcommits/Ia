// Finanzas de los negocios, inventario y proveedores en la planilla
// "Sistema_Administrativo_Emprendimientos" de Google Drive.
// Los nombres de hojas y columnas son los de tu planilla, tal cual.

import type { ClienteSheets } from "../conectores/sheets.js";
import { fechaISO } from "../personal/personal.js";

export const NEGOCIOS = ["Ropa", "Calzado", "Detalles", "Dropshipping", "Etsy", "Alquimia Digital"] as const;
export type Negocio = (typeof NEGOCIOS)[number];

export const HOJAS = {
  ventas: "03 - Ventas",
  gastos: "04 - Gastos",
  compras: "05 - Compras",
  inventario: "06 - Inventario",
  proveedores: "07 - Proveedores",
} as const;

/** Columnas nuevas autorizadas para Proveedores (se agregan a la derecha si faltan). */
export const COLUMNAS_NUEVAS_PROVEEDORES = ["Dirección", "Comuna", "Qué vende", "Precio de referencia", "Fecha de registro"];

/** "14-11-2026", formato de fecha que ya usa tu planilla. */
export const fechaPlanilla = (iso: string) => iso.split("-").reverse().join("-");

const idCorto = (prefijo: string, ahora: Date) =>
  `${prefijo}-${fechaISO(ahora).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export interface Escritura {
  hoja: string;
  fila: number;
  columnas: string[];
  resumen: string;
}

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

async function escribir(s: ClienteSheets, hoja: string, valores: Record<string, string | number | null | undefined>, resumen: string): Promise<Escritura> {
  const fila = await s.agregarFila(hoja, valores);
  const columnas = Object.keys(valores).filter((k) => valores[k] !== undefined && valores[k] !== null && valores[k] !== "");
  return { hoja, fila, columnas, resumen };
}

export interface Venta {
  negocio: Negocio;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number | null;
  canal?: string | null;
  medioPago?: string | null;
  estadoPago?: string | null;
  observaciones?: string | null;
}

export function registrarVenta(s: ClienteSheets, v: Venta, ahora = new Date()) {
  const bruto = v.cantidad * v.precioUnitario - (v.descuento ?? 0);
  return escribir(
    s,
    HOJAS.ventas,
    {
      Fecha: fechaPlanilla(fechaISO(ahora)),
      "ID venta": idCorto("V", ahora),
      Negocio: v.negocio,
      Canal: v.canal,
      "Producto/servicio": v.producto,
      Cantidad: v.cantidad,
      "Precio unitario": v.precioUnitario,
      "Descuento total": v.descuento ?? 0,
      "Ingreso bruto": bruto, // si la planilla tiene fórmula aquí, el conector no la pisa
      "Estado de pago": v.estadoPago ?? "Pagado",
      "Medio de pago": v.medioPago,
      Observaciones: v.observaciones ? `${v.observaciones} · WhatsApp` : "WhatsApp",
    },
    `Venta ${v.negocio}: ${v.cantidad} × ${v.producto} a ${clp(v.precioUnitario)} = ${clp(bruto)}`,
  );
}

export interface GastoNegocio {
  negocio: Negocio;
  categoria: string;
  concepto: string;
  monto: number;
  tipo: "Fijo" | "Variable";
  proveedor?: string | null;
  medioPago?: string | null;
}

export function registrarGastoNegocio(s: ClienteSheets, g: GastoNegocio, ahora = new Date()) {
  return escribir(
    s,
    HOJAS.gastos,
    {
      Fecha: fechaPlanilla(fechaISO(ahora)),
      "ID gasto": idCorto("G", ahora),
      Negocio: g.negocio,
      "Categoría": g.categoria,
      Concepto: g.concepto,
      Proveedor: g.proveedor,
      Monto: g.monto,
      "Tipo (fijo/variable)": g.tipo,
      "Medio de pago": g.medioPago,
      Observaciones: "WhatsApp",
    },
    `Gasto ${g.negocio}: ${g.concepto} ${clp(g.monto)} (${g.categoria}, ${g.tipo.toLowerCase()})`,
  );
}

export interface Compra {
  negocio: Negocio;
  material: string;
  cantidad: number;
  unidad: string;
  costoTotal: number;
  proveedor?: string | null;
  medioPago?: string | null;
}

export function registrarCompra(s: ClienteSheets, c: Compra, ahora = new Date()) {
  return escribir(
    s,
    HOJAS.compras,
    {
      Fecha: fechaPlanilla(fechaISO(ahora)),
      "ID compra": idCorto("C", ahora),
      Negocio: c.negocio,
      "Descripción": c.material,
      Proveedor: c.proveedor,
      "Cantidad comprada": c.cantidad,
      Unidad: c.unidad,
      "Costo total compra": c.costoTotal,
      "Costo unitario": c.cantidad ? Math.round((c.costoTotal / c.cantidad) * 100) / 100 : null,
      "Medio de pago": c.medioPago,
      Observaciones: "WhatsApp",
    },
    `Compra ${c.negocio}: ${c.cantidad} ${c.unidad} de ${c.material} por ${clp(c.costoTotal)}`,
  );
}

export interface Proveedor {
  nombre: string;
  categoria: string;
  queVende: string;
  direccion?: string | null;
  comuna?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  web?: string | null;
  precioReferencia?: string | null;
  condiciones?: string | null;
  observaciones?: string | null;
}

export async function agregarProveedor(s: ClienteSheets, p: Proveedor, ahora = new Date()) {
  await s.asegurarColumnas(HOJAS.proveedores, COLUMNAS_NUEVAS_PROVEEDORES);
  return escribir(
    s,
    HOJAS.proveedores,
    {
      "ID proveedor": idCorto("P", ahora),
      Proveedor: p.nombre,
      "Categoría": p.categoria,
      Contacto: p.contacto,
      "WhatsApp/teléfono": p.telefono,
      Correo: p.correo,
      "Web/red social": p.web,
      Condiciones: p.condiciones,
      Observaciones: p.observaciones,
      "Dirección": p.direccion,
      Comuna: p.comuna,
      "Qué vende": p.queVende,
      "Precio de referencia": p.precioReferencia,
      "Fecha de registro": fechaPlanilla(fechaISO(ahora)),
    },
    `Proveedor: ${p.nombre} (${p.categoria}) · vende ${p.queVende}${p.comuna ? ` · ${p.comuna}` : ""}`,
  );
}

// ─────────────────────────── Lecturas ───────────────────────────

const aNumero = (v: unknown) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[$.\s]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Convierte "14-11-2026", "14/11/2026" o "2026-11-14" a "2026-11-14". */
export function fechaDesdePlanilla(v: unknown): string | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Tabla por títulos: [{Fecha: "...", Negocio: "..."}, ...] */
async function tabla(s: ClienteSheets, hoja: string) {
  const filas = await s.leer(`${hoja}!A1:Z2000`, "UNFORMATTED_VALUE");
  const [cab = [], ...resto] = filas;
  return resto.map((f) => Object.fromEntries(cab.map((t, i) => [t, f[i]])) as Record<string, unknown>);
}

export interface ResumenNegocio {
  negocio: string;
  ventas: number;
  gastos: number;
  compras: number;
  resultado: number;
  unidades: number;
}

/** Ventas, gastos y compras del mes por negocio (calculado desde las filas, no desde fórmulas). */
export async function resumenNegociosMes(s: ClienteSheets, ahora = new Date()) {
  const mes = fechaISO(ahora).slice(0, 7);
  const [ventas, gastos, compras] = await Promise.all([tabla(s, HOJAS.ventas), tabla(s, HOJAS.gastos), tabla(s, HOJAS.compras)]);
  const delMes = (f: Record<string, unknown>) => fechaDesdePlanilla(f.Fecha)?.startsWith(mes) ?? false;
  const por = new Map<string, ResumenNegocio>(NEGOCIOS.map((n) => [n, { negocio: n, ventas: 0, gastos: 0, compras: 0, resultado: 0, unidades: 0 }]));
  const de = (n: unknown) => por.get(String(n ?? "")) ?? null;
  for (const v of ventas.filter(delMes)) {
    const r = de(v.Negocio);
    if (!r) continue;
    const bruto = aNumero(v["Ingreso bruto"]) || aNumero(v.Cantidad) * aNumero(v["Precio unitario"]) - aNumero(v["Descuento total"]);
    r.ventas += bruto;
    r.unidades += aNumero(v.Cantidad);
  }
  for (const g of gastos.filter(delMes)) {
    const r = de(g.Negocio);
    if (r) r.gastos += aNumero(g.Monto);
  }
  for (const c of compras.filter(delMes)) {
    const r = de(c.Negocio);
    if (r) r.compras += aNumero(c["Costo total compra"]);
  }
  const lista = [...por.values()].map((r) => ({ ...r, resultado: r.ventas - r.gastos - r.compras }));
  return { mes, negocios: lista, total: lista.reduce((a, r) => ({ ventas: a.ventas + r.ventas, gastos: a.gastos + r.gastos + r.compras }), { ventas: 0, gastos: 0 }) };
}

export async function buscarProveedores(s: ClienteSheets, filtro?: string | null) {
  const filas = (await tabla(s, HOJAS.proveedores)).filter((p) => p.Proveedor);
  const f = (filtro ?? "").toLowerCase();
  return filas
    .filter((p) => !f || Object.values(p).some((v) => String(v ?? "").toLowerCase().includes(f)))
    .slice(0, 10)
    .map((p) => `• ${p.Proveedor} (${p["Categoría"] ?? "?"})${p["Qué vende"] ? ` · ${p["Qué vende"]}` : ""}${p.Comuna ? ` · ${p.Comuna}` : ""}${p["WhatsApp/teléfono"] ? ` · ${p["WhatsApp/teléfono"]}` : ""}`);
}

export async function stockBajo(s: ClienteSheets) {
  const filas = (await tabla(s, HOJAS.inventario)).filter((p) => p["Producto/material"]);
  return filas
    .filter((p) => aNumero(p["Stock mínimo"]) > 0 && aNumero(p["Stock actual"]) <= aNumero(p["Stock mínimo"]))
    .map((p) => `• ${p["Producto/material"]} (${p.Negocio}): quedan ${aNumero(p["Stock actual"])} ${p.Unidad ?? ""}, mínimo ${aNumero(p["Stock mínimo"])}`);
}
