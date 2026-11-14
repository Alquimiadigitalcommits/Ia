# -*- coding: utf-8 -*-
"""
Bitácora de Creadora — generador del PDF.

Cómo usarlo:
  1) Cambia los textos de la sección CONFIGURACIÓN (marca, colores, plataformas, hábitos).
  2) Ejecuta:  python3 generar.py
  3) Se crean  bitacora.html  (para revisar en el navegador) y  Bitacora-de-Creadora.pdf

El diseño está en estilos.css. Cada página es una función de Python que devuelve HTML.
"""
from pathlib import Path

# ───────────────────────── CONFIGURACIÓN ─────────────────────────
MARCA = "ALQUIMIA DIGITAL"
NOMBRE_PRODUCTO = "Bitácora de Creadora"
SUBTITULO = "Hábitos · Contenido · Comunidad"
PLATAFORMAS = ["Instagram", "TikTok", "YouTube", "Kick"]
ABREV = {"Instagram": "IG", "TikTok": "TT", "YouTube": "YT", "Kick": "KK"}
# Hábitos sugeridos (la persona puede tacharlos y escribir los suyos)
HABITOS_EJEMPLO = ["Agua 2 L", "Skincare AM/PM", "Moverme 30 min", "Leer 10 págs",
                   "Grabar 1 pieza", "Responder comunidad", "Dormir 7 h", "Sin redes 1 h al despertar"]
# ──────────────────────────────────────────────────────────────────

# Símbolos alquímicos de los 4 elementos (SVG propio, se dibujan con línea)
def simbolo(tipo, size=18):
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

SECCIONES = {
    "inicio":    ("Inicio", "aire"),
    "habitos":   ("Hábitos", "fuego"),
    "contenido": ("Contenido", "agua"),
    "comunidad": ("Comunidad", "tierra"),
    "cierre":    ("Cierre", "aire"),
}

paginas = []

def pagina(seccion, kicker, titulo, cuerpo, intro=""):
    nombre, el = SECCIONES[seccion]
    n = len(paginas) + 1
    intro_html = f'<p class="intro">{intro}</p>' if intro else ""
    paginas.append(f'''
<section class="page">
  <div class="frame">
    <header class="top">
      <span class="brand">{MARCA}</span>
      <span class="sec">{simbolo(el, 14)} {nombre}</span>
    </header>
    <div class="title">
      <div class="kicker">{kicker}</div>
      <h1>{titulo}</h1>
      <div class="rule"><span></span>{estrella(10)}<span></span></div>
    </div>
    {intro_html}
    <main>{cuerpo}</main>
    <footer class="bottom"><span>{NOMBRE_PRODUCTO}</span><span class="num">{n:02d}</span></footer>
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
    trs = ""
    for f in filas:
        trs += "<tr>" + "".join(f"<td>{c}</td>" for c in f) + "</tr>"
    return f'<table class="tbl {cls}"{style}><colgroup>{cols}</colgroup><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'

def vacias(n_filas, n_cols):
    return [[""] * n_cols for _ in range(n_filas)]

# ═══════════════════════════ PORTADA ═══════════════════════════
def portada():
    anillo = "".join(
        f'<g transform="rotate({i*30} 150 150)"><line x1="150" y1="18" x2="150" y2="30"/></g>' for i in range(12))
    elems = ""
    for i, el in enumerate(["fuego", "agua", "aire", "tierra"]):
        ang = [0, 90, 180, 270][i]
        elems += (f'<g transform="rotate({ang} 150 150) translate(141 46) rotate({-ang} 9 9)">'
                  f'{simbolo(el, 18).replace("<svg", "<svg x=\"0\" y=\"0\"")}</g>')
    paginas.append(f'''
<section class="page cover">
  <div class="frame">
    <div class="cover-top">{MARCA}</div>
    <svg class="emblem" width="300" height="300" viewBox="0 0 300 300" fill="none" stroke="currentColor" stroke-width="1">
      <circle cx="150" cy="150" r="132"/><circle cx="150" cy="150" r="104" stroke-dasharray="2 5"/>
      <circle cx="150" cy="150" r="58"/>
      <path d="M150 92 L200 179 L100 179 Z"/><path d="M150 208 L100 121 L200 121 Z"/>
      {anillo}{elems}
      <circle cx="150" cy="150" r="3" fill="currentColor"/>
    </svg>
    <h1 class="cover-title">{NOMBRE_PRODUCTO}</h1>
    <div class="cover-sub">{SUBTITULO}</div>
    <div class="cover-fields">
      <div><span>Este cuaderno pertenece a</span><div class="ln"></div></div>
      <div class="two">
        <div><span>Mes</span><div class="ln"></div></div>
        <div><span>Año</span><div class="ln"></div></div>
      </div>
      <div><span>@ / canales</span><div class="ln"></div></div>
    </div>
    <div class="cover-foot">{estrella(10)} &nbsp;Sistema mensual para creadoras de contenido&nbsp; {estrella(10)}</div>
  </div>
</section>''')

# ═══════════════════════════ CÓMO USAR ═══════════════════════════
def como_usar():
    bloques = [
        ("fuego", "Hábitos", "Lo que repites define lo que publicas. Registras tus hábitos día a día y tu energía, para ver qué rutina sostiene tu creación.", "Págs. 04–05"),
        ("agua", "Contenido", "Del banco de ideas a la pieza publicada. Planificas el mes, preproduces con la ficha de pieza y anotas las métricas de cada publicación.", "Págs. 06–09"),
        ("tierra", "Comunidad", "Seguidores, lives, conversaciones y colaboraciones. Lo que la comunidad pregunta se convierte en tu próxima idea.", "Págs. 10–12"),
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
    rit = "".join(f'<div class="rit"><div class="rit-h"><b>{a}</b><span>{b}</span></div><p>{c}</p></div>' for a, b, c in ritual)
    leyenda = '''
      <div class="leyenda">
        <div><span class="dot full"></span> Hecho</div>
        <div><span class="dot half"></span> A medias</div>
        <div><span class="dot x">×</span> No tocaba / descanso</div>
        <div><span class="dot"></span> Pendiente</div>
      </div>'''
    items = [("03", "Intención del mes"), ("04", "Habit tracker"), ("05", "Energía y ritmo"),
             ("06", "Calendario de contenido"), ("07", "Banco de ideas"), ("08", "Ficha de pieza"),
             ("09", "Métricas de contenido"), ("10", "Crecimiento de comunidad"), ("11", "Lives y conversaciones"),
             ("12", "Colaboraciones y marcas"), ("13", "Cierre del mes")]
    indice = "".join(f'<div class="ix"><span>{t}</span><i></i><b>{n}</b></div>' for n, t in items)
    cuerpo = f'''
    <div class="cards">{cards}</div>
    <h2 class="sub">El ritual</h2>
    <div class="rits">{rit}</div>
    <h2 class="sub">Códigos para marcar</h2>
    {leyenda}
    <h2 class="sub">Índice</h2>
    <div class="indice">{indice}</div>
    <div class="note">Escribe con lápiz o marca con un solo color por plataforma. Una celda vacía también es información: muestra dónde se cortó la racha.</div>
    '''
    pagina("inicio", "Cómo usar esta bitácora", "Tres elementos", cuerpo,
           "Un mes de trabajo cabe en 13 páginas. Cada sección tiene un símbolo para encontrarla rápido.")

# ═══════════════════════════ INTENCIÓN DEL MES ═══════════════════════════
def intencion():
    pilares = tabla(["Pilar de contenido", "% del mes", "Para qué (objetivo)"],
                    vacias(6, 3), ["46%", "16%", "38%"], alto=32)
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
    pagina("inicio", "Antes de empezar", "Intención del mes", cuerpo,
           "Tres metas, una por elemento, con un número para medirlas. Si no se puede contar, reescríbela.")

# ═══════════════════════════ HÁBITOS ═══════════════════════════
def habit_tracker():
    dias = "".join(f"<th class='d'>{i}</th>" for i in range(1, 32))
    filas = ""
    for i in range(14):
        ej = f'<span class="ej">{HABITOS_EJEMPLO[i]}</span>' if i < len(HABITOS_EJEMPLO) else ""
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
    def fila_puntos():
        return "".join("<td><div class='dots5'>" + "<i></i>" * 5 + "</div></td>" for _ in range(7))
    def fila_vacia():
        return "".join("<td></td>" for _ in range(7))
    bloques = ""
    for s in range(1, 6):
        bloques += f'''
        <tr class="wk"><td class="wl" rowspan="4">S{s}</td><td class="rl">Energía 1–5</td>{fila_puntos()}</tr>
        <tr><td class="rl">Horas creando</td>{fila_vacia()}</tr>
        <tr><td class="rl">Horas de pantalla</td>{fila_vacia()}</tr>
        <tr class="last"><td class="rl">Horas de sueño</td>{fila_vacia()}</tr>'''
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
    tags = "".join(f"<span class='tag'>{ABREV[p]}</span>" for p in PLATAFORMAS)
    cel = f"<td><div class='cal-n'></div><div class='cal-l'></div><div class='cal-l'></div><div class='cal-t'>{tags}</div></td>"
    filas = "".join("<tr>" + cel * 7 + "</tr>" for _ in range(5))
    leg = " · ".join(f"<b>{ABREV[p]}</b> {p}" for p in PLATAFORMAS)
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
    estados = "<div class='steps'>" + "".join(f"<span title='{e}'></span>" for e in range(5)) + "</div>"
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
    def ficha(n):
        plats = "".join(f"<span class='chk'></span>{ABREV[p]}&nbsp;&nbsp;" for p in PLATAFORMAS)
        embudo = "".join(f"<span class='chk'></span>{e}&nbsp;&nbsp;" for e in ["Atraer", "Conectar", "Convertir", "Fidelizar"])
        return f'''
      <div class="ficha">
        <div class="ficha-h"><span>Pieza N.º ____</span><span>Fecha de publicación ____ / ____</span><span class="pl">{plats}</span></div>
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
    cuerpo = ficha(1) + ficha(2)
    pagina("contenido", "Preproducción · Método Alquimia", "Ficha de pieza", cuerpo,
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
    filas = [[f"<b>{p}</b>"] + [""] * 7 for p in PLATAFORMAS] + [["<span class='ej'>Otra</span>"] + [""] * 7]
    t = tabla(cab, filas, ["17%"] + ["11.8%"] * 7, cls="crec", alto=50)
    # gráfico manual de barras
    cols_g = "".join("<div class='bar-col'><div class='bar-area'></div></div>" for p in PLATAFORMAS)
    labs_g = "".join(f"<span>{ABREV[p]}</span>" for p in PLATAFORMAS)
    escala = "".join("<div></div>" for _ in range(10))
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
        {campo("¿Qué pieza o live trajo más seguidores?", 4)}
        {campo("¿Dónde perdí seguidores y por qué creo que pasó?", 4)}
      </div>
    </div>
    '''
    pagina("comunidad", "Community tracker · seguidores", "Crecimiento de comunidad", cuerpo,
           "Anota seguidores el mismo día y a la misma hora cada semana.")

def lives_y_conversaciones():
    cab = ["Fecha", "Plat.", "Juego / tema", "Duración", "Pico", "Prom.", "Seg. +", "Subs / apoyos"]
    t = tabla(cab, vacias(9, len(cab)), ["10%", "8%", "24%", "11%", "9%", "9%", "11%", "18%"], cls="met", alto=29)
    cab2 = ["Lo que me dijeron / preguntaron", "Dónde", "Idea de contenido que sale de aquí"]
    t2 = tabla(cab2, vacias(9, 3), ["44%", "12%", "44%"], alto=33)
    cuerpo = f'''
    <h2 class="sub first">Lives y streams</h2>
    {t}
    <h2 class="sub">Conversaciones que valen oro</h2>
    {t2}
    <div class="note">Si una pregunta se repite 3 veces en comentarios o DMs, es una pieza de contenido esperando a ser grabada.</div>
    '''
    pagina("comunidad", "Community tracker · interacción", "Lives y conversaciones", cuerpo)

def colaboraciones():
    cab = ["Marca / creador", "Contacto", "Fecha", "Propuesta", "Monto", "Estado", "Entrega"]
    estado = "<div class='mini-est'><span>P</span><span>N</span><span>C</span><span>E</span></div>"
    filas = [["", "", "", "", "", estado, ""] for _ in range(16)]
    t = tabla(cab, filas, ["20%", "15%", "9%", "20%", "11%", "14%", "11%"], cls="colab", alto=34)
    cuerpo = f'''
    {t}
    <div class="est-leg">Estado: <b>P</b> propuesta enviada · <b>N</b> en negociación · <b>C</b> confirmada · <b>E</b> entregada y pagada. Rellena la letra en la que está.</div>
    <div class="grid2">
      {campo("Marcas con las que quiero trabajar", 4)}
      {campo("Mi tarifa base este mes", 4, "por reel · por story · por live")}
    </div>
    '''
    pagina("comunidad", "Community tracker · alianzas", "Colaboraciones y marcas", cuerpo)

# ═══════════════════════════ CIERRE ═══════════════════════════
def cierre():
    stats = [("Piezas publicadas", ""), ("Vistas totales", ""), ("Seguidores nuevos", ""),
             ("Hábitos cumplidos", "%"), ("Horas de live", "h"), ("Colaboraciones", "")]
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
    pagina("cierre", "Revisión mensual", "Cierre del mes", cuerpo,
           "Pasa los números de cada tracker. Compararlos mes a mes es lo que convierte esta bitácora en estrategia.")

# ─────────── Construcción ───────────
portada()
como_usar()
intencion()
habit_tracker()
energia()
calendario()
banco_ideas()
ficha_pieza()
metricas()
crecimiento()
lives_y_conversaciones()
colaboraciones()
cierre()

base = Path(__file__).parent
html = f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>{NOMBRE_PRODUCTO}</title>
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="stylesheet" href="estilos.css">
</head><body>{"".join(paginas)}</body></html>'''
(base / "bitacora.html").write_text(html, encoding="utf-8")
print(f"{len(paginas)} páginas generadas → bitacora.html")

# Exportar a PDF con Chromium (Playwright para Node)
import subprocess, shutil
if shutil.which("node"):
    subprocess.run(["node", str(base / "exportar.js")], check=True)
else:
    print("Abre bitacora.html en Chrome → Imprimir → Guardar como PDF (Carta, márgenes: ninguno, gráficos de fondo activados).")
