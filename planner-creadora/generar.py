# -*- coding: utf-8 -*-
"""
Bitácora de Creadora — generador de todas las ediciones.

Cómo usarlo:
  python3 generar.py                 → genera las 8 versiones (4 nichos × mensual/trimestral)
  python3 generar.py gamer           → solo la edición gamer (mensual y trimestral)
  python3 generar.py gamer 1         → solo gamer mensual

Para cambiar textos de un nicho, edita su bloque en EDICIONES (más abajo).
El diseño está en estilos.css. Cada página es una función que devuelve HTML.
Los PDF quedan en la carpeta  salidas/
"""
import sys, subprocess, shutil
from pathlib import Path

MARCA = "ALQUIMIA DIGITAL"
NOMBRE_PRODUCTO = "Bitácora de Creadora"
SUBTITULO = "Hábitos · Contenido · Comunidad"
ABREV = {"Instagram": "IG", "TikTok": "TT", "YouTube": "YT", "Kick": "KK", "Twitch": "TW"}

# ═══════════════════════════ EDICIONES POR NICHO ═══════════════════════════
# acento = color principal de esa edición · icono = dibujo del centro de la portada
# registro = tabla especial de la pág. "… y conversaciones" (lives, productos o lugares)
LIVES = {
    "titulo": "Lives y conversaciones", "sub": "Lives y streams",
    "cab": ["Fecha", "Plat.", "Juego / tema", "Duración", "Pico", "Prom.", "Seg. +", "Subs / apoyos"],
    "anchos": ["10%", "8%", "24%", "11%", "9%", "9%", "11%", "18%"],
}
EDICIONES = {
    "general": {
        "nombre": "", "acento": "#6b4a73", "icono": "alquimia",
        "plataformas": ["Instagram", "TikTok", "YouTube", "Kick"],
        "habitos": ["Agua 2 L", "Skincare AM/PM", "Moverme 30 min", "Leer 10 págs",
                    "Grabar 1 pieza", "Responder comunidad", "Dormir 7 h", "Sin redes 1 h al despertar"],
        "pilares": ["Educar: lo que sé hacer", "Mostrar: mi día a día", "Conectar: opiniones y preguntas", "Vender: colaboraciones"],
        "registro": LIVES, "kpi_extra": ("Horas de live", "h"),
    },
    "gamer": {
        "nombre": "Edición Gamer", "acento": "#4b4486", "icono": "control",
        "plataformas": ["Kick", "YouTube", "TikTok", "Instagram"],
        "habitos": ["Stream en mi horario", "Subir 1 clip del live", "Pausa activa cada 2 h", "Agua durante el stream",
                    "Responder chat / Discord", "Estirar manos y espalda", "Dormir 7 h", "30 min de juego nuevo"],
        "pilares": ["Clips y momentos del live", "Gameplay con opinión", "Setup y detrás de cámara", "Comunidad y Discord"],
        "registro": LIVES, "kpi_extra": ("Horas de stream", "h"),
    },
    "skincare": {
        "nombre": "Edición Skincare", "acento": "#9a5468", "icono": "gotero",
        "plataformas": ["Instagram", "TikTok", "YouTube"],
        "habitos": ["Rutina AM", "Rutina PM", "Protector solar", "Agua 2 L",
                    "Foto de progreso de piel", "Grabar 1 reseña", "Leer 1 lista INCI", "Dormir 7 h"],
        "pilares": ["Rutinas reales", "Reseñas honestas", "Ingredientes explicados", "Antes y después"],
        "registro": {
            "titulo": "Productos y conversaciones", "sub": "Productos en prueba",
            "cab": ["Producto", "Marca", "Precio", "Tipo de piel", "Inicio", "Días", "Veredicto", "Pieza"],
            "anchos": ["21%", "13%", "10%", "13%", "9%", "7%", "15%", "12%"],
        },
        "kpi_extra": ("Productos reseñados", ""),
    },
    "panoramas": {
        "nombre": "Edición Panoramas", "acento": "#7d5f3a", "icono": "brujula",
        "plataformas": ["Instagram", "TikTok", "YouTube"],
        "habitos": ["Visitar 1 lugar nuevo", "Grabar b-roll del lugar", "Anotar precio y horario", "Caminar 30 min",
                    "Editar 1 pieza", "Responder recomendaciones", "Presupuesto al día", "Dormir 7 h"],
        "pilares": ["Panoramas gratis", "Datos con precio", "Rutas de fin de semana", "Recomendados por la comunidad"],
        "registro": {
            "titulo": "Lugares y conversaciones", "sub": "Lugares visitados",
            "cab": ["Fecha", "Lugar", "Comuna / ciudad", "Precio", "Horario", "Nota 1–5", "Pieza"],
            "anchos": ["10%", "24%", "18%", "11%", "13%", "10%", "14%"],
        },
        "kpi_extra": ("Lugares visitados", ""),
    },
}

# Estado de la edición que se está construyendo (lo llena construir())
ED = {}
MES = ""          # "Mes 1", "Mes 2"… en la edición trimestral
paginas = []

# ═══════════════════════════ PIEZAS DE DISEÑO ═══════════════════════════
def simbolo(tipo, size=18):
    """Símbolos alquímicos de los 4 elementos, dibujados con línea."""
    s = size
    tri_up = f'<path d="M{s/2} 2 L{s-2} {s-3} L2 {s-3} Z"/>'
    tri_dn = f'<path d="M2 3 L{s-2} 3 L{s/2} {s-2} Z"/>'
    barra_up = f'<line x1="{s*0.22}" y1="{s*0.62}" x2="{s*0.78}" y2="{s*0.62}"/>'
    barra_dn = f'<line x1="{s*0.22}" y1="{s*0.38}" x2="{s*0.78}" y2="{s*0.38}"/>'
    body = {"fuego": tri_up, "aire": tri_up + barra_up,
            "agua": tri_dn, "tierra": tri_dn + barra_dn}[tipo]
    return (f'<svg class="sym" width="{s}" height="{s}" viewBox="0 0 {s} {s}" fill="none" '
            f'stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">{body}</svg>')

def estrella(size=14):
    c = size / 2
    return (f'<svg class="star" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<path d="M{c} 0 Q{c*1.08} {c*0.92} {size} {c} Q{c*1.08} {c*1.08} {c} {size} '
            f'Q{c*0.92} {c*1.08} 0 {c} Q{c*0.92} {c*0.92} {c} 0Z" fill="currentColor"/></svg>')

def icono_portada(tipo):
    """Dibujo del centro del emblema (coordenadas del círculo central: centro 150,150)."""
    if tipo == "control":   # control de videojuego
        return ('<path d="M112 136 Q114 124 128 124 L172 124 Q186 124 188 136 L196 170 Q199 184 187 186 '
                'Q179 187 172 175 L166 166 L134 166 L128 175 Q121 187 113 186 Q101 184 104 170 Z"/>'
                '<path d="M126 141 v14 M119 148 h14"/><circle cx="170" cy="142" r="3"/><circle cx="178" cy="150" r="3"/>'
                '<circle cx="162" cy="150" r="3"/><circle cx="170" cy="158" r="3"/>'
                '<line x1="144" y1="137" x2="156" y2="137" stroke-dasharray="2 3"/>')
    if tipo == "gotero":    # frasco gotero + gota
        return ('<rect x="136" y="138" width="28" height="44" rx="7"/><path d="M141 138 v-8 h18 v8"/>'
                '<path d="M144 130 v-12 q0 -8 6 -8 q6 0 6 8 v12"/><line x1="141" y1="162" x2="159" y2="162"/>'
                '<path d="M182 120 q-7 10 -7 15 a7 7 0 0 0 14 0 q0 -5 -7 -15 Z"/>'
                '<path d="M118 150 q-5 7 -5 10 a5 5 0 0 0 10 0 q0 -3 -5 -10 Z"/>')
    if tipo == "brujula":   # brújula
        return ('<circle cx="150" cy="150" r="34"/><circle cx="150" cy="150" r="28" stroke-dasharray="1.5 4"/>'
                '<path d="M150 122 L157 150 L150 178 L143 150 Z"/><path d="M150 122 L157 150 L143 150 Z" fill="currentColor" fill-opacity=".25"/>'
                '<path d="M122 150 L150 145 L178 150 L150 155 Z"/><circle cx="150" cy="150" r="2.5" fill="currentColor"/>')
    # alquimia (edición general): estrella de dos triángulos
    return ('<path d="M150 92 L200 179 L100 179 Z"/><path d="M150 208 L100 121 L200 121 Z"/>'
            '<circle cx="150" cy="150" r="3" fill="currentColor"/>')

SECCIONES = {
    "inicio":    ("Inicio", "aire"),
    "habitos":   ("Hábitos", "fuego"),
    "contenido": ("Contenido", "agua"),
    "comunidad": ("Comunidad", "tierra"),
    "cierre":    ("Cierre", "aire"),
}

def pagina(seccion, kicker, titulo, cuerpo, intro=""):
    nombre, el = SECCIONES[seccion]
    n = len(paginas) + 1
    intro_html = f'<p class="intro">{intro}</p>' if intro else ""
    mes = f'<span class="mes-tag">{MES}</span>' if MES else ""
    pie = NOMBRE_PRODUCTO + (f" · {MES}" if MES else "")
    paginas.append(f'''
<section class="page">
  <div class="frame">
    <header class="top">
      <span class="brand">{MARCA}</span>
      <span class="sec">{mes}{simbolo(el, 14)} {nombre}</span>
    </header>
    <div class="title">
      <div class="kicker">{kicker}</div>
      <h1>{titulo}</h1>
      <div class="rule"><span></span>{estrella(10)}<span></span></div>
    </div>
    {intro_html}
    <main>{cuerpo}</main>
    <footer class="bottom"><span>{pie}</span><span class="num">{n:02d}</span></footer>
  </div>
</section>''')

def lineas(n, cls="ln"):
    return "".join(f'<div class="{cls}"></div>' for _ in range(n))

def campo(label, n=1, hint=""):
    h = f'<span class="hint">{hint}</span>' if hint else ""
    return f'<div class="campo"><div class="lab">{label}{h}</div>{lineas(n)}</div>'

def tabla(cabeceras, filas, anchos=None, cls="", alto=None):
    cols = "".join(f'<col style="width:{a}">' for a in anchos) if anchos else ""
    th = "".join(f"<th>{c}</th>" for c in cabeceras)
    style = f' style="--row:{alto}px"' if alto else ""
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in f) + "</tr>" for f in filas)
    return f'<table class="tbl {cls}"{style}><colgroup>{cols}</colgroup><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'

def vacias(n_filas, n_cols):
    return [[""] * n_cols for _ in range(n_filas)]

def plats():
    return ED["plataformas"]

# ═══════════════════════════ PORTADA ═══════════════════════════
def portada(trimestral):
    anillo = "".join(
        f'<g transform="rotate({i*30} 150 150)"><line x1="150" y1="18" x2="150" y2="30"/></g>' for i in range(12))
    elems = ""
    for i, el in enumerate(["fuego", "agua", "aire", "tierra"]):
        ang = [0, 90, 180, 270][i]
        elems += (f'<g transform="rotate({ang} 150 150) translate(141 46) rotate({-ang} 9 9)">'
                  f'{simbolo(el, 18)}</g>')
    edicion = ED["nombre"]
    formato = "Edición trimestral · 90 días" if trimestral else "Edición mensual"
    linea_ed = f'<div class="cover-ed">{edicion}</div>' if edicion else ""
    periodo = ('<div><span>Del</span><div class="ln"></div></div><div><span>Al</span><div class="ln"></div></div>'
               if trimestral else '<div><span>Mes</span><div class="ln"></div></div><div><span>Año</span><div class="ln"></div></div>')
    paginas.append(f'''
<section class="page cover">
  <div class="frame">
    <div class="cover-top">{MARCA}</div>
    <svg class="emblem" width="300" height="300" viewBox="0 0 300 300" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="150" cy="150" r="132"/><circle cx="150" cy="150" r="104" stroke-dasharray="2 5"/>
      <circle cx="150" cy="150" r="66"/>
      {anillo}{elems}
      <g class="ico">{icono_portada(ED["icono"])}</g>
    </svg>
    <h1 class="cover-title">{NOMBRE_PRODUCTO}</h1>
    {linea_ed}
    <div class="cover-sub">{SUBTITULO}</div>
    <div class="cover-fields">
      <div><span>Este cuaderno pertenece a</span><div class="ln"></div></div>
      <div class="two">{periodo}</div>
      <div><span>@ / canales</span><div class="ln"></div></div>
    </div>
    <div class="cover-foot">{estrella(10)} &nbsp;{formato}&nbsp; {estrella(10)}</div>
  </div>
</section>''')

# ═══════════════════════════ CÓMO USAR ═══════════════════════════
def como_usar(meses):
    tri = meses > 1
    pg = (lambda a, b: "En cada mes") if tri else (lambda a, b: f"Págs. {a}–{b}")
    bloques = [
        ("fuego", "Hábitos", "Lo que repites define lo que publicas. Registras tus hábitos día a día y tu energía, para ver qué rutina sostiene tu creación.", pg("04", "05")),
        ("agua", "Contenido", "Del banco de ideas a la pieza publicada. Planificas el mes, preproduces con la ficha de pieza y anotas las métricas de cada publicación.", pg("06", "09")),
        ("tierra", "Comunidad", f"Seguidores, {ED['registro']['sub'].lower()}, conversaciones y colaboraciones. Lo que la comunidad pregunta se convierte en tu próxima idea.", pg("10", "12")),
    ]
    cards = "".join(f'''
      <div class="card">
        <div class="card-ico">{simbolo(e, 26)}</div>
        <h3>{t}</h3><p>{d}</p><div class="pg">{p}</div>
      </div>''' for e, t, d, p in bloques)
    ritual = [
        ("Diario", "3 min", "Marca hábitos, energía y el estado de tus piezas en el banco de ideas."),
        ("Semanal", "15 min", "Anota seguidores por plataforma y las métricas de lo publicado esa semana."),
        ("Mensual", "30 min", "Completa el cierre del mes: números, qué funcionó y qué cambias."),
    ]
    if tri:
        ritual[2] = ("Mensual + día 90", "30 min", "Cierra cada mes y, al final, compara los tres en el cierre del trimestre.")
    rit = "".join(f'<div class="rit"><div class="rit-h"><b>{a}</b><span>{b}</span></div><p>{c}</p></div>' for a, b, c in ritual)
    leyenda = '''
      <div class="leyenda">
        <div><span class="dot full"></span> Hecho</div>
        <div><span class="dot half"></span> A medias</div>
        <div><span class="dot x">×</span> No tocaba / descanso</div>
        <div><span class="dot"></span> Pendiente</div>
      </div>'''
    hojas = ["Intención del mes", "Habit tracker", "Energía y ritmo", "Calendario de contenido", "Banco de ideas",
             "Ficha de pieza", "Métricas de contenido", "Crecimiento de comunidad", ED["registro"]["titulo"],
             "Colaboraciones y marcas", "Cierre del mes"]
    if tri:
        items = [("03", "Mapa del trimestre")]
        for m in range(meses):
            ini = 4 + m * 11
            items.append((f"{ini:02d}–{ini+10:02d}", f"Mes {m+1}"))
        items.append((f"{4 + meses*11:02d}", "Cierre del trimestre"))
        indice = "".join(f'<div class="ix"><span>{t}</span><i></i><b>{n}</b></div>' for n, t in items)
        indice = f'<div class="indice">{indice}</div><div class="ix-nota">Cada mes trae las mismas 11 hojas: {", ".join(h.lower() for h in hojas)}.</div>'
        intro = f"Tres meses en {3 + meses*11 + 1} páginas. Cada mes repite las mismas hojas para que compares tus números mes a mes."
    else:
        items = [(f"{i+3:02d}", h) for i, h in enumerate(hojas)]
        indice = '<div class="indice">' + "".join(f'<div class="ix"><span>{t}</span><i></i><b>{n}</b></div>' for n, t in items) + "</div>"
        intro = "Un mes de trabajo cabe en 13 páginas. Cada sección tiene un símbolo para encontrarla rápido."
    cuerpo = f'''
    <div class="cards">{cards}</div>
    <h2 class="sub">El ritual</h2>
    <div class="rits">{rit}</div>
    <h2 class="sub">Códigos para marcar</h2>
    {leyenda}
    <h2 class="sub">Índice</h2>
    {indice}
    <div class="note">Escribe con lápiz o marca con un solo color por plataforma. Una celda vacía también es información: muestra dónde se cortó la racha.</div>
    '''
    pagina("inicio", "Cómo usar esta bitácora", "Tres elementos", cuerpo, intro)

# ═══════════════════════════ TRIMESTRE ═══════════════════════════
def mapa_trimestre():
    filas = []
    for e, t in [("fuego", "Hábitos"), ("agua", "Contenido"), ("tierra", "Comunidad")]:
        filas.append([f'<span class="row-h">{simbolo(e, 13)} {t}</span>', "", "", "", ""])
    metas = tabla(["Elemento", "Mes 1", "Mes 2", "Mes 3", "Meta día 90"], filas,
                  ["19%", "19%", "19%", "19%", "24%"], cls="tri", alto=74)
    hitos = tabla(["Fecha", "Hito / lanzamiento / evento", "Plataforma", "Listo"],
                  vacias(7, 4), ["14%", "54%", "18%", "14%"], alto=30)
    cuerpo = f'''
    <div class="frase"><div class="lab">Frase guía del trimestre</div><div class="frase-box"></div></div>
    <h2 class="sub">Metas por mes</h2>
    {metas}
    <h2 class="sub">Hitos del trimestre</h2>
    {hitos}
    {campo("Así se ve mi cuenta el día 90", 3, "escríbelo en presente, con números")}
    '''
    pagina("inicio", "90 días · visión", "Mapa del trimestre", cuerpo,
           "Divide la meta grande en tres escalones. Cada mes empieza con su propia hoja de intención.")

def cierre_trimestre():
    kpi_extra = ED["kpi_extra"][0]
    metr = (["Piezas publicadas", "Vistas totales", "Interacción % promedio"]
            + [f"Seguidores nuevos · {ABREV[p]}" for p in plats()]
            + ["Hábitos cumplidos %", kpi_extra, "Colaboraciones", "Ingresos por colaboraciones"])
    t = tabla(["Métrica", "Mes 1", "Mes 2", "Mes 3", "Total / promedio", "Tendencia"],
              [[m, "", "", "", "", '<span class="tend">↑ &nbsp; → &nbsp; ↓</span>'] for m in metr],
              ["30%", "13%", "13%", "13%", "17%", "14%"], cls="comp", alto=30)
    cuerpo = f'''
    {t}
    <div class="grid3">
      <div class="col-box sm">{simbolo("aire", 14)}<h3>Repito</h3>{lineas(4)}</div>
      <div class="col-box sm">{simbolo("agua", 14)}<h3>Cambio</h3>{lineas(4)}</div>
      <div class="col-box sm">{simbolo("tierra", 14)}<h3>Dejo</h3>{lineas(4)}</div>
    </div>
    {campo("Mi mejor pieza del trimestre y por qué funcionó", 2)}
    '''
    pagina("cierre", "Revisión de 90 días", "Cierre del trimestre", cuerpo,
           "Copia los números de cada cierre mensual. Marca la tendencia: sube, se mantiene o baja.")

# ═══════════════════════════ INTENCIÓN DEL MES ═══════════════════════════
def intencion():
    filas = [[f'<span class="ej">{p}</span>', "", ""] for p in ED["pilares"]] + vacias(2, 3)
    pilares = tabla(["Pilar de contenido", "% del mes", "Para qué (objetivo)"], filas, ["46%", "16%", "38%"], alto=32)
    metas = "".join(f'''
      <div class="meta-box">
        <div class="mb-h">{simbolo(e, 14)} {t}</div>
        <div class="mb-row"><span>Meta</span><div class="ln"></div></div>
        <div class="mb-row"><span>Hoy estoy en</span><div class="ln"></div></div>
        <div class="mb-row"><span>Cómo lo mido</span><div class="ln"></div></div>
      </div>''' for e, t in [("fuego", "Hábitos"), ("agua", "Contenido"), ("tierra", "Comunidad")])
    cuerpo = f'''
    <div class="frase"><div class="lab">Frase guía del mes</div><div class="frase-box"></div></div>
    <div class="metas">{metas}</div>
    <h2 class="sub">Pilares de contenido</h2>
    {pilares}
    <div class="grid2">
      {campo("Qué quiero que mi comunidad sienta este mes", 5)}
      {campo("Fechas clave (lanzamientos, eventos, lives)", 5)}
    </div>
    '''
    pagina("inicio", f"{MES} · antes de empezar" if MES else "Antes de empezar", "Intención del mes", cuerpo,
           "Tres metas, una por elemento, con un número para medirlas. Los pilares en gris son sugerencias: reemplázalos por los tuyos.")

# ═══════════════════════════ HÁBITOS ═══════════════════════════
def habit_tracker():
    dias = "".join(f"<th class='d'>{i}</th>" for i in range(1, 32))
    filas = ""
    for i in range(14):
        ej = f'<span class="ej">{ED["habitos"][i]}</span>' if i < len(ED["habitos"]) else ""
        celdas = "".join("<td class='c'><span></span></td>" for _ in range(31))
        filas += f"<tr><td class='hab'>{ej}</td>{celdas}<td class='m'></td><td class='m'></td></tr>"
    tabla_h = f'''
    <table class="habits">
      <thead><tr><th class="hab-h">Hábito</th>{dias}<th class="m">Meta</th><th class="m">Total</th></tr></thead>
      <tbody>{filas}</tbody>
    </table>'''
    cuerpo = f'''
    {tabla_h}
    <div class="ej-note">Los hábitos en gris son sugerencias: escribe encima los tuyos. Meta = días que te propones; Total = días cumplidos.</div>
    <div class="grid3">
      <div class="stat"><div class="lab">Racha más larga</div><div class="big-ln"></div><span class="u">días</span></div>
      <div class="stat"><div class="lab">Hábito más fácil</div><div class="big-ln"></div></div>
      <div class="stat"><div class="lab">Hábito que más costó</div><div class="big-ln"></div></div>
    </div>
    {campo("Mi recompensa si llego a la meta", 1)}
    '''
    pagina("habitos", "Registro diario · 31 días", "Habit Tracker", cuerpo)

def energia():
    sem = ["L", "M", "M", "J", "V", "S", "D"]
    head = "".join(f"<th>{d}</th>" for d in sem)
    puntos = "".join("<td><div class='dots5'>" + "<i></i>" * 5 + "</div></td>" for _ in range(7))
    vacia = "".join("<td></td>" for _ in range(7))
    creando = "Horas de stream" if ED["icono"] == "control" else "Horas creando"
    bloques = ""
    for s in range(1, 6):
        bloques += f'''
        <tr class="wk"><td class="wl" rowspan="4">S{s}</td><td class="rl">Energía 1–5</td>{puntos}</tr>
        <tr><td class="rl">{creando}</td>{vacia}</tr>
        <tr><td class="rl">Horas de pantalla</td>{vacia}</tr>
        <tr class="last"><td class="rl">Horas de sueño</td>{vacia}</tr>'''
    t = f'''<table class="energy"><thead><tr><th></th><th></th>{head}</tr></thead><tbody>{bloques}</tbody></table>'''
    cuerpo = f'''
    {t}
    <div class="grid2">
      {campo("Los días con más energía tenían en común", 4)}
      {campo("Lo que me quitó energía", 4)}
    </div>
    '''
    pagina("habitos", "Semana a semana", "Energía y ritmo", cuerpo,
           "Rellena los puntos de energía (1 = agotada, 5 = imparable). Al cruzarlo con tus métricas verás en qué días te conviene grabar.")

# ═══════════════════════════ CONTENIDO ═══════════════════════════
def calendario():
    sem = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    head = "".join(f"<th>{d}</th>" for d in sem)
    tags = "".join(f"<span class='tag'>{ABREV[p]}</span>" for p in plats())
    cel = f"<td><div class='cal-n'></div><div class='cal-l'></div><div class='cal-l'></div><div class='cal-t'>{tags}</div></td>"
    filas = "".join("<tr>" + cel * 7 + "</tr>" for _ in range(5))
    leg = " · ".join(f"<b>{ABREV[p]}</b> {p}" for p in plats())
    cuerpo = f'''
    <table class="cal"><thead><tr>{head}</tr></thead><tbody>{filas}</tbody></table>
    <div class="cal-leg">Anota el número del día arriba a la izquierda. Encierra en un círculo la plataforma donde va la pieza y márcala cuando esté publicada. &nbsp; {leg}</div>
    <div class="grid2">
      {campo("Piezas planificadas por plataforma", 2)}
      {campo("Fechas que no puedo fallar", 2)}
    </div>
    '''
    pagina("contenido", "Planificación mensual", "Calendario de contenido", cuerpo)

def banco_ideas():
    estados = "<div class='steps'>" + "<span></span>" * 5 + "</div>"
    filas = [["", "", "", "", estados] for _ in range(21)]
    t = tabla(["Idea / gancho", "Pilar", "Formato", "Plataforma", "Estado"],
              filas, ["40%", "15%", "13%", "13%", "19%"], cls="ideas", alto=31)
    cuerpo = f'''
    <div class="steps-leg">
      <div class="steps big"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></div>
      <div class="steps-names"><span>Idea</span><span>Guion</span><span>Grabado</span><span>Editado</span><span>Publicado</span></div>
    </div>
    {t}
    '''
    pagina("contenido", "Pipeline de producción", "Banco de ideas", cuerpo,
           "Cada idea avanza cinco pasos. Rellena un círculo por paso cumplido: en una mirada sabes qué está trabado y en qué etapa.")

def ficha_pieza():
    def ficha():
        pl = "".join(f"<span class='chk'></span>{ABREV[p]}&nbsp;&nbsp;" for p in plats())
        embudo = "".join(f"<span class='chk'></span>{e}&nbsp;&nbsp;" for e in ["Atraer", "Conectar", "Convertir", "Fidelizar"])
        return f'''
      <div class="ficha">
        <div class="ficha-h"><span>Pieza N.º ____</span><span>Fecha de publicación ____ / ____</span><span class="pl">{pl}</span></div>
        <div class="ficha-g">
          <div class="col">
            {campo("A quién le hablo", 1)}
            {campo("Héroe y conflicto", 2, "quién es y qué problema tiene")}
            {campo("Gancho · primeros 3 segundos", 2)}
            {campo("Transformación", 1, "antes → después")}
            <div class="lab sm">Etapa del embudo</div><div class="opts">{embudo}</div>
          </div>
          <div class="col">
            <div class="lab">Estructura</div>
            <div class="est"><b>Inicio</b><div class="ln"></div></div>
            <div class="est"><b>Nudo</b><div class="ln"></div></div>
            <div class="est"><b>Final</b><div class="ln"></div></div>
            {campo("Llamado a la acción (uno solo)", 1)}
            {campo("Palabras clave de la historia", 1)}
            {campo("Texto en pantalla · audio · recursos", 2)}
          </div>
        </div>
      </div>'''
    pagina("contenido", "Preproducción · Método Alquimia", "Ficha de pieza", ficha() + ficha(),
           "Antes de grabar, define la historia: a quién le hablas, qué conflicto vive y qué transformación le muestras.")

def metricas():
    cab = ["Fecha", "Plat.", "Formato", "Vistas", "Ret. %", "Me gusta", "Coment.", "Guard.", "Compart.", "Seg. +"]
    t = tabla(cab, vacias(19, len(cab)),
              ["9%", "7%", "13%", "11%", "9%", "11%", "10%", "10%", "10%", "10%"], cls="met", alto=29)
    top = "".join(f'''<div class="top3"><div class="tn">{i}</div><div class="tl"><div class="ln"></div><div class="ln"></div></div></div>''' for i in range(1, 4))
    cuerpo = f'''
    {t}
    <div class="grid2 top-g">
      <div><div class="lab">Top 3 del mes · por qué funcionaron</div>{top}</div>
      <div class="formula">
        <div class="lab">Fórmulas rápidas</div>
        <p><b>Interacción %</b> = (me gusta + coment. + guard. + compart.) ÷ vistas × 100</p>
        <p><b>Guardados</b> y <b>compartidos</b> pesan más que los me gusta: indican que la pieza sirvió.</p>
        <p><b>Ret. %</b> = vistas completas ÷ vistas totales × 100 (TikTok, Reels, Shorts).</p>
      </div>
    </div>
    '''
    pagina("contenido", "Content tracker · resultados", "Métricas de contenido", cuerpo,
           "Anota cada pieza 7 días después de publicarla, así comparas en igualdad de condiciones.")

# ═══════════════════════════ COMUNIDAD ═══════════════════════════
def crecimiento():
    cab = ["Plataforma", "Inicio mes", "Sem 1", "Sem 2", "Sem 3", "Sem 4", "Cierre", "Crec. %"]
    extra = 5 - len(plats())   # completa hasta 5 filas
    filas = ([[f"<b>{p}</b>"] + [""] * 7 for p in plats()]
             + [["<span class='ej'>Otra</span>"] + [""] * 7 for _ in range(max(extra, 1))])
    t = tabla(cab, filas, ["17%"] + ["11.8%"] * 7, cls="crec", alto=50)
    cols_g = "".join("<div class='bar-col'><div class='bar-area'></div></div>" for _ in plats())
    labs_g = "".join(f"<span>{ABREV[p]}</span>" for p in plats())
    escala = "<div></div>" * 10
    cuerpo = f'''
    {t}
    <div class="formula inline"><b>Crecimiento %</b> = (cierre − inicio) ÷ inicio × 100 &nbsp;·&nbsp; Ej.: de 1.200 a 1.380 seguidores = 15 %</div>
    <div class="grid2 chart-g">
      <div>
        <div class="lab">Gráfico del mes · pinta las barras</div>
        <div class="chart"><div class="scale">{escala}</div><div class="bars">{cols_g}</div></div><div class="bar-labs">{labs_g}</div>
        <div class="hint c">Define tú la escala: cada línea = ______ seguidores</div>
      </div>
      <div>
        {campo("¿Qué pieza o live trajo más seguidores?" if ED["registro"] is LIVES else "¿Qué pieza trajo más seguidores?", 4)}
        {campo("¿Dónde perdí seguidores y por qué creo que pasó?", 4)}
      </div>
    </div>
    '''
    pagina("comunidad", "Community tracker · seguidores", "Crecimiento de comunidad", cuerpo,
           "Anota seguidores el mismo día y a la misma hora cada semana.")

def registro_y_conversaciones():
    r = ED["registro"]
    t = tabla(r["cab"], vacias(9, len(r["cab"])), r["anchos"], cls="met", alto=29)
    t2 = tabla(["Lo que me dijeron / preguntaron", "Dónde", "Idea de contenido que sale de aquí"],
               vacias(9, 3), ["44%", "12%", "44%"], alto=33)
    cuerpo = f'''
    <h2 class="sub first">{r["sub"]}</h2>
    {t}
    <h2 class="sub">Conversaciones que valen oro</h2>
    {t2}
    <div class="note">Si una pregunta se repite 3 veces en comentarios o DMs, es una pieza de contenido esperando a ser grabada.</div>
    '''
    pagina("comunidad", "Community tracker · interacción", r["titulo"], cuerpo)

def colaboraciones():
    cab = ["Marca / creador", "Contacto", "Fecha", "Propuesta", "Monto", "Estado", "Entrega"]
    estado = "<div class='mini-est'><span>P</span><span>N</span><span>C</span><span>E</span></div>"
    filas = [["", "", "", "", "", estado, ""] for _ in range(16)]
    t = tabla(cab, filas, ["20%", "15%", "9%", "20%", "11%", "14%", "11%"], cls="colab", alto=34)
    tarifa = "por clip · por mención en live · por video" if ED["icono"] == "control" else "por reel · por story · por video"
    cuerpo = f'''
    {t}
    <div class="est-leg">Estado: <b>P</b> propuesta enviada · <b>N</b> en negociación · <b>C</b> confirmada · <b>E</b> entregada y pagada. Rellena la letra en la que está.</div>
    <div class="grid2">
      {campo("Marcas con las que quiero trabajar", 4)}
      {campo("Mi tarifa base este mes", 4, tarifa)}
    </div>
    '''
    pagina("comunidad", "Community tracker · alianzas", "Colaboraciones y marcas", cuerpo)

# ═══════════════════════════ CIERRE ═══════════════════════════
def cierre():
    stats = [("Piezas publicadas", ""), ("Vistas totales", ""), ("Seguidores nuevos", ""),
             ("Hábitos cumplidos", "%"), ED["kpi_extra"], ("Colaboraciones", "")]
    st = "".join(f'<div class="kpi"><div class="kpi-v"></div><div class="kpi-l">{l}</div><span class="u">{u}</span></div>' for l, u in stats)
    cuerpo = f'''
    <div class="kpis">{st}</div>
    <div class="grid3 cierre-g">
      <div class="col-box">{simbolo("aire", 16)}<h3>Sigo</h3>{lineas(7)}</div>
      <div class="col-box">{simbolo("agua", 16)}<h3>Ajusto</h3>{lineas(7)}</div>
      <div class="col-box">{simbolo("tierra", 16)}<h3>Suelto</h3>{lineas(7)}</div>
    </div>
    {campo("Lo que aprendí de mi comunidad este mes", 3)}
    {campo("Mi intención para el próximo mes", 3)}
    '''
    pagina("cierre", f"{MES} · revisión" if MES else "Revisión mensual", "Cierre del mes", cuerpo,
           "Pasa los números de cada tracker. Compararlos mes a mes es lo que convierte esta bitácora en estrategia.")

MES_COMPLETO = [intencion, habit_tracker, energia, calendario, banco_ideas, ficha_pieza,
                metricas, crecimiento, registro_y_conversaciones, colaboraciones, cierre]

# ═══════════════════════════ CONSTRUCCIÓN ═══════════════════════════
BASE = Path(__file__).parent
SALIDAS = BASE / "salidas"

def construir(clave, meses):
    global MES
    ED.clear(); ED.update(EDICIONES[clave]); paginas.clear(); MES = ""
    portada(meses > 1)
    como_usar(meses)
    if meses > 1:
        mapa_trimestre()
    for m in range(meses):
        MES = f"Mes {m+1}" if meses > 1 else ""
        for hoja in MES_COMPLETO:
            hoja()
    MES = ""
    if meses > 1:
        cierre_trimestre()

    nicho = "" if clave == "general" else "-" + clave.capitalize()
    formato = "Trimestral" if meses > 1 else "Mensual"
    nombre = f"Bitacora-de-Creadora{nicho}-{formato}"
    titulo = f"{NOMBRE_PRODUCTO} {ED['nombre']} · {formato}".replace("  ", " ")
    html = f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>{titulo}</title>
<link rel="stylesheet" href="../fonts/fonts.css">
<link rel="stylesheet" href="../estilos.css">
</head><body style="--ciruela:{ED['acento']}">{"".join(paginas)}</body></html>'''
    SALIDAS.mkdir(exist_ok=True)
    ruta_html = SALIDAS / f"{nombre}.html"
    ruta_html.write_text(html, encoding="utf-8")
    print(f"{len(paginas):>2} págs → {nombre}")
    return ruta_html

if __name__ == "__main__":
    claves = [sys.argv[1]] if len(sys.argv) > 1 else list(EDICIONES)
    formatos = [int(sys.argv[2])] if len(sys.argv) > 2 else [1, 3]
    htmls = [construir(c, m) for c in claves for m in formatos]
    if shutil.which("node"):
        subprocess.run(["node", str(BASE / "exportar.js")] + [str(h) for h in htmls], check=True)
    else:
        print("Abre cada .html de salidas/ en Chrome → Imprimir → Guardar como PDF (Carta, márgenes: ninguno, gráficos de fondo activados).")
