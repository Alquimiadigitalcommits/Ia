# Bitácora de Creadora · Alquimia Digital

PDF imprimible (Carta): habit tracker, content tracker y community tracker. 4 nichos × 2 formatos.

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `salidas/` | Los 8 PDF: general, gamer, skincare y panoramas, cada uno mensual (13 págs) y trimestral (37 págs) |
| `generar.py` | Arma las páginas. En EDICIONES cambias por nicho: color, ícono, plataformas, hábitos, pilares |
| `estilos.css` | El diseño: colores (`:root`), tipografías, tamaños |
| `exportar.js` | Convierte el HTML en PDF |
| `fonts/` | Pinyon Script, Cormorant Garamond y Jost (Google Fonts, licencia OFL: se pueden usar en productos comerciales) |

## Cambiar algo y regenerar
```bash
python3 generar.py            # las 8 versiones
python3 generar.py gamer 3    # solo gamer trimestral
```
Sin Node: abre el .html de `salidas/` en Chrome → Imprimir → Guardar como PDF (Carta, márgenes: ninguno, gráficos de fondo activados).

## Versión Google Sheets (`planilla/`)
Plantilla que se llena sola: Configuración (nicho, plataformas, hábitos, pilares, mes, metas) alimenta todas las pestañas.
Diario → tablero de Hábitos; Ideas → Calendario; Métricas, Seguidores, Registro y Colaboraciones → Cierre del mes y Año (con trimestres).

```bash
cd planilla
python3 generar_planilla.py        # Bitacora-de-Creadora-Sheets.xlsx (vacía, para vender)
python3 generar_planilla.py demo   # con datos de EJEMPLO
```
Sube el .xlsx a Google Drive (se convierte a Google Sheets). Para vender: comparte el enlace cambiando `/edit` por `/copy`.
