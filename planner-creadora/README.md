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
Sin Node: abre `bitacora.html` en Chrome → Imprimir → Guardar como PDF (Carta, márgenes: ninguno, gráficos de fondo activados).
