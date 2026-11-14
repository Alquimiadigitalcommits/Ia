"use strict";

// ─────────────────────────── Íconos (trazo simple) ───────────────────────────
const ICONOS = {
  inicio: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  corazon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tienda: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  nota: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>',
  salir: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  medicamento: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.2 9.2l5.6 5.6"/>',
  kine: '<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 7M12 13l3 7M7 10h10"/>',
  ejercicio: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  fecha: '<path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1 6L12 16.8 6.8 19.5l1-6L3.4 9.3l6-.8z"/>',
  libro: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/>',
};
const icono = (n) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] ?? ""}</svg>`;

const FORMAS = {
  gota: '<path d="M50 5C50 5 15 45 15 65a35 35 0 0 0 70 0C85 45 50 5 50 5z"/>',
  corazon: '<path d="M50 88S8 62 8 34a21 21 0 0 1 42-6 21 21 0 0 1 42 6c0 28-42 54-42 54z"/>',
  triangulo: '<path d="M10 15h80L50 92z"/>',
  estrella: '<path d="M50 4l9 25 26-9-15 23 23 15-27 3 2 27-18-20-18 20 2-27-27-3 23-15-15-23 26 9z"/>',
};
document.querySelectorAll("[data-forma]").forEach((el) => {
  el.innerHTML = `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">${FORMAS[el.dataset.forma]}</svg>`;
});
document.querySelectorAll("[data-icono]").forEach((el) => el.insertAdjacentHTML("afterbegin", icono(el.dataset.icono)));

// ─────────────────────────── Utilidades ───────────────────────────
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const fechaLarga = (iso, op) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", op);
const sumarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DSEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const CARITAS = { 1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };
const HUMOR_TXT = { 1: "Muy bajo", 2: "Bajo", 3: "Normal", 4: "Bien", 5: "Muy bien" };

const params = new URLSearchParams(location.search);
const modoDemo = params.has("demo");
let datos = null;
let mesVisible = null;

// ─────────────────────────── Datos de ejemplo ───────────────────────────
function datosDemo() {
  const hoy = new Date().toLocaleDateString("en-CA");
  const semana = [6, 7, 5, 8, 4, 7, 4].map((agua, i) => {
    const f = sumarDias(hoy, i - 6);
    return { fecha: f, dia: DSEM[new Date(`${f}T12:00:00Z`).getUTCDay()], agua, humor: [3, 4, 2, 4, 5, 3, 4][i], ejercicio: [30, 0, 45, 20, 0, 60, 15][i], lectura: [20, 10, 0, 30, 15, 25, 10][i], kine: [true, false, true, true, false, true, false][i], sueno: 7 };
  });
  const inicioCiclo = sumarDias(hoy, -11);
  const proximo = sumarDias(inicioCiclo, 29);
  return {
    hoy, nombre: "", generado: new Date().toISOString(),
    agua: { ...semana[6], metaAgua: 8, humorTexto: "4 Bien", energia: "Media" },
    semana,
    eventos: [
      { hora: "08:00", titulo: "Vitamina D", detalle: "1 cápsula", tipo: "medicamento" },
      { hora: "09:30", titulo: "Puente de glúteos", detalle: "3 x 12 · 10 min", tipo: "kine" },
      { hora: "13:00", titulo: "Hierro", detalle: "1 comprimido con almuerzo", tipo: "medicamento" },
      { hora: "19:00", titulo: "Caminata", detalle: "30 min", tipo: "ejercicio" },
      { hora: "21:30", titulo: "Magnesio", detalle: "200 mg", tipo: "medicamento" },
    ],
    medicamentosHoy: [
      { nombre: "Vitamina D", dosis: "1 cápsula", horas: ["08:00"], stock: 24, paraQue: "Déficit" },
      { nombre: "Hierro", dosis: "1 comprimido", horas: ["13:00"], stock: 6, paraQue: "Anemia" },
      { nombre: "Magnesio", dosis: "200 mg", horas: ["21:30"], stock: 40, paraQue: "Sueño" },
    ],
    planHoy: [
      { nombre: "Puente de glúteos", tipo: "Kinesiología", hora: "09:30", detalle: "3 x 12 · 10 min" },
      { nombre: "Elongación lumbar", tipo: "Kinesiología", hora: "09:45", detalle: "5 min" },
      { nombre: "Caminata", tipo: "Ejercicio", hora: "19:00", detalle: "30 min" },
    ],
    fechas: [
      { evento: "Entrega Plasok", fecha: sumarDias(hoy, 6), tipo: "Entrega", dias: 6, hora: "" },
      { evento: "Pago arriendo", fecha: sumarDias(hoy, 9), tipo: "Pago", dias: 9, hora: "" },
      { evento: "Control kinesiología", fecha: sumarDias(hoy, 3), tipo: "Cita médica", dias: 3, hora: "16:00" },
      { evento: "Cumpleaños mamá", fecha: sumarDias(hoy, 17), tipo: "Cumpleaños", dias: 17, hora: "" },
    ].sort((a, b) => a.dias - b.dias),
    ciclo: {
      ultimoInicio: inicioCiclo, duracionPromedio: 29, registros: 4, diaDelCiclo: 12, enPeriodo: false,
      proximoInicio: proximo, diasParaProximo: 18,
      diasPeriodo: [0, 1, 2, 3, 4].map((i) => sumarDias(inicioCiclo, i)),
      diasProximo: [0, 1, 2, 3, 4].map((i) => sumarDias(proximo, i)),
    },
    finanzas: {
      personal: { mes: hoy.slice(0, 7), gastos: 412500, ingresos: 950000, ahorro: 100000, balance: 437500, movimientos: 38,
        porCategoria: [{ categoria: "Arriendo", monto: 250000 }, { categoria: "Supermercado", monto: 68400 }, { categoria: "Transporte", monto: 41200 }, { categoria: "Comida", monto: 32900 }, { categoria: "Suscripciones", monto: 20000 }] },
      negocios: { mes: hoy.slice(0, 7), negocios: [
        { negocio: "Detalles", ventas: 186000, gastos: 12000, compras: 54000, resultado: 120000, unidades: 23 },
        { negocio: "Ropa", ventas: 98000, gastos: 5000, compras: 60000, resultado: 33000, unidades: 7 },
        { negocio: "Etsy", ventas: 41000, gastos: 6200, compras: 9000, resultado: 25800, unidades: 3 },
        { negocio: "Alquimia Digital", ventas: 450000, gastos: 35000, compras: 0, resultado: 415000, unidades: 2 },
        { negocio: "Calzado", ventas: 0, gastos: 0, compras: 0, resultado: 0, unidades: 0 },
        { negocio: "Dropshipping", ventas: 0, gastos: 8000, compras: 0, resultado: -8000, unidades: 0 },
      ] },
    },
    lecturas: [{ libro: "Hábitos atómicos", autor: "James Clear", pagina: 142, total: 328 }],
    proyectos: [
      { nombre: "Lanzamiento YouTube Plasok", estado: "En curso" },
      { nombre: "Guiones mes 1 · Sabor a Semilla", estado: "En revisión" },
      { nombre: "Tienda Etsy", estado: "Por empezar" },
    ],
  };
}

// ─────────────────────────── Carga ───────────────────────────
async function cargar() {
  if (modoDemo) return pintar(datosDemo());
  const clave = leer("clave-mi-dia");
  if (!clave) return pedirClave();
  try {
    const res = await fetch("/api/resumen", { headers: { "x-clave": clave } });
    if (res.status === 401) { guardar("clave-mi-dia", null); return pedirClave("Clave incorrecta."); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
    pintar(await res.json());
  } catch (e) {
    $("#resumen-texto").textContent = `No pude cargar tus datos: ${e.message}`;
  }
}

function pedirClave(error) {
  const dlg = $("#acceso");
  $("#acceso-error").hidden = !error;
  $("#acceso-error").textContent = error ?? "";
  if (!dlg.open) dlg.showModal();
}
$("#acceso-form").addEventListener("submit", () => { guardar("clave-mi-dia", $("#clave").value); cargar(); });
$("#salir").addEventListener("click", () => { guardar("clave-mi-dia", null); location.href = "./"; });

async function registrar(cuerpo, aplicarLocal) {
  aplicarLocal(datos);
  pintar(datos);
  if (modoDemo) return;
  const res = await fetch("/api/registrar", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-clave": leer("clave-mi-dia") ?? "" },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (!res?.ok) $("#resumen-texto").textContent = "No se guardó el último cambio. Revisa la conexión.";
}

// ─────────────────────────── Pintar ───────────────────────────
function pintar(d) {
  datos = d;
  mesVisible ??= d.hoy.slice(0, 7);
  $("#aviso-demo").hidden = !modoDemo;
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  $("#titulo").textContent = d.nombre ? `${saludo}, ${d.nombre}` : saludo;

  const meds = d.eventos.filter((e) => e.tipo === "medicamento").length;
  const kine = d.planHoy.filter((p) => p.tipo === "Kinesiología").length;
  const partes = [`Llevas ${d.agua.agua} de ${d.agua.metaAgua} vasos de agua`];
  if (meds) partes.push(`${meds} toma${meds > 1 ? "s" : ""} de medicamentos`);
  if (kine) partes.push(`${kine} ejercicio${kine > 1 ? "s" : ""} de kine`);
  if (d.fechas[0]) partes.push(`${d.fechas[0].evento} ${d.fechas[0].dias === 0 ? "es hoy" : `en ${d.fechas[0].dias} días`}`);
  $("#resumen-texto").textContent = `${partes.join(" · ")}.`;
  $("#fecha-hoy").textContent = fechaLarga(d.hoy, { weekday: "long", day: "numeric", month: "long" });

  pintarAgua(d); pintarHumor(d); pintarMovimiento(d); pintarLectura(d);
  pintarFinanzas(d); pintarMedicamentos(d); pintarCiclo(d); pintarFechas(d); pintarProyectos(d);
  pintarCalendario(d); pintarLineaTiempo(d);
}

const cifra = (valor, rotulo, destacada) => `<div class="cifra${destacada ? " destacada" : ""}"><b>${valor}</b><span>${rotulo}</span></div>`;

function pintarAgua(d) {
  const prom = d.semana.reduce((a, s) => a + s.agua, 0) / 7;
  const cumplidos = d.semana.filter((s) => s.agua >= d.agua.metaAgua).length;
  $("#agua-cifras").innerHTML =
    cifra(`${d.agua.agua}/${d.agua.metaAgua}`, "vasos hoy", true) + cifra(prom.toFixed(1), "promedio 7 días") + cifra(`${cumplidos}/7`, "días con meta");
  const max = Math.max(d.agua.metaAgua, ...d.semana.map((s) => s.agua)) || 8;
  const W = 280, H = 120, ancho = 14, paso = W / 7;
  const barras = d.semana.map((s, i) => {
    const x = i * paso + paso / 2 - ancho / 2;
    const h = Math.max(4, (s.agua / max) * (H - 26));
    const y = H - 20 - h;
    const vacia = s.agua === 0;
    return `<rect x="${x}" y="${vacia ? H - 20 - (H - 26) * 0.5 : y}" width="${ancho}" height="${vacia ? (H - 26) * 0.5 : h}" rx="7"
      fill="${vacia ? "none" : "#141414"}" stroke="#141414" stroke-dasharray="${vacia ? "3 3" : "0"}" opacity="${i === 6 ? 1 : 0.85}"/>
      <text x="${i * paso + paso / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="rgba(20,20,20,.65)">${s.dia}</text>`;
  });
  const yMeta = H - 20 - (d.agua.metaAgua / max) * (H - 26);
  $("#agua-grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vasos de agua por día, últimos 7 días">
    <line x1="0" x2="${W}" y1="${yMeta}" y2="${yMeta}" stroke="#141414" stroke-dasharray="2 4" opacity=".4"/>${barras.join("")}</svg>`;
}

function curva(puntos) {
  let d = "";
  puntos.forEach((p, i) => {
    if (!p) return;
    const prev = puntos[i - 1];
    if (!prev) { d += `M${p.x},${p.y}`; return; }
    const cx = (prev.x + p.x) / 2;
    d += ` C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  });
  return d;
}

function pintarHumor(d) {
  $("#humor-botones").innerHTML = [1, 2, 3, 4, 5]
    .map((v) => `<button class="chip-btn" data-humor="${v}" aria-pressed="${d.agua.humor === v}" aria-label="Humor ${HUMOR_TXT[v]}">${CARITAS[v]}</button>`)
    .join("");
  const vals = d.semana.map((s) => s.humor).filter((v) => v != null);
  const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const sueno = d.semana.map((s) => s.sueno).filter((v) => v != null);
  $("#humor-cifras").innerHTML =
    cifra(d.agua.humor ? `${CARITAS[d.agua.humor]} ${HUMOR_TXT[d.agua.humor]}` : "Sin registro", "hoy", true) +
    cifra(prom ? prom.toFixed(1) + " / 5" : "—", "promedio 7 días") +
    cifra(sueno.length ? (sueno.reduce((a, b) => a + b, 0) / sueno.length).toFixed(1) + " h" : "—", "sueño promedio");
  const W = 420, H = 120;
  const pts = d.semana.map((s, i) => (s.humor == null ? null : { x: 12 + (i * (W - 24)) / 6, y: 10 + (5 - s.humor) * ((H - 36) / 4) }));
  const ult = pts[6];
  $("#humor-grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Humor de los últimos 7 días, escala 1 a 5">
    <path d="${curva(pts)}" fill="none" stroke="#141414" stroke-width="2"/>
    ${ult ? `<line x1="${ult.x}" x2="${ult.x}" y1="${ult.y}" y2="${H - 18}" stroke="#141414" stroke-dasharray="3 3"/><circle cx="${ult.x}" cy="${ult.y}" r="5" fill="#141414"/>` : ""}
    ${d.semana.map((s, i) => `<text x="${12 + (i * (W - 24)) / 6}" y="${H - 2}" text-anchor="middle" font-size="10" font-weight="${i === 6 ? 700 : 400}" fill="rgba(20,20,20,.65)">${s.dia}</text>`).join("")}
  </svg>`;
}

function pintarMovimiento(d) {
  const minSemana = d.semana.reduce((a, s) => a + s.ejercicio, 0);
  const diasKine = d.semana.filter((s) => s.kine).length;
  $("#mov-cifras").innerHTML = cifra(`${d.agua.ejercicio} min`, "hoy", true) + cifra(`${minSemana} min`, "7 días") + cifra(`${diasKine}/7`, "días con kine");
  $("#kine-btn").setAttribute("aria-pressed", String(Boolean(d.agua.kine)));
  $("#kine-btn").textContent = d.agua.kine ? "Kine hecha ✓" : "Marcar kine";
  $("#plan-hoy").innerHTML = d.planHoy.length
    ? d.planHoy.map((p) => `<li><span>${esc(p.nombre)}</span><small>${[p.hora, p.detalle].filter(Boolean).map(esc).join(" · ")}</small></li>`).join("")
    : "<li><span>Sin rutina para hoy</span></li>";
}

function pintarLectura(d) {
  const minSemana = d.semana.reduce((a, s) => a + s.lectura, 0);
  $("#lectura-cifras").innerHTML = cifra(`${d.agua.lectura} min`, "hoy", true) + cifra(`${minSemana} min`, "7 días") + cifra(String(d.lecturas.length), "leyendo");
  $("#libros").innerHTML = d.lecturas.length
    ? d.lecturas.map((l) => {
        const pct = l.total ? Math.round((l.pagina / l.total) * 100) : 0;
        return `<div class="libro"><div><b>${esc(l.libro)}</b> <small>${esc(l.autor)}</small></div>
          <div class="barra"><i style="width:${pct}%"></i></div><small>Página ${l.pagina} de ${l.total || "?"} · ${pct}%</small></div>`;
      }).join("")
    : "<p class='sub'>Agrega un libro con estado Leyendo en Notion.</p>";
}

const clp = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("es-CL");

function pintarFinanzas(d) {
  const p = d.finanzas?.personal;
  const n = d.finanzas?.negocios;
  $("#fin-mes").textContent = p?.mes ? fechaLarga(`${p.mes}-01`, { month: "long", year: "numeric" }) : "";
  if (!p) {
    $("#fin-personal").innerHTML = '<p class="pista-texto">Falta NOTION_DB_FINANZAS_PERSONALES en la configuración.</p>';
  } else if (p.error) {
    $("#fin-personal").innerHTML = `<p class="pista-texto">No se pudo leer: ${esc(p.error)}</p>`;
  } else {
    const max = Math.max(1, ...p.porCategoria.map((c) => c.monto));
    $("#fin-personal").innerHTML = `
      <div class="cifras">${cifra(clp(p.gastos), "gastos del mes", true)}${cifra(clp(p.ingresos), "ingresos")}${cifra(clp(p.balance), "balance")}</div>
      <div class="barras-h">${p.porCategoria.slice(0, 5).map((c) => `<div class="barra-h"><span>${esc(c.categoria)}</span><span class="pista"><i style="width:${(c.monto / max) * 100}%"></i></span><b>${clp(c.monto)}</b></div>`).join("") || '<p class="pista-texto">Sin gastos este mes.</p>'}</div>`;
  }
  if (!n) {
    $("#fin-negocios").innerHTML = '<p class="pista-texto">La planilla de negocios no está conectada. <a href="configurar.html">Conectarla</a>.</p>';
  } else if (n.error) {
    $("#fin-negocios").innerHTML = `<p class="pista-texto">No se pudo leer la planilla: ${esc(n.error)}</p>`;
  } else {
    const filas = n.negocios.filter((x) => x.ventas || x.gastos || x.compras);
    const tot = filas.reduce((a, x) => ({ v: a.v + x.ventas, g: a.g + x.gastos + x.compras, r: a.r + x.resultado }), { v: 0, g: 0, r: 0 });
    $("#fin-negocios").innerHTML = filas.length
      ? `<table class="tabla-negocios"><thead><tr><th>Negocio</th><th>Ventas</th><th>Costos</th><th>Resultado</th></tr></thead><tbody>
        ${filas.map((x) => `<tr><td>${esc(x.negocio)}</td><td>${clp(x.ventas)}</td><td>${clp(x.gastos + x.compras)}</td><td class="${x.resultado < 0 ? "neg" : ""}">${clp(x.resultado)}</td></tr>`).join("")}
        <tr class="total"><td>Total</td><td>${clp(tot.v)}</td><td>${clp(tot.g)}</td><td class="${tot.r < 0 ? "neg" : ""}">${clp(tot.r)}</td></tr></tbody></table>`
      : '<p class="pista-texto">Sin movimientos este mes.</p>';
  }
}

function pintarMedicamentos(d) {
  const ahora = new Date().toTimeString().slice(0, 5);
  $("#medicamentos").innerHTML = d.medicamentosHoy.length
    ? d.medicamentosHoy.map((m) => {
        const pocas = m.stock != null && m.stock <= 7;
        return `<li class="fila"><span class="icono-circulo medicamento">${icono("medicamento")}</span>
          <div class="fila-texto"><b>${esc(m.nombre)}</b><small>${esc(m.dosis)}${m.paraQue ? " · " + esc(m.paraQue) : ""}${pocas ? ` · quedan ${m.stock}` : ""}</small></div>
          ${m.horas.map((h) => `<span class="hora-chip ${h < ahora ? "" : "rosa"}">${h}</span>`).join("")}</li>`;
      }).join("")
    : '<li class="vacio">No hay medicamentos para hoy.</li>';
}

function pintarCiclo(d) {
  const c = d.ciclo;
  if (!c) { $("#ciclo").innerHTML = '<p class="sub">Registra el inicio de tu periodo en la base Ciclo de Notion.</p>'; return; }
  const total = c.duracionPromedio;
  const periodo = c.diasPeriodo.length;
  const ruedita = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const clase = n === c.diaDelCiclo ? "h" : n <= periodo ? "p" : "";
    return `<i class="${clase}" title="Día ${n}"></i>`;
  }).join("");
  $("#ciclo").innerHTML = `
    <div class="cifras">${cifra(`Día ${c.diaDelCiclo}`, c.enPeriodo ? "con periodo" : "del ciclo", true)}${cifra(`${c.diasParaProximo} días`, "para el próximo")}${cifra(`${total} días`, "ciclo promedio")}</div>
    <div class="ruedita" aria-label="Día ${c.diaDelCiclo} de un ciclo de ${total} días">${ruedita}</div>
    <p class="nota">Próximo inicio estimado: ${fechaLarga(c.proximoInicio, { day: "numeric", month: "long" })}. Calculado con ${c.registros} registro${c.registros > 1 ? "s" : ""}.</p>`;
}

const CHIP_TIPO = { "Cita médica": "", Pago: "rosa", Cumpleaños: "rosa", Entrega: "amarillo", Negocio: "verde" };
function pintarFechas(d) {
  $("#fechas").innerHTML = d.fechas.length
    ? d.fechas.slice(0, 6).map((f) => `<li class="fila"><span class="icono-circulo fecha">${icono("fecha")}</span>
        <div class="fila-texto"><b>${esc(f.evento)}</b><small>${esc(f.tipo)} · ${fechaLarga(f.fecha, { weekday: "short", day: "numeric", month: "short" })}${f.hora ? " · " + f.hora : ""}</small></div>
        <span class="hora-chip ${CHIP_TIPO[f.tipo] ?? ""}">${f.dias === 0 ? "Hoy" : f.dias === 1 ? "Mañana" : `${f.dias} días`}</span></li>`).join("")
    : '<li class="vacio">Sin fechas próximas.</li>';
}

function pintarProyectos(d) {
  const lista = d.proyectos ?? [];
  $("#proyectos").innerHTML = `
    <div class="tarjeta-cab"><b>${lista.length} proyecto${lista.length === 1 ? "" : "s"}</b></div>
    <div class="etiquetas">${[...new Set(lista.map((p) => p.estado).filter(Boolean))].map((e) => `<span class="etiqueta">${esc(e)}</span>`).join("")}</div>
    <dl>${lista.slice(0, 6).map((p) => `<dt>${esc(p.estado || "—")}</dt><dd>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.nombre)}</a>` : esc(p.nombre)}</dd>`).join("") || "<dd>Conecta la base Proyectos (NOTION_DB_PROYECTOS).</dd>"}</dl>
`;
}

function pintarCalendario(d) {
  const [a, m] = mesVisible.split("-").map(Number);
  const nombreMes = new Date(a, m - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  $("#mes-nombre").textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const offset = (primero.getUTCDay() + 6) % 7; // semana empieza el lunes
  const inicio = sumarDias(primero.toISOString().slice(0, 10), -offset);
  const eventos = new Set(d.fechas.map((f) => f.fecha));
  const periodo = new Set(d.ciclo?.diasPeriodo ?? []);
  const estimado = new Set(d.ciclo?.diasProximo ?? []);
  let html = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((x) => `<span class="dsem">${x}</span>`).join("");
  for (let i = 0; i < 42; i++) {
    const f = sumarDias(inicio, i);
    const clases = ["cal-dia"];
    if (f.slice(0, 7) !== mesVisible) clases.push("fuera");
    if (periodo.has(f)) clases.push("periodo");
    if (estimado.has(f)) clases.push("estimado");
    if (eventos.has(f)) clases.push("evento");
    if (f === d.hoy) clases.push("hoy");
    html += `<span class="${clases.join(" ")}">${Number(f.slice(8))}</span>`;
  }
  $("#cal-grilla").innerHTML = html;
}
function moverMes(n) {
  const [a, m] = mesVisible.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  mesVisible = d.toISOString().slice(0, 7);
  pintarCalendario(datos);
}
$("#mes-ant").addEventListener("click", () => moverMes(-1));
$("#mes-sig").addEventListener("click", () => moverMes(1));

function pintarLineaTiempo(d) {
  const ahora = new Date().toTimeString().slice(0, 5);
  let marcado = false;
  const items = [];
  for (const e of d.eventos) {
    if (!marcado && e.hora !== "—" && e.hora > ahora) {
      items.push(`<li class="ahora"><span>${ahora}</span><hr></li>`);
      marcado = true;
    }
    const pasado = e.hora !== "—" && e.hora < ahora;
    items.push(`<li class="evento-dia${pasado ? " pasado" : ""}"><time>${e.hora}</time>
      <div class="evento-caja"><span class="icono-circulo ${e.tipo}">${icono(e.tipo)}</span>
      <div><b>${esc(e.titulo)}</b><small>${esc(e.detalle)}</small></div></div></li>`);
  }
  if (!marcado && d.eventos.length) items.push(`<li class="ahora"><span>${ahora}</span><hr></li>`);
  $("#linea-tiempo").innerHTML = items.join("") || '<li class="vacio">Nada agendado para hoy.</li>';
}

// ─────────────────────────── Registro rápido ───────────────────────────
document.addEventListener("click", (ev) => {
  const agua = ev.target.closest("[data-agua]");
  if (agua && datos) {
    const vasos = Number(agua.dataset.agua);
    if (datos.agua.agua + vasos < 0) return;
    return registrar({ tipo: "agua", vasos }, (d) => { d.agua.agua += vasos; d.semana[6].agua = d.agua.agua; });
  }
  const humor = ev.target.closest("[data-humor]");
  if (humor && datos) {
    const valor = Number(humor.dataset.humor);
    return registrar({ tipo: "humor", valor }, (d) => { d.agua.humor = valor; d.semana[6].humor = valor; });
  }
  if (ev.target.closest("#kine-btn") && datos) {
    const hecha = !datos.agua.kine;
    return registrar({ tipo: "kine", hecha }, (d) => { d.agua.kine = hecha; d.semana[6].kine = hecha; });
  }
});

cargar();
setInterval(() => { if (!document.hidden && datos) cargar(); }, 5 * 60 * 1000);
