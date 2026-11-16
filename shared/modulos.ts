// Registro único de módulos y widgets. Lo usan la app (menú, rutas, dashboard) y la API
// (valores por defecto, validaciones). Agregar un módulo = agregar una entrada aquí.

export type Area = "personal" | "salud" | "salud_intima" | "finanzas" | "trabajo";
export const AREAS: Area[] = ["personal", "salud", "salud_intima", "finanzas", "trabajo"];
export const NOMBRE_AREA: Record<Area, string> = {
  personal: "Personal",
  salud: "Salud",
  salud_intima: "Salud íntima",
  finanzas: "Finanzas",
  trabajo: "Trabajo",
};

export type Canal = "web" | "whatsapp" | "ia";
export const CANALES_EXTERNOS: Exclude<Canal, "web">[] = ["whatsapp", "ia"];

export interface Modulo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  area: Area;
  /** Fase del plan en que queda construido. Si es mayor que FASE_ACTUAL, se muestra "en construcción". */
  fase: number;
  /** Opcional: no se activa por defecto para no sobrecargar. */
  opcional: boolean;
  ruta: string;
}

export const FASE_ACTUAL = 1;

export const MODULOS: Modulo[] = [
  { id: "agenda", nombre: "Agenda", descripcion: "Eventos, recordatorios y bloques de tiempo", icono: "calendario", area: "personal", fase: 1, opcional: false, ruta: "/agenda" },
  { id: "tareas", nombre: "Tareas", descripcion: "Pendientes con prioridad, fecha y área", icono: "check", area: "personal", fase: 1, opcional: false, ruta: "/tareas" },
  { id: "bienestar", nombre: "Bienestar", descripcion: "Agua, ánimo, energía y sueño de cada día", icono: "gota", area: "personal", fase: 1, opcional: false, ruta: "/bienestar" },
  { id: "salud", nombre: "Salud", descripcion: "Condiciones, síntomas, dolor, medicamentos e informes PDF", icono: "corazon", area: "salud", fase: 2, opcional: true, ruta: "/salud" },
  { id: "ciclo", nombre: "Ciclo menstrual", descripcion: "Calendario, sangrado, síntomas y estimaciones", icono: "luna", area: "salud", fase: 2, opcional: true, ruta: "/ciclo" },
  { id: "intimo", nombre: "Registro íntimo", descripcion: "Anticoncepción y relaciones. Privado, con controles propios", icono: "candado", area: "salud_intima", fase: 2, opcional: true, ruta: "/intimo" },
  { id: "finanzas", nombre: "Finanzas", descripcion: "Cuentas, gastos, presupuestos, deudas y metas de ahorro", icono: "billetera", area: "finanzas", fase: 3, opcional: false, ruta: "/finanzas" },
  { id: "habitos", nombre: "Hábitos", descripcion: "Hábitos con frecuencia, horarios y rachas", icono: "racha", area: "personal", fase: 4, opcional: false, ruta: "/habitos" },
  { id: "movimiento", nombre: "Movimiento", descripcion: "Gimnasio, movilidad, cardio y caminatas", icono: "pesa", area: "personal", fase: 5, opcional: true, ruta: "/movimiento" },
  { id: "alimentacion", nombre: "Alimentación", descripcion: "Diario de comidas, agua, fotos y calendario de objetivos", icono: "plato", area: "personal", fase: 5, opcional: true, ruta: "/alimentacion" },
  { id: "trabajo", nombre: "Trabajo", descripcion: "Áreas, clientes, proyectos, tareas y documentos (incluye Notion)", icono: "maletin", area: "trabajo", fase: 6, opcional: false, ruta: "/trabajo" },
  { id: "aprendizaje", nombre: "Aprendizaje", descripcion: "Libros, cursos, objetivos y tiempo de estudio", icono: "libro", area: "personal", fase: 6, opcional: true, ruta: "/aprendizaje" },
  { id: "diario", nombre: "Diario", descripcion: "Texto, voz, fotos, emociones y búsqueda", icono: "pluma", area: "personal", fase: 6, opcional: true, ruta: "/diario" },
  { id: "asistente", nombre: "Asistente", descripcion: "Registrar y consultar con lenguaje natural (web y WhatsApp)", icono: "chispa", area: "personal", fase: 7, opcional: false, ruta: "/asistente" },
];

export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);
export const disponible = (m: Modulo) => m.fase <= FASE_ACTUAL;

export interface Widget {
  id: string;
  nombre: string;
  /** Módulo del que depende: si el módulo está apagado, el widget no aparece. */
  modulo: string | null;
  tamano: "chico" | "mediano" | "grande";
}

export const WIDGETS: Widget[] = [
  { id: "resumen", nombre: "Resumen del día", modulo: null, tamano: "grande" },
  { id: "accesos_rapidos", nombre: "Registro rápido", modulo: null, tamano: "mediano" },
  { id: "bienestar", nombre: "Bienestar", modulo: "bienestar", tamano: "mediano" },
  { id: "tareas", nombre: "Tareas pendientes", modulo: "tareas", tamano: "mediano" },
  { id: "agenda", nombre: "Agenda", modulo: "agenda", tamano: "mediano" },
  { id: "estadisticas", nombre: "Estadísticas de la semana", modulo: "bienestar", tamano: "grande" },
  { id: "habitos", nombre: "Hábitos", modulo: "habitos", tamano: "mediano" },
  { id: "finanzas", nombre: "Finanzas", modulo: "finanzas", tamano: "mediano" },
  { id: "movimiento", nombre: "Movimiento", modulo: "movimiento", tamano: "mediano" },
  { id: "alimentacion", nombre: "Alimentación", modulo: "alimentacion", tamano: "mediano" },
  { id: "proyectos", nombre: "Proyectos activos", modulo: "trabajo", tamano: "mediano" },
  { id: "asistente", nombre: "Asistente", modulo: "asistente", tamano: "mediano" },
];

/** Permisos iniciales para canales externos: privacidad por defecto (salud apagada). */
export const ACCESOS_INICIALES: { canal: Exclude<Canal, "web">; area: Area; lectura: boolean; escritura: boolean }[] =
  CANALES_EXTERNOS.flatMap((canal) =>
    AREAS.map((area) => ({
      canal,
      area,
      lectura: area === "personal" || area === "finanzas" || area === "trabajo",
      escritura: area === "personal" || area === "finanzas" || area === "trabajo",
    })),
  );

export interface ConfigModulo { modulo: string; activo: boolean; orden: number; config: Record<string, unknown> }
export interface ConfigWidget { widget: string; visible: boolean; orden: number; tamano: Widget["tamano"]; config: Record<string, unknown> }

/** Completa la configuración guardada con los módulos y widgets nuevos (para cuentas creadas antes). */
export function completarModulos(guardados: ConfigModulo[]): ConfigModulo[] {
  const por = new Map(guardados.map((g) => [g.modulo, g]));
  // Los que nunca se configuraron van después de los configurados (orden 100+).
  return MODULOS.map((m, i) => por.get(m.id) ?? { modulo: m.id, activo: !m.opcional, orden: 100 + i, config: {} }).sort((a, b) => a.orden - b.orden);
}

export function completarWidgets(guardados: ConfigWidget[]): ConfigWidget[] {
  const por = new Map(guardados.map((g) => [g.widget, g]));
  return WIDGETS.map((w, i) => por.get(w.id) ?? { widget: w.id, visible: true, orden: 100 + i, tamano: w.tamano, config: {} }).sort((a, b) => a.orden - b.orden);
}

/** Widgets que se muestran: visibles y con su módulo activo y disponible. */
export function widgetsVisibles(widgets: ConfigWidget[], modulos: ConfigModulo[]): ConfigWidget[] {
  const activos = new Set(modulos.filter((m) => m.activo).map((m) => m.modulo));
  return widgets.filter((w) => {
    if (!w.visible) return false;
    const def = WIDGETS.find((x) => x.id === w.widget);
    if (!def) return false;
    if (!def.modulo) return true;
    const mod = moduloPorId(def.modulo);
    return activos.has(def.modulo) && !!mod;
  });
}

/** Mueve un elemento una posición y renumera el orden. */
export function mover<T extends { orden: number }>(lista: T[], indice: number, direccion: -1 | 1): T[] {
  const copia = [...lista].sort((a, b) => a.orden - b.orden);
  const destino = indice + direccion;
  if (destino < 0 || destino >= copia.length) return copia;
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia.map((x, i) => ({ ...x, orden: i }));
}
