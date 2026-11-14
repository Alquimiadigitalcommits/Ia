# Pasos 2 a 5 · Asistente, planilla, finanzas y recordatorios

| Paso | Qué se construyó | Estado |
|---|---|---|
| 2 | Asistente de WhatsApp con 11 herramientas | ✅ Código y pruebas |
| 3 | Conector de Google Sheets: ventas, gastos, compras, proveedores, stock | ✅ Código y pruebas |
| 4 | Dashboard con finanzas personales y de negocios | ✅ Código, pruebas y captura |
| 5 | Recordatorios por WhatsApp sin costo | ✅ Código y pruebas |
| — | Pruebas totales | ✅ 60 de 60 |

---

## Paso 2 · El asistente

Escribes como hablas. Claude elige la herramienta; el código valida los datos y ejecuta.

| Herramienta | Ejemplo | Dónde guarda |
|---|---|---|
| `guardar_idea` | link de TikTok, "idea: picoteo de viernes #SaborASemilla" | Notion · Ideas y referencias |
| `registrar_habito` | "tomé 2 vasos", "ánimo 4", "hice la kine", "leí 20 min" | Notion · Registro diario |
| `registrar_finanza_personal` | "gasté 5 lucas en uber con débito" | Notion · Finanzas personales |
| `registrar_venta` | "vendí 2 aros en Detalles a 8 mil, transferencia" | Planilla · 03 - Ventas |
| `registrar_gasto_negocio` | "pagué 12 lucas de publicidad para Ropa" | Planilla · 04 - Gastos |
| `registrar_compra` | "compré 100 limpiapipas a 3 lucas para Detalles" | Planilla · 05 - Compras |
| `agregar_proveedor` | "proveedor: Telas Ñuñoa, vende lino, Irarrázaval 1234" | Planilla · 07 - Proveedores |
| `agregar_fecha_importante` | "cita kine el viernes 16:00" | Notion · Fechas importantes |
| `registrar_periodo` | "me llegó la regla", "se me fue" | Notion · Ciclo |
| `consultar` | "¿cuánto llevo gastado?", "¿qué tengo hoy?", "proveedores de telas", "¿qué me falta de stock?" | Solo lee |
| `deshacer_ultimo` | "borra eso", "me equivoqué" | Archiva en Notion / vacía la fila en la planilla |

**Roles (seguridad):**

| Rol | Puede |
|---|---|
| `admin` (tú) | Las 11 herramientas |
| `equipo` | Solo guardar ideas |
| `cliente` | Solo guardar ideas, que van directo a su ficha |
| Número desconocido | Nada. Ni siquiera recibe respuesta |

**Reglas que sigue Claude:**
- "luca" = $1.000, "un palo" = $1.000.000.
- Si no está claro si un gasto es personal o de un negocio, o falta el monto, **pregunta antes de guardar**.
- Recuerda las últimas 4 idas y vueltas, así que entiende "y otro igual".
- Responde corto: una línea con ✓ por cada cosa guardada.

**Cómo funciona por dentro:** se usa el *tool runner* del SDK de Claude. Cada herramienta tiene un esquema Zod en modo estricto, así que Claude no puede inventar campos ni opciones que no existen. Los montos y las fechas se revisan otra vez dentro de la herramienta antes de guardar.

---

## Paso 3 · Planilla de Google

**Conexión:** con una "cuenta de servicio", que es un usuario robot de Google. Compartes la planilla con el correo del robot y solo él puede escribir en ella.

**Problema que resuelve el conector:** tu planilla trae filas preparadas con fórmulas hasta la fila 501. Si se usara la opción normal de Google (`append`), los datos quedarían en la fila 502. En cambio, el conector:

1. Busca cada columna por su **título**. Si mueves columnas, sigue funcionando.
2. Busca la primera fila libre. Una fila que solo tiene fórmulas cuenta como libre.
3. Escribe solo en celdas vacías. **Nunca pisa una fórmula.**

**Error encontrado por las pruebas y corregido:** la primera versión consideraba ocupada una fila que solo tenía fórmulas, así que se saltaba todas las filas preparadas.

**Columnas nuevas en Proveedores (autorizadas):** Dirección, Comuna, Qué vende, Precio de referencia, Fecha de registro. Se agregan a la derecha, sin mover nada.

**Límite de Netlify que se resolvió:** todas las variables de entorno juntas pueden pesar máximo ~4 KB, y la credencial de Google sola pesa ~2,3 KB. Por eso la credencial se sube una vez desde la página `/configurar.html` y queda guardada en Netlify Blobs.

---

## Paso 4 · Finanzas en el dashboard

- **Finanzas personales** (tarjeta amarilla): gastos, ingresos y balance del mes, y las 5 categorías con más gasto.
- **Negocios** (tarjeta verde): ventas, costos y resultado del mes por negocio, más el total. Los números se calculan desde las filas de la planilla, no desde sus fórmulas, para que no dependan de que las fórmulas estén bien.
- Si falla una de las dos fuentes, el resto del dashboard carga igual y muestra el error en la tarjeta.

---

## Paso 5 · Recordatorios gratis

WhatsApp no cobra lo que el bot te envía dentro de las **24 horas** siguientes a tu último mensaje. Fuera de esa ventana exige plantillas pagadas (~USD 0,02-0,03 cada una).

| Momento | Qué pasa |
|---|---|
| 08:00 | Resumen del día: medicamentos, rutina, fechas que avisan hoy, periodo cercano |
| A la hora de cada medicamento, ejercicio o cita | Recordatorio corto |
| 1 hora antes de que se cierre la ventana | "Respóndeme cualquier cosa (un 👍 sirve)". Si respondes, se renuevan las 24 h |
| Ventana cerrada | No se envía nada (costaría plata). Las alarmas de MacroDroid siguen funcionando |

Corre cada 15 minutos con las funciones programadas de Netlify, que no tienen costo. No repite un recordatorio ya enviado.

---

## Auditoría de los pasos 2 a 5

| Revisión | Resultado |
|---|---|
| Compilación | ✅ |
| Pruebas | ✅ 60 de 60 (27 nuevas) |
| Esquemas de herramientas | ✅ Revisados a mano: sin campos extra y con todos los campos obligatorios declarados |
| Permisos | ✅ Prueba: equipo y clientes solo ven `guardar_idea` |
| Datos inválidos | ✅ Pruebas: montos en 0 y fechas mal escritas no se guardan |
| Sin planilla conectada | ✅ Avisa; no finge que guardó |
| Errores encontrados | 2: filas con fórmula tratadas como ocupadas (código) y planilla simulada incompleta (prueba). Ambos corregidos |

**Lo que NO está verificado (honesto):**

- **Nada se probó contra Claude, Notion, Google ni WhatsApp reales:** no hay claves en este entorno. Las pruebas usan versiones simuladas. La primera conversación real puede mostrar ajustes de redacción o de criterio.
- Si llega un recordatorio en el mismo segundo que un mensaje tuyo, uno de los dos puede pisar el historial de conversación del otro. Riesgo bajo; se resuelve después con escritura condicional.
- Audios: todavía no se transcriben.
- `clientes.json` y la lista de números autorizados siguen siendo manuales.
