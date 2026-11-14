# Paso 1 · Ordenar la base

Bitácora en vivo. Cada parte muestra **qué cambió**, **por qué** y **cómo se auditó**.

| Parte | Tema | Estado |
|---|---|---|
| 1.1 | Estructura de carpetas | ✅ Listo |
| 1.2 | Un solo conector de Notion, con reintentos | ✅ Listo |
| 1.3 | No duplicar mensajes (Netlify Blobs) | ✅ Listo |
| 1.4 | Ideas en tu base existente "Ideas y referencias" | ✅ Listo |
| 1.5 | Pruebas automáticas (Vitest) | ✅ Listo |
| 1.6 | Auditoría final | ✅ Listo |

---

## 1.1 Estructura de carpetas

**Antes:** todos los archivos sueltos en `src/`. Con 12 archivos se entiende; con 60 no.

**Después:** cada carpeta responde una pregunta.

```
src/
├─ conectores/   ¿Cómo hablo con un servicio externo?   notion · whatsapp · referencias (TikTok/YouTube)
├─ ideas/        ¿Qué hago con una idea de contenido?   clasificar · guardar · chat-export
├─ personal/     ¿Qué hago con mis datos personales?    agua, humor, ciclo, medicamentos…
├─ nucleo/       Piezas que usa todo el sistema         config · clientes · acceso · idempotencia
└─ canales/      Por dónde entra la información         whatsapp (procesar mensajes)
```

**Regla para que escale:** `nucleo/` es la base que todos pueden usar. `conectores/` puede usar `nucleo/`, pero **nunca** `ideas/`, `personal/` ni `canales/`. Así cambiar Notion por otra herramienta mañana solo toca un archivo. *(Corregida en la auditoría 1.6: la primera versión decía que conectores no usaba nada, y no era cierto.)*

**Auditoría 1.1:** se movieron 10 archivos con `git mv` (Git conserva el historial de cada uno) y se corrigieron 14 rutas de importación. El compilador de TypeScript confirma que no quedó ninguna ruta rota.

---

## 1.2 Un solo conector de Notion

**Problema:** había dos copias del código que habla con Notion (una para las ideas y otra para el dashboard). Si Notion cambia algo, había que arreglarlo dos veces.

**Ahora:** todo pasa por `src/conectores/notion.ts`. El resto del sistema pide cosas simples:

```ts
const notion = crearClienteNotion(token);
await notion.consultar(baseId, { filter: ... });   // lee filas
await notion.crearPagina(baseId, propiedades);      // crea una fila
```

**Reintentos.** Notion acepta unas 3 solicitudes por segundo. Si se pasa, responde *429 "espera un poco"*. Antes el sistema fallaba; ahora espera y vuelve a intentar:

| Respuesta de Notion | Qué hace el conector |
|---|---|
| 200 OK | Entrega el resultado |
| 429 Demasiadas solicitudes | Espera lo que Notion indique (`Retry-After`) y reintenta |
| 500–599 Falla de Notion | Reintenta tras 0,5 s · 1 s · 2 s · 4 s (espera que crece) |
| Corte de red / sin respuesta en 15 s | Igual que 5xx |
| 400–499 Dato mal enviado | **No** reintenta: repetir no lo arregla. Avisa el error |

Esto se llama *backoff exponencial*: cada espera duplica la anterior para no saturar más al servicio.

**Paginación.** Notion entrega máximo 100 filas por consulta. El conector pide las páginas siguientes solo, así una base con 500 ideas se lee completa.

**Auditoría 1.2:** `personal.ts` dejó de tener su propia conexión (−45 líneas duplicadas). Compila sin errores. Las pruebas de reintentos van en la parte 1.5.

---

## 1.3 No duplicar mensajes

**Problema:** WhatsApp reenvía el mensaje si no recibe respuesta rápido. Antes el bot preguntaba a Notion "¿ya existe esta idea?". Si llegaban dos copias al mismo tiempo, las dos recibían "no" y se creaban **dos filas**. Esto se llama *condición de carrera*.

**Ahora:** cada mensaje se "reclama" antes de procesarlo, con una escritura que solo funciona si la clave no existe (`onlyIfNew` de Netlify Blobs):

```
Copia 1 ──► reclamar("wamid.123") ──► ✅ nueva  → se procesa
Copia 2 ──► reclamar("wamid.123") ──► ❌ ya estaba → se descarta
```

Si algo falla a mitad de camino (por ejemplo, Notion caído), el mensaje se **libera** para que el reintento sí lo guarde.

Hay 3 versiones del mismo registro, que se usan según dónde corre el código:

| Dónde | Registro | Por qué |
|---|---|---|
| Netlify (producción) | Netlify Blobs | Persiste entre ejecuciones y es atómico |
| Pruebas | Memoria | Rápido, sin servicios externos |
| Importador del chat (tu computador) | Archivo `chat.txt.importados.json` | Puedes cortar y volver a correrlo sin duplicar |

**Auditoría 1.3 · error encontrado y corregido:** en el registro por archivo, 3 importaciones en paralelo podían leer el archivo al mismo tiempo y cada una armaba su propia lista. La última en guardar borraba lo que anotaron las otras. Se corrigió guardando la *lectura en curso* (la promesa), para que las tres esperen la misma. Queda cubierto con una prueba en 1.5.

---

## 1.4 Ideas en "Ideas y referencias"

**Problema:** el bot guardaba en bases nuevas, separadas de tu sistema de la agencia.

**Ahora:** guarda en tu base existente, que ya se relaciona con **Clientes** y **Producciones**. Así cada idea aparece sola en la ficha del cliente.

| Columna en Notion | De dónde sale |
|---|---|
| Idea | Título que propone Claude |
| Cliente (relación) | Cliente del remitente, `#Nombre` del mensaje, o los clientes sugeridos (hasta 3) |
| Fuente | Cliente si lo envía un cliente · Referente si es video de otra cuenta · Tendencia si caduca · Equipo en otro caso |
| Formato, Plataforma potencial, Prioridad | Claude, usando solo las opciones que existen en tu base |
| Potencial | Encaje del mejor cliente sugerido (Alto / Medio) |
| Nicho, Resumen, Referencia | Claude y el link |
| Contenido de la página | Mensaje original, referencias, de qué trata, a quién le sirve y cómo adaptarlo, hook y estructura |

**Simplificación:** antes había dos flujos (agencia y TikTok). Como tu base ya relaciona cada idea con su cliente, ahora es **uno solo**: la cuenta Sky es un cliente más en la lista. Menos código, menos lugares donde algo puede fallar.

**Auditoría 1.4:**
- El canal de WhatsApp quedó en 80 líneas, sin lógica de Notion ni de Claude.
- Los números no autorizados ya no reciben respuesta (antes sí). Así no se gastan mensajes ni se da pistas a desconocidos.
- Si Claude falla, la idea igual se guarda con un aviso para completarla a mano.
- Compila sin errores.

---

## 1.5 Pruebas automáticas

Una **prueba** es un programa chico que usa tu código y revisa que el resultado sea el esperado. Se corren con `npm test` en menos de 1 segundo, sin internet y sin gastar en Claude ni Notion: esos servicios se reemplazan por versiones falsas que responden lo que la prueba necesita.

| Archivo | Qué comprueba | Pruebas |
|---|---|---|
| `notion.test.ts` | Reintenta un 429, respeta `Retry-After`, se rinde tras 4 intentos, **no** reintenta un 400, reintenta cortes de red, lee todas las páginas | 7 |
| `idempotencia.test.ts` | Un mensaje duplicado se procesa una vez; liberar permite reintentar; el registro por archivo no se pisa en paralelo | 3 |
| `ideas.test.ts` | `#Plasok`, `#saborasemilla`, `#Sky` asignan el cliente correcto; la fila usa las columnas reales; dos copias del mismo mensaje crean UNA fila; si Notion falla se libera; si Claude falla se guarda igual | 10 |
| `whatsapp.test.ts` | Lee el formato de Meta, ignora avisos de "leído", rechaza mensajes sin firma válida | 4 |
| `personal.test.ts` | Ciclo (promedio, día actual, próximo), cumpleaños que se repiten, horarios, hora de Chile | 6 |
| `chat-export.test.ts` | Chats de Android e iPhone, mensajes de varias líneas, junta link + nota | 3 |
| **Total** | | **33 ✅** |

**¿Cómo sé que las pruebas sirven?** Volví a poner a propósito el error de la parte 1.3 y corrí la prueba:

```
× archivo: 3 trabajadores en paralelo no se pisan
  expected [ 'f' ] to deeply equal [ 'a', 'b', 'c', 'd', 'e', 'f' ]
```

De 6 mensajes importados en paralelo, con el error solo quedaba guardado 1. La prueba lo detecta. Restauré la corrección y las 33 vuelven a pasar.

**Candado antes de publicar:** Netlify ahora corre `npm run revisar` (compilación + pruebas) antes de publicar. Si una prueba falla, **no se publica** y lo que está funcionando sigue igual.

---

## 1.6 Auditoría final del paso 1

| Revisión | Resultado |
|---|---|
| Compilación TypeScript | ✅ Sin errores |
| Pruebas | ✅ 33 de 33 |
| Claves o secretos escritos en el código | ✅ Ninguno (búsqueda de patrones de claves de Claude, Notion y Meta) |
| Variables o bases que ya no existen | ⚠️ Estaban en `.env.example` y README → **corregido** |
| Regla de capas | ⚠️ La regla estaba mal escrita (ver 1.1) → **corregida**. Con la regla correcta, se cumple |
| Registro de duplicados fuera de Netlify | ✅ Usa memoria cuando no hay Blobs |
| Errores encontrados en el camino | 1 condición de carrera en el importador → corregida y cubierta con prueba |

**Lo que NO cubre este paso** (para no dar falsa seguridad):

- Nada se probó contra Notion, WhatsApp ni Claude reales: faltan las claves. Las pruebas usan versiones falsas de esos servicios.
- `clientes.json` sigue siendo una copia manual de Notion (punto 5 de la auditoría general, queda para después).
- Los números autorizados siguen en una variable de configuración (punto 6).
- No hay aviso de errores por WhatsApp (punto 7).

**Siguiente:** paso 2, el asistente con herramientas.
