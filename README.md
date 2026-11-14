# Alquimia OS: WhatsApp + Notion + Drive

Sistema personal y de la agencia. Partes:

| Parte | Dónde vive | Estado |
|---|---|---|
| Ideas de contenido por WhatsApp | Notion: "Ideas y referencias" (base existente) | Hecho (v0.4, paso 1) |
| Dashboard "Mi día" (agua, humor, movimiento, lectura, medicamentos, ciclo, fechas, proyectos) | Web en Netlify, datos en Notion | Hecho (v0.1) |
| Alarmas del día para Android | `/api/alarmas-hoy` + MacroDroid/Tasker | Endpoint hecho, falta configurar el teléfono |
| Finanzas personales | Notion: base "Finanzas personales" | Base creada, falta conectarla al bot y al dashboard |
| Finanzas de negocios, inventario, proveedores | Drive: planilla Sistema_Administrativo_Emprendimientos | Falta acceso del bot a Google Sheets |
| Asistente de WhatsApp que entiende todo ("gasté 5 lucas en uber", "tomé 2 vasos") | Netlify + Claude | Siguiente etapa |

## Dashboard "Mi día"

- Diseño: fondo crema, menú negro, tarjetas en amarillo (agua), rosado (humor), verde (movimiento), azul (lectura), lila (ciclo). Calendario y línea de tiempo del día a la derecha. En celular: línea de tiempo arriba, tarjetas en columna y menú abajo.
- Se instala en Android como app (Chrome → menú → "Agregar a pantalla principal").
- Protegido con `DASHBOARD_CLAVE`: tiene datos de salud.
- Registro rápido desde el dashboard: +1 vaso de agua, humor del día, marcar kine.
- Ver con datos de ejemplo: `https://TU-SITIO.netlify.app/?demo`.
- Bases en Notion (página privada "Mi día"): Registro diario, Medicamentos, Plan de ejercicio y kine, Fechas importantes, Ciclo, Lecturas, Finanzas personales.

### Alarmas en Android (MacroDroid)

1. Instalar MacroDroid (gratis hasta 5 macros).
2. Macro nueva: disparador **Hora del día 06:00** → acción **Solicitud HTTP GET** a `https://TU-SITIO.netlify.app/api/alarmas-hoy?clave=TU_CLAVE&formato=texto` guardando la respuesta en una variable.
3. Acción **Repetir para cada línea** de la variable → separar por `|` → acción **Crear alarma** con hora y etiqueta.

El endpoint devuelve una línea por alarma: `08:00|Vitamina D · 1 cápsula`. Salen de Medicamentos (horarios), Plan de ejercicio y kine (hora) y Fechas importantes con hora.


Las ideas llegan por WhatsApp (de clientes, del equipo o de Tamara), Claude las ordena y quedan en **"Ideas y referencias"** de Notion. El bot responde con el link.

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

## Ideas de contenido

Cada mensaje al bot queda como una fila en la base existente **"Ideas y referencias"** de Notion, relacionada con la ficha del cliente.

- Recibe texto, links de TikTok/YouTube, fotos y capturas. De los links lee descripción, hashtags, autor y portada (Instagram exige token de Meta: queda solo el link).
- Claude decide de qué trata y a qué clientes les sirve (0 a 3), comparando con las fichas de `clientes.json`. Explica por qué y cómo adaptarlo.
- Columnas que llena: Idea, Cliente (relación), Fuente, Formato, Plataforma potencial, Prioridad, Potencial, Nicho, Resumen, Referencia. En la página: mensaje original, referencias, a quién le sirve, hook y estructura para grabar.
- `#Plasok`, `#SaborASemilla`, `#Sky`… en el mensaje asigna ese cliente.
- Si escribe un cliente registrado, la idea va a su ficha con Fuente = Cliente.
- Si Claude falla, la idea se guarda igual con un aviso para completarla.
- No se duplica aunque WhatsApp reenvíe el mensaje (Netlify Blobs).
- Números no autorizados: no reciben respuesta.

### Fichas de clientes (`clientes.json`)

Armadas desde la base Clientes de Notion (rubro, público, temas, tono, objetivo, qué evitar y el ID de su página). Si un cliente cambia en Notion, hay que actualizar este archivo (pendiente: leerlo directo de Notion).

### Importar el historial del grupo "Ideas"

1. WhatsApp → grupo **Ideas** → menú → **Más** → **Exportar chat** → **Sin archivos**.
2. Ver cómo quedaría sin gastar: `npm run importar -- chat.txt --prueba`
3. Importar: `npm run importar -- chat.txt` (opciones: `--desde 2026-06-01`, `--minutos 5`).

Mensajes con menos de 3 minutos entre sí se juntan en una idea. Lo importado se anota en `chat.txt.importados.json`: se puede volver a correr sin duplicar.

### Qué ve y qué no ve de un video

Ve portada, descripción, hashtags y autor. No ve el audio ni las escenas después de la portada. Para eso hay que descargar el video, sacar fotogramas y transcribir el audio (requiere un servidor de ~USD 5-7/mes).

## Puesta en marcha (paso a paso)

### 1. Notion (10 min)
1. Ir a <https://www.notion.so/my-integrations> → **Nueva integración** (interna) → copiar el secret en `NOTION_TOKEN`.
2. En "Agencia Digital | Centro de Operaciones" y en "Mi día": `•••` → **Conexiones** → agregar la integración.
3. Los IDs de las bases ya están en `.env.example`.

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
src/
├─ conectores/   Cómo hablar con servicios externos: notion (con reintentos) · whatsapp · referencias
├─ ideas/        Ideas de contenido: clasificar (Claude) · guardar (Notion) · chat-export
├─ personal/     Dashboard Mi día: lectura de bases, ciclo, fechas, registro rápido
├─ nucleo/       Base compartida: config · clientes · acceso (clave) · idempotencia
└─ canales/      Entrada de mensajes: whatsapp
netlify/functions/   Endpoints: /webhook · /api/resumen · /api/registrar · /api/alarmas-hoy
web/                 Dashboard (HTML, CSS y JS sin dependencias)
tests/               Pruebas automáticas (Vitest)
scripts/             Servidor local, probar clasificación, importar chat
docs/                Bitácoras de cada paso
```

Regla de capas: `nucleo/` lo puede usar todo. `conectores/` usa solo `nucleo/`, nunca `ideas/`, `personal/` ni `canales/`.

## Pruebas y auditoría

```bash
npm test          # 33 pruebas: Notion (reintentos, paginación), duplicados, ideas, WhatsApp, dashboard, chat
npm run revisar   # compilación + pruebas. Netlify lo corre antes de publicar: si algo falla, no se publica.
```
