# Bitácora de Creadora · Alquimia Digital

PDF imprimible de 13 páginas (tamaño Carta): habit tracker, content tracker y community tracker.

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `Bitacora-de-Creadora.pdf` | El producto final |
| `generar.py` | Arma las páginas. Arriba está la CONFIGURACIÓN: marca, plataformas, hábitos sugeridos |
| `estilos.css` | El diseño: colores (`:root`), tipografías, tamaños |
| `exportar.js` | Convierte el HTML en PDF |
| `fonts/` | Pinyon Script, Cormorant Garamond y Jost (Google Fonts, licencia OFL: se pueden usar en productos comerciales) |

## Cambiar algo y regenerar
```bash
python3 generar.py     # crea bitacora.html y el PDF
```
Sin Node: abre `bitacora.html` en Chrome → Imprimir → Guardar como PDF (Carta, márgenes: ninguno, gráficos de fondo activados).
