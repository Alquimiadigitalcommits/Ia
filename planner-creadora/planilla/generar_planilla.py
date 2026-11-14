# -*- coding: utf-8 -*-
"""
Bitácora de Creadora · versión Google Sheets (automatizada y personalizable).

  python3 generar_planilla.py          → Bitacora-de-Creadora-Sheets.xlsx (vacía, lista para vender)
  python3 generar_planilla.py demo     → versión con datos de EJEMPLO (para probar fórmulas o hacer capturas)

El .xlsx se sube a Google Drive y se convierte en Google Sheets.
Cómo funciona:
  - Celdas blancas = la persona escribe.  Celdas lila = se calculan solas (no tocar).
  - La pestaña Configuración controla todo: nicho, plataformas, hábitos, pilares, mes y metas.
  - Nombres definidos (ANIO, MES_NUM, INICIO_MES, FIN_MES, NICHO_COL) hacen las fórmulas legibles.
"""
import sys, datetime
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule, FormulaRule, ColorScaleRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.formula import ArrayFormula
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.utils import get_column_letter as L

DEMO = len(sys.argv) > 1 and sys.argv[1] == "demo"

# ─────────────── Paleta y tipografía ───────────────
TINTA, CIRUELA, ORO, LILA, LINEA, GRIS = "2B2430", "6B4A73", "A88A5C", "F3EEF3", "D9D0DA", "8D8490"
F_TITULO = "Pinyon Script"
F_TEXTO = "Jost"
F_SERIF = "Cormorant Garamond"

def font(size=10, bold=False, color=TINTA, name=F_TEXTO, italic=False):
    return Font(name=name, size=size, bold=bold, color=color, italic=italic)

def fill(hex_):
    return PatternFill("solid", start_color=hex_, end_color=hex_)

fino = Side(style="thin", color=LINEA)
BORDE = Border(bottom=fino, left=fino, right=fino, top=fino)
BORDE_INF = Border(bottom=fino)
CENTRO = Alignment(horizontal="center", vertical="center", wrap_text=True)
IZQ = Alignment(horizontal="left", vertical="center", wrap_text=True)
ARRIBA = Alignment(horizontal="left", vertical="top", wrap_text=True)

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
         "Septiembre", "Octubre", "Noviembre", "Diciembre"]
ESTADOS = ["Idea", "Guion", "Grabado", "Editado", "Publicado"]
ESTADOS_COLAB = ["Propuesta enviada", "En negociación", "Confirmada", "Entregada y pagada", "Rechazada"]
EMBUDO = ["Atraer", "Conectar", "Convertir", "Fidelizar"]
MARCAS = ["✓", "½", "×"]
FORMATOS = ["Reel", "TikTok", "Short", "Video largo", "Carrusel", "Post", "Story", "Live", "Clip", ""]

# ─────────────── Datos por nicho ───────────────
NICHOS = {
    "General": {
        "plataformas": ["Instagram", "TikTok", "YouTube", "Kick"],
        "habitos": ["Agua 2 L", "Skincare AM/PM", "Moverme 30 min", "Leer 10 págs",
                    "Grabar 1 pieza", "Responder comunidad", "Dormir 7 h", "Sin redes 1 h al despertar"],
        "pilares": ["Educar: lo que sé hacer", "Mostrar: mi día a día", "Conectar: opiniones", "Vender: colaboraciones"],
        "reg_titulo": "Lives y streams",
        "reg": ["Fecha", "Plataforma", "Juego / tema", "Duración (h)", "Pico espectadores", "Promedio", "Seguidores +", "Subs / apoyos"],
        "kpi": "Horas de live", "kpi_tipo": "suma",
    },
    "Gamer": {
        "plataformas": ["Kick", "YouTube", "TikTok", "Instagram"],
        "habitos": ["Stream en mi horario", "Subir 1 clip del live", "Pausa activa cada 2 h", "Agua durante el stream",
                    "Responder chat / Discord", "Estirar manos y espalda", "Dormir 7 h", "30 min de juego nuevo"],
        "pilares": ["Clips y momentos del live", "Gameplay con opinión", "Setup y detrás de cámara", "Comunidad y Discord"],
        "reg_titulo": "Lives y streams",
        "reg": ["Fecha", "Plataforma", "Juego", "Duración (h)", "Pico espectadores", "Promedio", "Seguidores +", "Subs / apoyos"],
        "kpi": "Horas de stream", "kpi_tipo": "suma",
    },
    "Skincare": {
        "plataformas": ["Instagram", "TikTok", "YouTube", ""],
        "habitos": ["Rutina AM", "Rutina PM", "Protector solar", "Agua 2 L",
                    "Foto de progreso de piel", "Grabar 1 reseña", "Leer 1 lista INCI", "Dormir 7 h"],
        "pilares": ["Rutinas reales", "Reseñas honestas", "Ingredientes explicados", "Antes y después"],
        "reg_titulo": "Productos en prueba",
        "reg": ["Fecha inicio", "Producto", "Marca", "Precio", "Tipo de piel", "Días de uso", "Veredicto", "Pieza"],
        "kpi": "Productos probados", "kpi_tipo": "conteo",
    },
    "Panoramas": {
        "plataformas": ["Instagram", "TikTok", "YouTube", ""],
        "habitos": ["Visitar 1 lugar nuevo", "Grabar b-roll del lugar", "Anotar precio y horario", "Caminar 30 min",
                    "Editar 1 pieza", "Responder recomendaciones", "Presupuesto al día", "Dormir 7 h"],
        "pilares": ["Panoramas gratis", "Datos con precio", "Rutas de fin de semana", "Recomendados por la comunidad"],
        "reg_titulo": "Lugares visitados",
        "reg": ["Fecha", "Lugar", "Comuna / ciudad", "Precio", "Horario", "Nota 1–5", "Pieza", "Volvería"],
        "kpi": "Lugares visitados", "kpi_tipo": "conteo",
    },
}

wb = Workbook()
wb.remove(wb.active)

def hoja(nombre, color_tab, ancho=None):
    ws = wb.create_sheet(nombre)
    ws.sheet_properties.tabColor = color_tab
    ws.sheet_view.showGridLines = False
    if ancho:
        for col, w in ancho.items():
            ws.column_dimensions[col].width = w
    return ws

def titulo(ws, texto, sub="", col_fin="H"):
    ws.row_dimensions[1].height = 12
    ws.row_dimensions[2].height = 44
    ws["B2"] = texto
    ws["B2"].font = Font(name=F_TITULO, size=30, color=TINTA)
    ws["B2"].alignment = Alignment(vertical="center")
    if sub:
        ws["B3"] = sub
        ws["B3"].font = font(9, color=GRIS, italic=True, name=F_SERIF)
        ws.row_dimensions[3].height = 20

def cabecera(ws, fila, col_ini, textos, auto=()):
    """Fila de encabezados. Las columnas en `auto` se marcan como calculadas."""
    for i, t in enumerate(textos):
        c = ws.cell(fila, col_ini + i, t)
        es_auto = (col_ini + i) in auto
        c.font = font(9, bold=True, color="FFFFFF" if not es_auto else CIRUELA)
        c.fill = fill(CIRUELA if not es_auto else "E7DDE8")
        c.alignment = CENTRO
        c.border = BORDE
    ws.row_dimensions[fila].height = 30

def zona(ws, f1, f2, c1, c2, auto=(), fmt=None):
    """Da formato a la zona de datos: blanco = escribir, lila = automático."""
    for r in range(f1, f2 + 1):
        for c in range(c1, c2 + 1):
            cell = ws.cell(r, c)
            cell.border = BORDE
            cell.font = font(10, color=TINTA if c not in auto else "5D5461")
            cell.alignment = IZQ
            if c in auto:
                cell.fill = fill(LILA)
            if fmt and c in fmt:
                cell.number_format = fmt[c]

def lista(ws, rango_celdas, origen, mensaje=""):
    dv = DataValidation(type="list", formula1=origen, allow_blank=True, showDropDown=False)
    dv.error = "Elige una opción de la lista"
    dv.errorStyle = "warning"
    if mensaje:
        dv.prompt = mensaje
    ws.add_data_validation(dv)
    dv.add(rango_celdas)

def nombre(nm, ref):
    wb.defined_names[nm] = DefinedName(nm, attr_text=ref)

# ═══════════════════ Nichos (datos, oculta) ═══════════════════
wn = hoja("Nichos", GRIS)
claves = list(NICHOS)
wn["A1"] = "Campo"
for j, k in enumerate(claves):
    wn.cell(1, 2 + j, k)
    d = NICHOS[k]
    filas = d["plataformas"] + d["habitos"] + d["pilares"] + [d["reg_titulo"]] + d["reg"] + [d["kpi"], d["kpi_tipo"]]
    for i, v in enumerate(filas):
        wn.cell(2 + i, 2 + j, v)
etiquetas = ([f"Plataforma {i}" for i in range(1, 5)] + [f"Hábito {i}" for i in range(1, 9)]
             + [f"Pilar {i}" for i in range(1, 5)] + ["Registro: título"] + [f"Registro: col {i}" for i in range(1, 9)]
             + ["KPI extra", "KPI tipo"])
for i, e in enumerate(etiquetas):
    wn.cell(2 + i, 1, e)
# Listas fijas
for col, (cab, valores) in enumerate([("Meses", MESES), ("Estados", ESTADOS), ("Estados colab", ESTADOS_COLAB),
                                       ("Embudo", EMBUDO), ("Marcas", MARCAS)], start=7):
    wn.cell(1, col, cab)
    for i, v in enumerate(valores):
        wn.cell(2 + i, col, v)
wn.sheet_state = "hidden"
nombre("MESES", "Nichos!$G$2:$G$13")
nombre("ESTADOS", "Nichos!$H$2:$H$6")
# filas en Nichos: plataformas 2-5, hábitos 6-13, pilares 14-17, reg título 18, reg cols 19-26, kpi 27, kpi tipo 28

# ═══════════════════ Inicio ═══════════════════
wi = hoja("Inicio", ORO, {"A": 3, "B": 24, "C": 62, "D": 18})
titulo(wi, "Bitácora de Creadora", "Hábitos · Contenido · Comunidad — versión que se llena sola")
pasos = [
    ("1 · Haz tu copia", "Archivo → Hacer una copia. Trabaja siempre en tu copia, así la plantilla original queda limpia."),
    ("2 · Configuración", "Elige tu nicho, el año y el mes. Revisa plataformas, hábitos y pilares: los grises son sugerencias, escribe encima."),
    ("3 · Cada día · 3 min", "Pestaña Diario: marca tus hábitos con ✓ (hecho), ½ (a medias) o × (no tocaba) y tu energía de 1 a 5."),
    ("4 · Cada idea", "Pestaña Ideas: anota la idea, su pilar y plataforma, y mueve el estado de Idea a Publicado. Con fecha, aparece sola en el Calendario."),
    ("5 · Cada semana · 15 min", "Seguidores (una fila por semana) y Métricas de lo publicado hace 7 días."),
    ("6 · Fin de mes · 10 min", "Abre Cierre del mes: los números ya están. Escribe tu reflexión en la pestaña Año."),
]
r = 5
wi.cell(r, 2, "Cómo empezar").font = font(11, True, CIRUELA)
for a, b in pasos:
    r += 1
    wi.cell(r, 2, a).font = font(10, True)
    wi.cell(r, 3, b).font = font(10)
    wi.cell(r, 3).alignment = IZQ
    wi.row_dimensions[r].height = 34
    for c in (2, 3):
        wi.cell(r, c).border = BORDE_INF
r += 2
wi.cell(r, 2, "Pestañas").font = font(11, True, CIRUELA)
pestanas = [
    ("Configuración", "Tu nicho, plataformas, hábitos, pilares, mes y metas", "Una vez / al cambiar de mes"),
    ("Diario", "Hábitos, energía, horas creando, pantalla y sueño", "Diario"),
    ("Hábitos", "Tablero visual del mes con % por hábito y racha (automático)", "Solo mirar"),
    ("Ideas", "Banco de ideas con estado de producción", "Cada idea"),
    ("Calendario", "Calendario del mes armado con las fechas de Ideas (automático)", "Solo mirar"),
    ("Guiones", "Ficha de preproducción por pieza (Método Alquimia)", "Antes de grabar"),
    ("Métricas", "Resultados de cada pieza; la interacción se calcula sola", "Semanal"),
    ("Seguidores", "Seguidores por plataforma, semana a semana", "Semanal"),
    ("Registro", "Lives, productos o lugares, según tu nicho", "Cada vez"),
    ("Conversaciones", "Comentarios y DMs que se convierten en ideas", "Cuando aparezcan"),
    ("Colaboraciones", "Marcas, montos y estado de cada acuerdo", "Cada contacto"),
    ("Cierre del mes", "Todos tus números del mes elegido (automático)", "Fin de mes"),
    ("Año", "Comparativa mes a mes, por trimestre, y tu reflexión", "Fin de mes"),
]
r += 1
cabecera(wi, r, 2, ["Pestaña", "Qué hay", "Cada cuánto"])
for p in pestanas:
    r += 1
    for j, v in enumerate(p):
        c = wi.cell(r, 2 + j, v)
        c.font = font(10, bold=(j == 0))
        c.border = BORDE
        c.alignment = IZQ
r += 2
wi.cell(r, 2, "Colores").font = font(11, True, CIRUELA)
r += 1
wi.cell(r, 2, "").border = BORDE
wi.cell(r, 3, "Celda blanca: aquí escribes.").font = font(10)
r += 1
wi.cell(r, 2).fill = fill(LILA); wi.cell(r, 2).border = BORDE
wi.cell(r, 3, "Celda lila: se calcula sola. No la borres.").font = font(10)
r += 1
wi.cell(r, 2).fill = fill("EFEAF0"); wi.cell(r, 2).font = font(10, color="9A929C", italic=True)
wi.cell(r, 2, "Texto gris"); wi.cell(r, 2).border = BORDE
wi.cell(r, 3, "Sugerencia de tu nicho en Configuración: escribe encima para cambiarla.").font = font(10)

# ═══════════════════ Configuración ═══════════════════
wc = hoja("Configuración", ORO, {"A": 3, "B": 30, "C": 34, "D": 4, "E": 22, "F": 18})
titulo(wc, "Configuración", "Todo lo que cambies aquí se actualiza en las demás pestañas")
def fila_cfg(r, etiqueta, valor, sugerencia=False, fmt=None):
    wc.cell(r, 2, etiqueta).font = font(10, True)
    c = wc.cell(r, 3, valor)
    c.border = BORDE
    c.alignment = IZQ
    c.font = font(10, color="9A929C" if sugerencia else TINTA, italic=sugerencia)
    if fmt:
        c.number_format = fmt
    wc.row_dimensions[r].height = 22

wc["B5"] = "Tus datos"; wc["B5"].font = font(11, True, CIRUELA)
fila_cfg(6, "Nombre o @", "")
fila_cfg(7, "Año", "=YEAR(TODAY())", fmt="0")
fila_cfg(8, "Mes a revisar", "=INDEX(MESES,MONTH(TODAY()))")
fila_cfg(9, "Nicho", "General")
lista(wc, "C8", "=Nichos!$G$2:$G$13", "Mes que muestran Hábitos, Calendario y Cierre del mes")
lista(wc, "C9", "=Nichos!$B$1:$E$1", "Cambia las sugerencias de plataformas, hábitos y pilares")
# ayudas (columnas E-F)
wc["E5"] = "Cálculos (no tocar)"; wc["E5"].font = font(9, True, GRIS)
for rr, (et, fo, fmt) in enumerate([
        ("N.º de mes", "=MATCH(C8,MESES,0)", "0"),
        ("Inicio del mes", "=DATE(C7,F6,1)", "dd-mm-yyyy"),
        ("Fin del mes", "=EOMONTH(F7,0)", "dd-mm-yyyy"),
        ("Columna del nicho", "=MATCH(C9,Nichos!$B$1:$E$1,0)", "0"),
        ("Hábitos activos", '=COUNTIF(C17:C28,"?*")', "0")], start=6):
    wc.cell(rr, 5, et).font = font(9, color=GRIS)
    c = wc.cell(rr, 6, fo); c.fill = fill(LILA); c.font = font(9, color="5D5461"); c.number_format = fmt; c.border = BORDE
nombre("ANIO", "'Configuración'!$C$7")
nombre("MES_NUM", "'Configuración'!$F$6")
nombre("INICIO_MES", "'Configuración'!$F$7")
nombre("FIN_MES", "'Configuración'!$F$8")
nombre("NICHO_COL", "'Configuración'!$F$9")
nombre("N_HABITOS", "'Configuración'!$F$10")

def sug(fila_nicho):
    return f'=IFERROR(INDEX(Nichos!$B${fila_nicho}:$E${fila_nicho},NICHO_COL)&"","")'

wc["B11"] = "Plataformas"; wc["B11"].font = font(11, True, CIRUELA)
wc["C11"] = "Gris = sugerencia del nicho. Escribe encima."; wc["C11"].font = font(9, color=GRIS, italic=True)
for i in range(4):
    fila_cfg(12 + i, f"Plataforma {i+1}", sug(2 + i), sugerencia=True)
PLAT = "'Configuración'!$C$12:$C$15"
wc["B16"] = "Hábitos (hasta 12)"; wc["B16"].font = font(11, True, CIRUELA)
for i in range(12):
    fila_cfg(17 + i, f"Hábito {i+1}", sug(6 + i) if i < 8 else "", sugerencia=i < 8)
wc["B30"] = "Pilares de contenido"; wc["B30"].font = font(11, True, CIRUELA)
for i in range(6):
    fila_cfg(31 + i, f"Pilar {i+1}", sug(14 + i) if i < 4 else "", sugerencia=i < 4)
PILARES = "'Configuración'!$C$31:$C$36"
wc["B38"] = "Metas mensuales"; wc["B38"].font = font(11, True, CIRUELA)
metas = [("Piezas publicadas al mes", 12, "0"), ("Seguidores nuevos al mes", 300, "#,##0"),
         ("% de hábitos cumplidos", 0.8, "0%"), ("Ingresos por colaboraciones", 0, '"$"#,##0')]
for i, (et, v, fmt) in enumerate(metas):
    fila_cfg(39 + i, et, v, fmt=fmt)
wc["E11"] = "Formatos"; wc["E11"].font = font(11, True, CIRUELA)
for i, f in enumerate(FORMATOS):
    c = wc.cell(12 + i, 5, f); c.border = BORDE; c.font = font(10)
FORMATOS_R = "'Configuración'!$E$12:$E$21"

# ═══════════════════ Diario ═══════════════════
N_DIAS = 366
D1, D2 = 5, 5 + N_DIAS - 1
wd = hoja("Diario", CIRUELA)
titulo(wd, "Diario", "✓ hecho · ½ a medias · × no tocaba. Energía de 1 (agotada) a 5 (imparable). Una fila por día del año.")
cols_d = ["Fecha", "Día"] + [f"hab{i}" for i in range(12)] + ["Energía 1–5", "Horas creando", "Horas pantalla", "Horas sueño", "Nota del día", "% del día"]
cabecera(wd, 4, 1, cols_d, auto={1, 2, 20})
for i in range(12):   # encabezados de hábito vienen de Configuración
    wd.cell(4, 3 + i, f'=IF(\'Configuración\'!C{17+i}="","—",\'Configuración\'!C{17+i})')
zona(wd, D1, D2, 1, 20, auto={1, 2, 20}, fmt={1: "dd-mm", 20: "0%"})
for r in range(D1, D2 + 1):
    n = r - D1
    wd.cell(r, 1, f"=IF(YEAR(DATE(ANIO,1,1)+{n})=ANIO,DATE(ANIO,1,1)+{n},\"\")")
    wd.cell(r, 2, f'=IF(A{r}="","",CHOOSE(WEEKDAY(A{r},2),"Lun","Mar","Mié","Jue","Vie","Sáb","Dom"))')
    wd.cell(r, 20, f'=IF(COUNTA(C{r}:N{r})=0,"",IFERROR((COUNTIF(C{r}:N{r},"✓")+0.5*COUNTIF(C{r}:N{r},"½"))/(N_HABITOS-COUNTIF(C{r}:N{r},"×")),""))')
    for c in range(3, 15):
        wd.cell(r, c).alignment = CENTRO
    # rachas (columnas ocultas V:AG)
    for i in range(12):
        col = L(3 + i); hc = L(22 + i)
        wd.cell(r, 22 + i, f'=IF({col}{r}="✓",N({hc}{r-1})+1,IF({col}{r}="×",N({hc}{r-1}),0))')
for i in range(12):
    wd.cell(4, 22 + i, f"Racha {i+1}")
    wd.column_dimensions[L(22 + i)].hidden = True
lista(wd, f"C{D1}:N{D2}", "=Nichos!$K$2:$K$4")
dv = DataValidation(type="whole", operator="between", formula1="1", formula2="5", allow_blank=True)
wd.add_data_validation(dv); dv.add(f"O{D1}:O{D2}")
wd.column_dimensions["A"].width = 8; wd.column_dimensions["B"].width = 6
for i in range(12):
    wd.column_dimensions[L(3 + i)].width = 11
for c, w in zip("OPQRST", [9, 9, 9, 9, 28, 8]):
    wd.column_dimensions[c].width = w
wd.freeze_panes = "C5"
rng = f"C{D1}:N{D2}"
wd.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"✓"'], fill=fill(CIRUELA), font=Font(color="FFFFFF", bold=True)))
wd.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"½"'], fill=fill("CDB8D1"), font=Font(color=TINTA)))
wd.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"×"'], fill=fill("EEEEEE"), font=Font(color="9A929C")))
wd.conditional_formatting.add(f"A{D1}:B{D2}", FormulaRule(formula=[f"WEEKDAY($A{D1},2)>5"], font=Font(color=ORO, bold=True)))
wd.conditional_formatting.add(f"A{D1}:T{D2}", FormulaRule(formula=[f"$A{D1}=TODAY()"], fill=fill("FFF4D6")))
wd.conditional_formatting.add(f"O{D1}:O{D2}", ColorScaleRule(start_type="num", start_value=1, start_color="F3EEF3", end_type="num", end_value=5, end_color="B08DB8"))

# Rangos del Diario para otras fórmulas
DA = f"Diario!$A${D1}:$A${D2}"
DH = f"Diario!$C${D1}:$N${D2}"
DE = f"Diario!$O${D1}:$O${D2}"

# ═══════════════════ Hábitos (tablero) ═══════════════════
wh = hoja("Hábitos", CIRUELA)
titulo(wh, "Habit Tracker", "Se llena solo desde Diario. Cambia el mes en Configuración. El % cuenta solo los días que ya pasaron.")
wh["B4"] = '=UPPER(\'Configuración\'!C8)&"  "&ANIO'
wh["B4"].font = font(12, True, CIRUELA)
wh.column_dimensions["A"].width = 3
wh.column_dimensions["B"].width = 24
for d in range(31):
    col = 3 + d
    wh.column_dimensions[L(col)].width = 3.6
    c = wh.cell(6, col, d + 1); c.font = font(8, True, CIRUELA); c.alignment = CENTRO
    c = wh.cell(7, col, f'=IF({d+1}>DAY(FIN_MES),"",MID("LMXJVSD",WEEKDAY(DATE(ANIO,MES_NUM,{d+1}),2),1))')
    c.font = font(7, color=GRIS); c.alignment = CENTRO
for j, t in enumerate(["Hechos", "Posibles", "% mes", "Racha máx."]):
    c = wh.cell(6, 34 + j, t); c.font = font(8, True, CIRUELA); c.alignment = CENTRO
    wh.column_dimensions[L(34 + j)].width = 9
wh.cell(6, 2, "Hábito").font = font(8, True, CIRUELA)
for i in range(12):
    r = 8 + i
    wh.row_dimensions[r].height = 22
    nm = wh.cell(r, 2, f'=\'Configuración\'!C{17+i}&""'); nm.font = font(10); nm.border = BORDE_INF
    for d in range(31):
        col = 3 + d
        c = wh.cell(r, col, f'=IF(OR($B{r}="",{d+1}>DAY(FIN_MES)),"",IFERROR(INDEX({DH},MATCH(DATE(ANIO,MES_NUM,{d+1}),{DA},0),{i+1})&"",""))')
        c.alignment = CENTRO; c.font = font(9, color=GRIS); c.border = Border(bottom=fino, right=Side(style="hair", color=LINEA))
    a, b = L(3), L(33)
    hc = L(22 + i)
    for j, f in enumerate([
            f'=IF($B{r}="","",COUNTIF({a}{r}:{b}{r},"✓")+0.5*COUNTIF({a}{r}:{b}{r},"½"))',
            f'=IF($B{r}="","",MAX(0,MIN(FIN_MES,TODAY())-INICIO_MES+1)-COUNTIF({a}{r}:{b}{r},"×"))',
            f'=IF(OR($B{r}="",AJ{r}=0),"",AH{r}/AJ{r})'.replace("AH", "AH").replace("AJ", "AI"),
            f'=IF($B{r}="","",SUMPRODUCT(MAX(({DA}<>"")*({DA}>=INICIO_MES)*({DA}<=FIN_MES)*Diario!${hc}${D1}:${hc}${D2})))']):
        c = wh.cell(r, 34 + j, f); c.fill = fill(LILA); c.alignment = CENTRO; c.font = font(10, j == 2); c.border = BORDE
    wh.cell(r, 36).number_format = "0%"
# fila de energía y total
r = 21
wh.cell(r, 2, "Energía del día").font = font(9, True, CIRUELA)
for d in range(31):
    c = wh.cell(r, 3 + d, f'=IF({d+1}>DAY(FIN_MES),"",IFERROR(1/(1/INDEX({DE},MATCH(DATE(ANIO,MES_NUM,{d+1}),{DA},0))),""))')
    c.alignment = CENTRO; c.font = font(8, color=CIRUELA)
wh.cell(23, 2, "% del mes (todos los hábitos)").font = font(10, True)
wh["AH23"] = '=IFERROR(SUM(AH8:AH19)/SUM(AI8:AI19),"")'
wh.merge_cells("AH23:AJ23"); wh["AH23"].number_format = "0%"
wh["AH23"].font = font(14, True, CIRUELA); wh["AH23"].fill = fill(LILA); wh["AH23"].alignment = CENTRO
rng = "C8:AG19"
wh.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"✓"'], fill=fill(CIRUELA), font=Font(color=CIRUELA)))
wh.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"½"'], fill=fill("CDB8D1"), font=Font(color="CDB8D1")))
wh.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"×"'], font=Font(color="B5ADB7")))
wh.conditional_formatting.add("AJ8:AJ19", ColorScaleRule(start_type="num", start_value=0, start_color="FFFFFF", end_type="num", end_value=1, end_color="C9B3CE"))
wh.conditional_formatting.add("C21:AG21", ColorScaleRule(start_type="num", start_value=1, start_color="FFFFFF", end_type="num", end_value=5, end_color="C9B3CE"))
wh.freeze_panes = "C8"

# ═══════════════════ Ideas ═══════════════════
I1, I2 = 5, 304
wid = hoja("Ideas", "4B6A8A", {"A": 7, "B": 44, "C": 22, "D": 13, "E": 13, "F": 12, "G": 12, "H": 10, "I": 26, "J": 28})
titulo(wid, "Banco de ideas", "Mueve el estado de Idea a Publicado. Con fecha de publicación, la pieza aparece sola en el Calendario.")
cabecera(wid, 4, 1, ["ID", "Idea / gancho", "Pilar", "Formato", "Plataforma", "Estado", "Fecha publ.", "Avance", "Link", "Notas"], auto={1, 8})
zona(wid, I1, I2, 1, 10, auto={1, 8}, fmt={7: "dd-mm-yyyy"})
for r in range(I1, I2 + 1):
    wid.cell(r, 1, f'=IF(B{r}="","","P"&TEXT(ROW()-4,"000"))')
    wid.cell(r, 8, f'=IF(F{r}="","",REPT("●",MATCH(F{r},ESTADOS,0))&REPT("○",5-MATCH(F{r},ESTADOS,0)))')
    wid.cell(r, 8).font = font(10, color=CIRUELA)
lista(wid, f"C{I1}:C{I2}", f"={PILARES}")
lista(wid, f"D{I1}:D{I2}", f"={FORMATOS_R}")
lista(wid, f"E{I1}:E{I2}", f"={PLAT}")
lista(wid, f"F{I1}:F{I2}", "=Nichos!$H$2:$H$6")
for est, col in [("Publicado", "E3EFE3"), ("Editado", "EEF0F8"), ("Grabado", "F6F0E6"), ("Guion", "F7EEF2")]:
    wid.conditional_formatting.add(f"A{I1}:J{I2}", FormulaRule(formula=[f'$F{I1}="{est}"'], fill=fill(col)))
wid.freeze_panes = "C5"
IA, IB, IE, IF_, IG = (f"Ideas!${c}${I1}:${c}${I2}" for c in "ABEFG")
ID_C = f"Ideas!$C${I1}:$C${I2}"
ID_D = f"Ideas!$D${I1}:$D${I2}"

# ═══════════════════ Calendario ═══════════════════
wk = hoja("Calendario", "4B6A8A", {"A": 3})
titulo(wk, "Calendario de contenido", "Automático: muestra las piezas de Ideas según su fecha de publicación. ✓ = publicada.")
wk["B4"] = '=UPPER(\'Configuración\'!C8)&"  "&ANIO'
wk["B4"].font = font(12, True, CIRUELA)
for j, d in enumerate(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]):
    wk.column_dimensions[L(2 + j)].width = 21
    c = wk.cell(6, 2 + j, d); c.font = font(9, True, "FFFFFF"); c.fill = fill(CIRUELA); c.alignment = CENTRO
for w in range(6):
    rn, rc = 7 + w * 2, 8 + w * 2
    wk.row_dimensions[rn].height = 18
    wk.row_dimensions[rc].height = 74
    for j in range(7):
        col = 2 + j
        cn = wk.cell(rn, col, f"=INICIO_MES-WEEKDAY(INICIO_MES,2)+1+{w*7+j}")
        cn.number_format = "d"; cn.font = font(10, True, CIRUELA); cn.alignment = Alignment(horizontal="left", vertical="top")
        cn.border = Border(left=fino, right=fino, top=fino)
        ref = f"{L(col)}{rn}"
        f = (f'=_xlfn.TEXTJOIN(CHAR(10),TRUE,IF({IG}={ref},{IE}&" · "&{IB}&IF({IF_}="Publicado"," ✓",""),""))')
        wk.cell(rc, col).value = ArrayFormula(f"{L(col)}{rc}", f)
        cc = wk.cell(rc, col); cc.font = font(8); cc.alignment = ARRIBA
        cc.border = Border(left=fino, right=fino, bottom=fino)
wk.conditional_formatting.add("B7:H18", FormulaRule(formula=["AND(ISNUMBER(B7),MONTH(B7)<>MES_NUM)"], font=Font(color="C9C1CB")))
wk.conditional_formatting.add("B7:H18", FormulaRule(formula=["B7=TODAY()"], fill=fill("FFF4D6")))
# resumen por plataforma
r0 = 20
wk.cell(r0, 2, "Piezas del mes").font = font(11, True, CIRUELA)
cabecera(wk, r0 + 1, 2, ["Plataforma", "Programadas", "Publicadas"])
for i in range(4):
    r = r0 + 2 + i
    wk.cell(r, 2, f"='Configuración'!C{12+i}&\"\"")
    wk.cell(r, 3, f'=IF(B{r}="","",COUNTIFS({IE},B{r},{IG},">="&INICIO_MES,{IG},"<="&FIN_MES))')
    wk.cell(r, 4, f'=IF(B{r}="","",COUNTIFS({IE},B{r},{IG},">="&INICIO_MES,{IG},"<="&FIN_MES,{IF_},"Publicado"))')
zona(wk, r0 + 2, r0 + 5, 2, 4, auto={2, 3, 4})

# ═══════════════════ Guiones ═══════════════════
G1, G2 = 5, 104
wg = hoja("Guiones", "4B6A8A")
titulo(wg, "Ficha de pieza", "Método Alquimia: define la historia antes de grabar. Elige el ID de la idea y completa la fila.")
cols_g = ["ID", "Idea (auto)", "A quién le hablo", "Héroe y conflicto", "Gancho · 3 seg", "Inicio", "Nudo", "Final",
          "Transformación (antes → después)", "Llamado a la acción", "Palabras clave", "Texto en pantalla · audio · recursos", "Etapa del embudo"]
cabecera(wg, 4, 1, cols_g, auto={2})
zona(wg, G1, G2, 1, 13, auto={2})
for r in range(G1, G2 + 1):
    wg.cell(r, 2, f'=IF(A{r}="","",IFERROR(INDEX({IB},MATCH(A{r},{IA},0)),""))')
    wg.row_dimensions[r].height = 48
    for c in range(1, 14):
        wg.cell(r, c).alignment = ARRIBA
lista(wg, f"A{G1}:A{G2}", f"=Ideas!$A${I1}:$A${I2}")
lista(wg, f"M{G1}:M{G2}", "=Nichos!$J$2:$J$5")
for c, w in zip("ABCDEFGHIJKLM", [7, 26, 20, 24, 24, 22, 22, 22, 24, 20, 18, 26, 12]):
    wg.column_dimensions[c].width = w
wg.freeze_panes = "C5"

# ═══════════════════ Métricas ═══════════════════
M1, M2 = 5, 404
wm = hoja("Métricas", "4B6A8A")
titulo(wm, "Métricas de contenido", "Anota cada pieza 7 días después de publicarla. Si eliges el ID, pieza, plataforma, formato y pilar se completan solos.")
cols_m = ["Fecha", "ID", "Pieza", "Plataforma", "Formato", "Pilar", "Vistas", "Retención %", "Me gusta",
          "Coment.", "Guardados", "Compart.", "Seguidores +", "Interacción %"]
cabecera(wm, 4, 1, cols_m, auto={14})
zona(wm, M1, M2, 1, 14, auto={14}, fmt={1: "dd-mm-yyyy", 7: "#,##0", 8: "0%", 14: "0.0%"})
for r in range(M1, M2 + 1):
    look = lambda rng: f'=IF($B{r}="","",IFERROR(INDEX({rng},MATCH($B{r},{IA},0))&"",""))'
    wm.cell(r, 3, look(IB)); wm.cell(r, 4, look(IE)); wm.cell(r, 5, look(ID_D)); wm.cell(r, 6, look(ID_C))
    for c in (3, 4, 5, 6):
        wm.cell(r, c).font = font(10, color="5D5461")
    wm.cell(r, 14, f'=IF(N(G{r})=0,"",(N(I{r})+N(J{r})+N(K{r})+N(L{r}))/G{r})')
lista(wm, f"B{M1}:B{M2}", f"=Ideas!$A${I1}:$A${I2}")
lista(wm, f"D{M1}:D{M2}", f"={PLAT}")
lista(wm, f"E{M1}:E{M2}", f"={FORMATOS_R}")
lista(wm, f"F{M1}:F{M2}", f"={PILARES}")
for c, w in zip("ABCDEFGHIJKLMN", [11, 7, 34, 12, 11, 20, 10, 10, 10, 9, 10, 10, 11, 11]):
    wm.column_dimensions[c].width = w
wm.conditional_formatting.add(f"N{M1}:N{M2}", ColorScaleRule(start_type="min", start_color="FFFFFF", end_type="max", end_color="B08DB8"))
wm.freeze_panes = "D5"
MA, MB, MC, MD, MG, MN = (f"Métricas!${c}${M1}:${c}${M2}" for c in "ABCDGN")

# ═══════════════════ Seguidores ═══════════════════
S1, S2 = 5, 60
ws_ = hoja("Seguidores", "8A6A4B")
titulo(ws_, "Crecimiento de comunidad", "Una fila por semana, mismo día y hora. Las variaciones y el gráfico se calculan solos.")
cab_s = ["Fecha"] + [f"=IF('Configuración'!C{12+i}=\"\",\"—\",'Configuración'!C{12+i})" for i in range(4)] \
        + [f"=\"Var. \"&IF('Configuración'!C{12+i}=\"\",\"—\",'Configuración'!C{12+i})" for i in range(4)] + ["Total", "Var. total"]
cabecera(ws_, 4, 1, cab_s, auto={6, 7, 8, 9, 10, 11})
zona(ws_, S1, S2, 1, 11, auto={6, 7, 8, 9, 10, 11}, fmt={1: "dd-mm-yyyy", **{c: "#,##0" for c in range(2, 12)}})
for r in range(S1, S2 + 1):
    for i in range(4):
        c, v = L(2 + i), 6 + i
        ws_.cell(r, v, f'=IF(OR(N({c}{r})=0,N({c}{r-1})=0),"",{c}{r}-{c}{r-1})' if r > S1 else "")
    ws_.cell(r, 10, f'=IF(COUNT(B{r}:E{r})=0,"",SUM(B{r}:E{r}))')
    ws_.cell(r, 11, f'=IF(COUNT(F{r}:I{r})=0,"",SUM(F{r}:I{r}))')
for c, w in zip("ABCDEFGHIJK", [12, 12, 12, 12, 12, 13, 13, 13, 13, 11, 11]):
    ws_.column_dimensions[c].width = w
ws_.freeze_panes = "B5"
ch = LineChart(); ch.title = "Seguidores por plataforma"; ch.height = 8; ch.width = 18
ch.add_data(Reference(ws_, min_col=2, max_col=5, min_row=4, max_row=S2), titles_from_data=True)
ch.set_categories(Reference(ws_, min_col=1, min_row=S1, max_row=S2))
ch.y_axis.title = "Seguidores"
ws_.add_chart(ch, "M4")
SA = f"Seguidores!$A${S1}:$A${S2}"

# ═══════════════════ Registro (según nicho) ═══════════════════
R1, R2 = 5, 204
wr = hoja("Registro", "8A6A4B")
titulo(wr, "Registro", "")
wr["B2"] = '=INDEX(Nichos!$B$18:$E$18,NICHO_COL)'
wr["B3"] = "Las columnas cambian según el nicho que elegiste en Configuración."
wr["B3"].font = font(9, color=GRIS, italic=True, name=F_SERIF)
cabecera(wr, 4, 1, [f"=INDEX(Nichos!$B${19+i}:$E${19+i},NICHO_COL)" for i in range(8)])
zona(wr, R1, R2, 1, 8, fmt={1: "dd-mm-yyyy"})
for c, w in zip("ABCDEFGH", [12, 22, 20, 14, 16, 14, 16, 16]):
    wr.column_dimensions[c].width = w
wr.freeze_panes = "A5"
RA, RE = f"Registro!$A${R1}:$A${R2}", f"Registro!$D${R1}:$D${R2}"

# ═══════════════════ Conversaciones ═══════════════════
C1, C2 = 5, 204
wv = hoja("Conversaciones", "8A6A4B", {"A": 12, "B": 13, "C": 46, "D": 10, "E": 46, "F": 11})
titulo(wv, "Conversaciones que valen oro", "Si una pregunta se repite 3 veces, es una pieza esperando a ser grabada (se marca sola en dorado).")
cabecera(wv, 4, 1, ["Fecha", "Dónde", "Lo que me dijeron / preguntaron", "Veces", "Idea de contenido que sale de aquí", "¿En Ideas?"])
zona(wv, C1, C2, 1, 6, fmt={1: "dd-mm-yyyy"})
lista(wv, f"B{C1}:B{C2}", f"={PLAT}")
lista(wv, f"F{C1}:F{C2}", "=Nichos!$K$2:$K$2")
wv.conditional_formatting.add(f"A{C1}:F{C2}", FormulaRule(formula=[f"AND(N($D{C1})>=3,$F{C1}<>\"✓\")"], fill=fill("F6EBD3")))
wv.freeze_panes = "A5"

# ═══════════════════ Colaboraciones ═══════════════════
K1, K2 = 5, 154
wl = hoja("Colaboraciones", "8A6A4B", {"A": 22, "B": 22, "C": 12, "D": 34, "E": 12, "F": 18, "G": 12, "H": 30})
titulo(wl, "Colaboraciones y marcas", "Los ingresos cuentan en el mes de la fecha de entrega, cuando el estado es Entregada y pagada.")
cabecera(wl, 4, 1, ["Marca / creador", "Contacto", "Fecha contacto", "Propuesta", "Monto", "Estado", "Fecha entrega", "Notas"])
zona(wl, K1, K2, 1, 8, fmt={3: "dd-mm-yyyy", 5: '"$"#,##0', 7: "dd-mm-yyyy"})
lista(wl, f"F{K1}:F{K2}", "=Nichos!$I$2:$I$6")
for est, col in [("Entregada y pagada", "E3EFE3"), ("Confirmada", "EEF0F8"), ("En negociación", "F6F0E6"), ("Rechazada", "EEEEEE")]:
    wl.conditional_formatting.add(f"A{K1}:H{K2}", FormulaRule(formula=[f'$F{K1}="{est}"'], fill=fill(col)))
wl.freeze_panes = "A5"
LC, LE, LF, LG = (f"Colaboraciones!${c}${K1}:${c}${K2}" for c in "CEFG")

# ═══════════════════ Año ═══════════════════
wa = hoja("Año", ORO)
titulo(wa, "Mi año", "Mes a mes y por trimestre. Las columnas lila se calculan solas; escribe tu reflexión al cerrar cada mes.")
cols_a = ["Mes", "Piezas publicadas", "Vistas", "Interacción %", "Seguidores nuevos", "% hábitos", "Energía prom.",
          "=INDEX(Nichos!$B$27:$E$27,NICHO_COL)", "Colaboraciones", "Ingresos", "Sigo", "Ajusto", "Suelto"]
cabecera(wa, 5, 1, cols_a, auto=set(range(1, 11)))
A1_ = 6
for m in range(12):
    r = A1_ + m
    ini, fin = f"DATE(ANIO,{m+1},1)", f"EOMONTH(DATE(ANIO,{m+1},1),0)"
    rango_mes = lambda col: f'{col},">="&{ini},{col},"<="&{fin}'
    mask = f"({DA}<>\"\")*({DA}>={ini})*({DA}<={fin})"
    hechos = f'(SUMPRODUCT({mask}*({DH}="✓"))+0.5*SUMPRODUCT({mask}*({DH}="½")))'
    posibles = f'(MAX(0,MIN({fin},TODAY())-{ini}+1)*N_HABITOS-SUMPRODUCT({mask}*({DH}="×")))'
    marcas = f'SUMPRODUCT({mask}*({DH}<>""))'
    vals = [
        MESES[m],
        f'=COUNTIFS({IF_},"Publicado",{rango_mes(IG)})',
        f'=SUMIFS({MG},{rango_mes(MA)})',
        f'=IFERROR(AVERAGEIFS({MN},{rango_mes(MA)}),"")',
        f'=SUMIFS(Seguidores!$K${S1}:$K${S2},{rango_mes(SA)})',
        f'=IF({marcas}=0,"",IFERROR({hechos}/{posibles},""))',
        f'=IFERROR(AVERAGEIFS({DE},{rango_mes(DA)}),"")',
        f'=IF(INDEX(Nichos!$B$28:$E$28,NICHO_COL)="suma",SUMIFS({RE},{rango_mes(RA)}),COUNTIFS({rango_mes(RA)}))',
        f'=COUNTIFS({LF},"Confirmada",{rango_mes(LC)})+COUNTIFS({LF},"Entregada y pagada",{rango_mes(LC)})',
        f'=SUMIFS({LE},{LF},"Entregada y pagada",{rango_mes(LG)})',
    ]
    for j, v in enumerate(vals):
        wa.cell(r, 1 + j, v)
zona(wa, A1_, A1_ + 11, 1, 13, auto=set(range(1, 11)),
     fmt={3: "#,##0", 4: "0.0%", 5: "#,##0", 6: "0%", 7: "0.0", 8: "0.0", 10: '"$"#,##0'})
for r in range(A1_, A1_ + 12):
    wa.row_dimensions[r].height = 30
    wa.cell(r, 1).font = font(10, True)
wa.conditional_formatting.add(f"A{A1_}:M{A1_+11}", FormulaRule(formula=[f"ROW()-{A1_-1}=MES_NUM"], font=Font(bold=True, color=CIRUELA)))
# trimestres
T0 = A1_ + 13
cabecera(wa, T0, 1, ["Trimestre", "Piezas", "Vistas", "Interacción %", "Seguidores nuevos", "% hábitos", "Energía prom.",
                     "=INDEX(Nichos!$B$27:$E$27,NICHO_COL)", "Colaboraciones", "Ingresos"])
for q in range(4):
    r = T0 + 1 + q
    a, b = A1_ + q * 3, A1_ + q * 3 + 2
    wa.cell(r, 1, f"T{q+1} · {MESES[q*3][:3]}–{MESES[q*3+2][:3]}")
    for j, col in enumerate("BCDEFGHIJ"):
        prom = col in "DFG"
        f = f'=IFERROR(AVERAGE({col}{a}:{col}{b}),"")' if prom else f"=SUM({col}{a}:{col}{b})"
        wa.cell(r, 2 + j, f)
r = T0 + 5
wa.cell(r, 1, "Total año")
for j, col in enumerate("BCDEFGHIJ"):
    prom = col in "DFG"
    wa.cell(r, 2 + j, f'=IFERROR(AVERAGE({col}{A1_}:{col}{A1_+11}),"")' if prom else f"=SUM({col}{A1_}:{col}{A1_+11})")
zona(wa, T0 + 1, T0 + 5, 1, 10, auto=set(range(1, 11)),
     fmt={3: "#,##0", 4: "0.0%", 5: "#,##0", 6: "0%", 7: "0.0", 8: "0.0", 10: '"$"#,##0'})
for c in range(1, 11):
    wa.cell(T0 + 5, c).font = font(10, True, CIRUELA)
for c, w in zip("ABCDEFGHIJKLM", [16, 11, 12, 12, 12, 10, 10, 12, 13, 12, 30, 30, 30]):
    wa.column_dimensions[c].width = w
wa.freeze_panes = "B6"
for col, t, ancla in [(3, "Vistas por mes", "B26"), (5, "Seguidores nuevos por mes", "H26")]:
    bc = BarChart(); bc.title = t; bc.height = 7.5; bc.width = 15; bc.legend = None
    bc.add_data(Reference(wa, min_col=col, min_row=5, max_row=A1_ + 11), titles_from_data=True)
    bc.set_categories(Reference(wa, min_col=1, min_row=A1_, max_row=A1_ + 11))
    wa.add_chart(bc, ancla)

# ═══════════════════ Cierre del mes ═══════════════════
wz = hoja("Cierre del mes", ORO, {"A": 3, "B": 22, "C": 16, "D": 3, "E": 22, "F": 16, "G": 3, "H": 22, "I": 16})
titulo(wz, "Cierre del mes", "Automático. Cambia el mes en Configuración para ver otro.")
wz["B4"] = '=UPPER(\'Configuración\'!C8)&"  "&ANIO'
wz["B4"].font = font(13, True, CIRUELA)
def kpi(celda_lab, celda_val, etiqueta, formula, fmt="#,##0", meta=None):
    c = wz[celda_lab]; c.value = etiqueta; c.font = font(8, True, GRIS); c.alignment = IZQ
    v = wz[celda_val]; v.value = formula; v.number_format = fmt
    v.font = Font(name=F_SERIF, size=26, bold=True, color=CIRUELA); v.alignment = IZQ
    if meta:
        mc = wz.cell(v.row + 1, v.column - 1, meta); mc.font = font(8, color=GRIS, italic=True)
ROW_A = f"{A1_-1}+MES_NUM"
idx = lambda col: f'=INDEX(Año!${col}${A1_}:${col}${A1_+11},MES_NUM)'
cards = [
    ("B6", "B7", "PIEZAS PUBLICADAS", idx("B"), "0", '="Meta: "&\'Configuración\'!C39&"  ·  "&IFERROR(TEXT(B7/\'Configuración\'!C39,"0%"),"—")'),
    ("E6", "E7", "VISTAS", idx("C"), "#,##0", None),
    ("H6", "H7", "INTERACCIÓN PROMEDIO", idx("D"), "0.0%", None),
    ("B10", "B11", "SEGUIDORES NUEVOS", idx("E"), "#,##0", '="Meta: "&TEXT(\'Configuración\'!C40,"#,##0")&"  ·  "&IFERROR(TEXT(B11/\'Configuración\'!C40,"0%"),"—")'),
    ("E10", "E11", "HÁBITOS CUMPLIDOS", idx("F"), "0%", '="Meta: "&TEXT(\'Configuración\'!C41,"0%")'),
    ("H10", "H11", "ENERGÍA PROMEDIO", idx("G"), "0.0", None),
    ("B14", "B15", "=UPPER(INDEX(Nichos!$B$27:$E$27,NICHO_COL))", idx("H"), "0.0", None),
    ("E14", "E15", "COLABORACIONES", idx("I"), "0", None),
    ("H14", "H15", "INGRESOS", idx("J"), '"$"#,##0', '="Meta: "&TEXT(\'Configuración\'!C42,"$#,##0")'),
]
for lab, val, et, f, fmt, meta in cards:
    kpi(lab, val, et, f, fmt)
    if meta:
        mc = wz.cell(wz[val].row + 1, wz[val].column, meta); mc.font = font(8, color=GRIS, italic=True)
    for rr in range(wz[lab].row, wz[lab].row + 3):
        for cc in (wz[lab].column, wz[lab].column + 1):
            wz.cell(rr, cc).fill = fill(LILA)
    wz.row_dimensions[wz[val].row].height = 36
# por plataforma
P0 = 19
wz.cell(P0, 2, "Por plataforma").font = font(11, True, CIRUELA)
cabecera(wz, P0 + 1, 2, ["Plataforma", "Publicadas", "", "Vistas", "Interacción %", "", "Seguidores nuevos"])
for i in range(4):
    r = P0 + 2 + i
    sc = L(6 + i)  # columna de variación en Seguidores (F..I)
    wz.cell(r, 2, f"='Configuración'!C{12+i}&\"\"")
    wz.cell(r, 3, f'=IF(B{r}="","",COUNTIFS({IE},B{r},{IF_},"Publicado",{IG},">="&INICIO_MES,{IG},"<="&FIN_MES))')
    wz.cell(r, 5, f'=IF(B{r}="","",SUMIFS({MG},{MD},B{r},{MA},">="&INICIO_MES,{MA},"<="&FIN_MES))')
    wz.cell(r, 6, f'=IF(B{r}="","",IFERROR(AVERAGEIFS({MN},{MD},B{r},{MA},">="&INICIO_MES,{MA},"<="&FIN_MES),""))')
    wz.cell(r, 8, f'=IF(B{r}="","",SUMIFS(Seguidores!${sc}${S1}:${sc}${S2},{SA},">="&INICIO_MES,{SA},"<="&FIN_MES))')
zona(wz, P0 + 2, P0 + 5, 2, 8, auto={2, 3, 5, 6, 8}, fmt={5: "#,##0", 6: "0.0%", 8: "#,##0"})
for r in range(P0 + 2, P0 + 6):
    for c in (4, 7):
        wz.cell(r, c).fill = PatternFill(); wz.cell(r, c).border = Border()
bc = BarChart(); bc.title = "Vistas por plataforma"; bc.height = 6.5; bc.width = 13; bc.legend = None
bc.add_data(Reference(wz, min_col=5, min_row=P0 + 1, max_row=P0 + 5), titles_from_data=True)
bc.set_categories(Reference(wz, min_col=2, min_row=P0 + 2, max_row=P0 + 5))
wz.add_chart(bc, "K4")
# top 3
T3 = P0 + 8
wz.cell(T3, 2, "Top 3 piezas del mes (por vistas)").font = font(11, True, CIRUELA)
cabecera(wz, T3 + 1, 2, ["Vistas", "Pieza", "", "", "Plataforma", "", "Interacción %"])
cond = f"({MA}>=INICIO_MES)*({MA}<=FIN_MES)"
for k in range(3):
    r = T3 + 2 + k
    wz.cell(r, 2).value = ArrayFormula(f"B{r}", f'=IFERROR(LARGE(IF({cond}*({MG}<>""),{MG}),{k+1}),"")')
    pos = f'MATCH(1,{cond}*({MG}=B{r}),0)'
    wz.cell(r, 3).value = ArrayFormula(f"C{r}", f'=IF(B{r}="","",IFERROR(INDEX({MC},{pos}),""))')
    wz.cell(r, 6).value = ArrayFormula(f"F{r}", f'=IF(B{r}="","",IFERROR(INDEX({MD},{pos}),""))')
    wz.cell(r, 8).value = ArrayFormula(f"H{r}", f'=IF(B{r}="","",IFERROR(INDEX({MN},{pos}),""))')
    wz.merge_cells(f"C{r}:E{r}")
zona(wz, T3 + 2, T3 + 4, 2, 8, auto={2, 3, 4, 5, 6, 8}, fmt={2: "#,##0", 8: "0.0%"})
for r in range(T3 + 2, T3 + 5):
    wz.cell(r, 7).fill = PatternFill(); wz.cell(r, 7).border = Border()
# reflexión (espejo de Año)
RF = T3 + 7
wz.cell(RF, 2, "Reflexión del mes · se escribe en la pestaña Año").font = font(11, True, CIRUELA)
for j, (t, col) in enumerate([("Sigo", "K"), ("Ajusto", "L"), ("Suelto", "M")]):
    c0 = 2 + j * 3
    h = wz.cell(RF + 1, c0, t); h.font = Font(name=F_TITULO, size=20, color=CIRUELA)
    v = wz.cell(RF + 2, c0, f'=INDEX(Año!${col}${A1_}:${col}${A1_+11},MES_NUM)&""')
    wz.merge_cells(start_row=RF + 2, start_column=c0, end_row=RF + 2, end_column=c0 + 1)
    v.alignment = ARRIBA; v.fill = fill(LILA); v.font = font(10)
wz.row_dimensions[RF + 2].height = 80

# ═══════════════════ Orden de pestañas ═══════════════════
orden = ["Inicio", "Configuración", "Diario", "Hábitos", "Ideas", "Calendario", "Guiones", "Métricas",
         "Seguidores", "Registro", "Conversaciones", "Colaboraciones", "Cierre del mes", "Año", "Nichos"]
wb._sheets = [wb[n] for n in orden]
wb.active = 0

# ═══════════════════ Datos de ejemplo (solo demo) ═══════════════════
if DEMO:
    hoy = datetime.date.today()
    wc["C7"] = hoy.year
    wc["C8"] = MESES[hoy.month - 1]
    wc["C9"] = "Gamer"
    import random
    random.seed(7)
    ini = datetime.date(hoy.year, hoy.month, 1)
    for d in range(hoy.day):
        r = D1 + (ini - datetime.date(hoy.year, 1, 1)).days + d
        for c in range(3, 11):
            wd.cell(r, c, random.choice(["✓", "✓", "✓", "½", "×", None]))
        wd.cell(r, 15, random.randint(2, 5)); wd.cell(r, 16, random.choice([2, 3, 4])); wd.cell(r, 18, random.choice([6, 7, 8]))
    ideas = [("Reacciono a mi primer live", "Clips y momentos del live", "Clip", "TikTok", "Publicado", 2),
             ("Mi setup por menos de $300 mil", "Setup y detrás de cámara", "Video largo", "YouTube", "Publicado", 5),
             ("3 juegos indie para este mes", "Gameplay con opinión", "Short", "YouTube", "Editado", 9),
             ("Así se arma un torneo en Discord", "Comunidad y Discord", "Reel", "Instagram", "Guion", 12),
             ("Mi peor partida", "Clips y momentos del live", "Clip", "TikTok", "Publicado", 5)]
    for i, (b, c, d, e, f, dia) in enumerate(ideas):
        r = I1 + i
        for col, v in zip("BCDEF", (b, c, d, e, f)):
            wid[f"{col}{r}"] = v
        wid[f"G{r}"] = datetime.date(hoy.year, hoy.month, min(dia, 28)); wid[f"G{r}"].number_format = "dd-mm-yyyy"
    for i, (pid, dia, vistas, lk, cm, gu, co, seg) in enumerate([("P001", 3, 12500, 900, 80, 140, 60, 45),
                                                                ("P002", 6, 4300, 310, 52, 95, 20, 30),
                                                                ("P005", 6, 8800, 640, 41, 30, 75, 22)]):
        r = M1 + i
        wm[f"A{r}"] = datetime.date(hoy.year, hoy.month, dia); wm[f"B{r}"] = pid
        for col, v in zip("GIJKLM", (vistas, lk, cm, gu, co, seg)):
            wm[f"{col}{r}"] = v
        wm[f"H{r}"] = 0.42
    base = [1200, 3400, 2100, 800]
    for w in range(4):
        r = S1 + w
        ws_[f"A{r}"] = ini + datetime.timedelta(days=7 * w - 7)
        for i in range(4):
            ws_.cell(r, 2 + i, base[i] + w * (30 + i * 15))
    wr["A5"] = ini; wr["B5"] = "Kick"; wr["C5"] = "Hollow Knight"; wr["D5"] = 3; wr["E5"] = 85; wr["F5"] = 40; wr["G5"] = 25
    wr["A6"] = ini + datetime.timedelta(days=3); wr["B6"] = "Kick"; wr["C6"] = "Valorant"; wr["D6"] = 2.5; wr["E6"] = 60
    wl["A5"] = "Marca de audífonos"; wl["C5"] = ini; wl["E5"] = 150000; wl["F5"] = "Entregada y pagada"; wl["G5"] = ini + datetime.timedelta(days=4)
    wa["K" + str(A1_ + hoy.month - 1)] = "Clips cortos de los lives: 3 de las 5 piezas con más vistas."

base_dir = Path(__file__).parent
out = base_dir / ("Bitacora-de-Creadora-Sheets-DEMO.xlsx" if DEMO else "Bitacora-de-Creadora-Sheets.xlsx")
wb.save(out)
print("Listo →", out.name)
