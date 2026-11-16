export const ZONA_DEFECTO = "America/Santiago";

export const hoyISO = (zona = ZONA_DEFECTO, d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const fechaCorta = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export const fechaLarga = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export const hora = (isoConZona: string, zona = ZONA_DEFECTO) =>
  new Date(isoConZona).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona });

export const diaDe = (isoConZona: string, zona = ZONA_DEFECTO) => hoyISO(zona, new Date(isoConZona));

export const fechaHora = (iso: string, zona = ZONA_DEFECTO) =>
  new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona });

/** Desfase en minutos de una zona horaria en un instante (cambia con el horario de verano). */
export function desfaseMinutos(zona: string, instante: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(instante)
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  const comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return Math.round((comoUTC - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

/** Fecha + hora de un formulario (hora local de la zona) → ISO con desfase, ej. 2026-11-20T16:00:00-03:00 */
export function aISOConZona(fecha: string, horaLocal: string, zona = ZONA_DEFECTO): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, min] = horaLocal.split(":").map(Number);
  const desfase = desfaseMinutos(zona, new Date(Date.UTC(a, m - 1, d, h, min)));
  const signo = desfase >= 0 ? "+" : "-";
  const abs = Math.abs(desfase);
  return `${fecha}T${horaLocal}:00${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export const saludo = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
};
