# Bot de ideas: WhatsApp → Notion

Dos bases, un mismo bot:

| Base | Quién escribe | Para qué |
|---|---|---|
| **Banco de ideas** (agencia) | Clientes y equipo de Alquimia | Ideas por cliente/marca |
| **Ideas TikTok** (personal) | Tamara | Reemplaza el grupo "Ideas" de WhatsApp: cada idea queda con nicho, tipo, hook, estructura y referencia |

Las ideas de contenido llegan por WhatsApp (de clientes o del equipo de Alquimia), Claude las ordena y quedan guardadas como una fila en la base **Banco de ideas** de Notion. El bot responde con el link a la página creada.

```
Cliente / Tamara            Meta (WhatsApp Cloud API)      Netlify Function           Claude              Notion
     │  "idea: reel rutina    │                               │                          │                   │
     │   noche #MarcaX"  ───► │  POST /webhook  ────────────► │ valida firma             │                   │
     │                        │ ◄──── 200 ok (inmediato) ──── │ ¿número autorizado?      │                   │
     │                        │                               │ ¿ya guardado? ──────────────────────────────►│ query WhatsApp ID
     │                        │                               │ clasifica ─────────────► │ título, formato,  │
     │                        │                               │                          │ pilar, hook...    │
     │                        │                               │ crea página ────────────────────────────────►│ fila nueva
     │ ◄── "Guardada: ... link" ◄──── enviar mensaje ──────── │                          │                   │
```

## Decisiones

| Tema | Elegido | Por qué | Descartado |
|---|---|---|---|
| WhatsApp | **WhatsApp Cloud API oficial (Meta)** | Gratis para mensajes que inicia el usuario y se responden dentro de 24 h. Sin riesgo de baneo. | Librerías no oficiales (Baileys, whatsapp-web.js): usan tu WhatsApp personal y Meta puede bloquear el número. Twilio: mismo API de Meta pero con recargo por mensaje. |
| Servidor | **Netlify Functions** | Plan gratis (125.000 invocaciones/mes), HTTPS incluido, sin servidor encendido 24/7. | Render/Railway gratis se "duermen" y la primera respuesta tarda ~30-50 s. |
| IA | **Claude (claude-opus-5-5, effort low)** | Devuelve JSON validado con las opciones exactas de Notion. Lee fotos y capturas. | — |
| Notion | API oficial con integración interna | Gratis. | Zapier/Make: cobran por tarea y no permiten la lógica de clientes. |
| Lenguaje | TypeScript (Node 20+) | Mismo código corre local y en Netlify. | — |

## Qué hace la versión 0.1 (MVP)

- Recibe **texto, links, fotos con descripción y capturas**. Claude lee la imagen para entender la idea.
- Solo acepta números registrados en `CONTACTOS_JSON` (equipo o clientes).
- Asigna el cliente automáticamente: si escribe un cliente, se usa su marca; si escribe alguien del equipo, se usa `#NombreCliente`.
- Clasifica: título, resumen, cliente, plataformas, formato, pilar, prioridad, hook sugerido, tags y si es referencia externa.
- Si Claude falla, la idea **igual se guarda** con estado `Sin clasificar`. Ninguna idea se pierde.
- Evita duplicados (Meta reintenta el webhook si tarda): busca el `WhatsApp ID` antes de crear.
- Cada página trae el mensaje original, los links como marcador y un checklist de preproducción.
- Comando `ayuda`.

### Fases siguientes

1. **Audios**: transcribir notas de voz (requiere un servicio de transcripción; Claude no recibe audio).
2. **Subir fotos/videos a Notion** como archivo dentro de la página.
3. **Ideas agrupadas**: varios mensajes seguidos en menos de 2 min = una sola idea.
4. **Comandos de consulta**: `ideas MarcaX` devuelve las últimas 5 ideas de ese cliente.
5. **Resumen semanal** por WhatsApp o correo con las ideas nuevas por cliente.

## Ideas TikTok (reemplazo del grupo "Ideas")

**Límite de WhatsApp:** la API oficial no puede leer un grupo personal (ni el tuyo contigo misma). Por eso:

1. **De aquí en adelante:** le escribes al número del bot en vez de al grupo. Fija ese chat arriba y ponle de nombre "Ideas". Mismo gesto, pero cada mensaje queda ordenado en Notion y el bot responde con nicho, tipo, hook y link.
2. **Historial del grupo:** se exporta una vez y se importa con un script.

Qué hace con cada mensaje:
- Si trae link de **TikTok o YouTube**, lee el caption y el autor del video (oEmbed público, sin claves). Instagram exige token de Meta: queda solo el link.
- Claude arma la ficha: título, **nicho** (Videojuegos, Lifestyle, Skincare, Panoramas, Otro), **tipo** (tendencia/audio, storytime, tutorial, review, GRWM, vlog, clip de stream, humor, panorama, respuesta a comentario), hook, estructura de 3-5 pasos, audio/tendencia, si **caduca** y prioridad.
- Un mensaje que empiece con `agencia:` se va al Banco de ideas de la agencia.

### Importar el historial del grupo

1. WhatsApp → grupo **Ideas** → menú → **Más** → **Exportar chat** → **Sin archivos**. Guardar el `.txt` en el computador (si llega `.zip`, descomprimir).
2. Ver cómo quedaría, sin gastar nada:
   ```bash
   npm run importar -- "Chat de WhatsApp con Ideas.txt" --prueba
   ```
3. Importar:
   ```bash
   npm run importar -- "Chat de WhatsApp con Ideas.txt"
   npm run importar -- chat.txt --desde 2026-06-01     # solo desde una fecha
   npm run importar -- chat.txt --minutos 5            # junta mensajes con hasta 5 min de diferencia
   ```

- Mensajes seguidos con menos de 3 minutos entre sí se juntan en una idea (ejemplo: pegar un link y después escribir "hacer esto con mi rutina").
- Fotos, videos o audios sin texto se omiten, porque el chat se exporta sin archivos.
- Se puede correr varias veces: lo que ya está en Notion se salta.
- Costo aproximado: USD 1-3 por cada 500 ideas.

### Base de Notion: "Ideas TikTok"

| Propiedad | Tipo | Opciones |
|---|---|---|
| Idea | Título | — |
| Estado | Select | Nueva, Sin clasificar, Para grabar, Grabada, Editada, Publicada, Descartada |
| Nicho | Select | Videojuegos, Lifestyle, Skincare, Panoramas, Otro |
| Tipo | Select | Tendencia / audio, Storytime, Tutorial / paso a paso, Review / opinión, GRWM, Día conmigo / vlog, Clip de stream / gameplay, Humor / sketch, Recomendación / panorama, Respuesta a comentario, Otro |
| Prioridad | Select | Alta, Media, Baja |
| Caduca | Checkbox | — |
| Audio / tendencia | Texto | — |
| Hook | Texto | — |
| Resumen | Texto | — |
| Tags | Multi-select | — |
| Link referencia | URL | — |
| Autor referencia | Texto | — |
| Origen | Select | WhatsApp, Importado del grupo |
| Mensaje original | Texto | — |
| WhatsApp ID | Texto | (técnico, para no duplicar) |
| Recibida | Fecha | — |

Vistas sugeridas: tablero por **Estado**, tablero por **Nicho**, filtro "Caduca = sí y Estado = Nueva" ordenado por Recibida (las que hay que grabar primero).

## Base de Notion: "Banco de ideas"

Los nombres de propiedades deben ser exactos (con tildes).

| Propiedad | Tipo | Opciones |
|---|---|---|
| Idea | Título | — |
| Estado | Select | Nueva, Sin clasificar, En revisión, Aprobada, En producción, Publicada, Descartada |
| Cliente | Select | Se crean solas al llegar |
| Fuente | Select | Cliente, Alquimia, Referencia externa |
| Plataforma | Multi-select | TikTok, Instagram, YouTube, Kick, Otra |
| Formato | Select | Reel / TikTok, Carrusel, Historia, Post estático, Short, Video largo, Stream, Sin definir |
| Pilar | Select | Educativo, Entretenimiento, Comunidad, Venta / Promoción, Detrás de cámaras, Tendencia |
| Prioridad | Select | Alta, Media, Baja |
| Resumen | Texto | — |
| Hook | Texto | — |
| Tags | Multi-select | — |
| Enviado por | Texto | — |
| Teléfono | Teléfono | — |
| Link referencia | URL | — |
| Mensaje original | Texto | — |
| WhatsApp ID | Texto | (técnico, para no duplicar; se puede ocultar) |
| Recibida | Fecha | — |

Vistas sugeridas: tablero por **Estado**, tabla filtrada por **Cliente**, calendario por **Recibida**.

## Puesta en marcha (paso a paso)

### 1. Notion (10 min)
1. Crear la base con las propiedades de arriba.
2. Ir a <https://www.notion.so/my-integrations> → **Nueva integración** (interna) → copiar el secret en `NOTION_TOKEN`.
3. En la base: `•••` → **Conexiones** → agregar la integración.
4. Copiar el ID de la base (32 caracteres de la URL, antes de `?v=`) en `NOTION_DATABASE_ID`.

### 2. WhatsApp Cloud API (30-60 min)
1. <https://developers.facebook.com> → **Crear app** → tipo **Empresa** → agregar el producto **WhatsApp**.
2. Meta entrega un número de prueba gratis (sirve para enviar a hasta 5 números verificados). Para clientes reales hay que agregar un número propio que **no** esté usado en la app de WhatsApp (un chip nuevo o un fijo).
3. Copiar el **Phone number ID** en `WHATSAPP_PHONE_NUMBER_ID`.
4. Token: Business Manager → Usuarios del sistema → crear uno → generar token con permisos `whatsapp_business_messaging` y `whatsapp_business_management` → `WHATSAPP_TOKEN`. (El token temporal del panel dura 24 h.)
5. App → Configuración → Básica → **Clave secreta** → `WHATSAPP_APP_SECRET`.
6. Webhooks (después del paso 4): URL `https://TU-SITIO.netlify.app/webhook`, token de verificación = `WHATSAPP_VERIFY_TOKEN`, suscribirse al campo **messages**.

### 3. Claude
Crear una API key en <https://platform.claude.com> → `ANTHROPIC_API_KEY`.

### 4. Desplegar en Netlify
1. Conectar este repositorio en Netlify.
2. Site settings → Environment variables → cargar todo lo de `.env.example`.
3. Deploy. Verificar en Meta el webhook (paso 2.6).

### Probar en local
```bash
cp .env.example .env     # completar valores
npm install
npm run probar -- "reel mostrando rutina de noche con el serum nuevo #MarcaX"   # solo Claude
npm run dev              # servidor en :3000
ngrok http 3000          # usar https://xxxx.ngrok.app/webhook en Meta
```

## Costos estimados (100 ideas/mes)

| Servicio | Costo |
|---|---|
| WhatsApp Cloud API | USD 0 (conversaciones de servicio iniciadas por el usuario) |
| Netlify | USD 0 (plan gratis) |
| Notion | USD 0 (integraciones incluidas en todos los planes) |
| Claude | ~USD 0,30-1 (≈1.000-2.000 tokens por idea; más si trae foto) |

## Estructura

```
src/config.ts          variables de entorno y opciones de la base
src/whatsapp.ts        verificación, firma, parseo del webhook, enviar mensajes, descargar media
src/clasificar.ts      Claude → idea ordenada (agencia y TikTok, JSON validado con zod)
src/referencias.ts     caption y autor de links de TikTok / YouTube
src/notion.ts          deduplicación y creación de páginas en las dos bases
src/tiktok.ts          flujo de una idea TikTok (lo usan el bot y el importador)
src/chat-export.ts     lector del .txt exportado de WhatsApp
src/procesar.ts        flujo completo por mensaje y ruteo entre bases
scripts/importar-chat.ts         importar el historial del grupo "Ideas"
netlify/functions/whatsapp.mts   endpoint /webhook en producción
scripts/local-server.ts          mismo endpoint para pruebas locales
scripts/probar-clasificacion.ts  probar solo la clasificación
```
