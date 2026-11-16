# Alquimia Mi Día

Plataforma de organización personal y laboral: app React (PWA, lista para Android), API en Netlify, datos en Supabase (Postgres con RLS), asistente por WhatsApp e integraciones con Notion y Google Sheets.

- Arquitectura y auditoría: `docs/fase-0-auditoria-y-arquitectura.md`
- Fase 1 (base): `docs/fase-1-bitacora.md`
- Probar en tu computador sin Supabase: `npm install && npm run local` → http://localhost:8787
- Pruebas: `npm run revisar` (TypeScript + 109 pruebas)

---

## Sistema anterior (sigue funcionando): WhatsApp + Notion + Drive

Sistema personal y de la agencia. Partes:

| Parte | Dónde vive | Estado |
|---|---|---|
| Asistente de WhatsApp (11 herramientas, roles admin / equipo / cliente) | Netlify + Claude | Hecho, sin probar con claves reales |
| Ideas de contenido | Notion: "Ideas y referencias" | Hecho |
| Dashboard "Mi día" con finanzas | Web en Netlify, datos en Notion y Drive | Hecho |
| Finanzas personales | Notion: "Finanzas personales" | Hecho |
| Finanzas de negocios, compras, proveedores, stock | Drive: Sistema_Administrativo_Emprendimientos | Hecho (falta subir la credencial de Google) |
| Recordatorios por WhatsApp gratis (ventana de 24 h) | Función programada cada 15 min | Hecho |
| Alarmas en Android | `/api/alarmas-hoy` + MacroDroid | Endpoint hecho, falta configurar el teléfono |

Detalle y auditoría de cada etapa: `docs/paso-1-bitacora.md` y `docs/pasos-2-a-5-bitacora.md`.

## Puesta en marcha: lo que tienes que hacer tú

| # | Qué | Dónde | Tiempo |
|---|---|---|---|
| 1 | Crear la integración de Notion y conectarla a "Agencia Digital \| Centro de Operaciones" y a "Mi día" | notion.so/my-integrations | 5 min |
| 2 | Crear la app de WhatsApp en Meta, número y token permanente | developers.facebook.com (pasos abajo) | 30-60 min |
| 3 | Crear la API key de Claude | platform.claude.com | 2 min |
| 4 | Cargar las variables de `.env.example` en Netlify → Site configuration → Environment variables | Netlify | 10 min |
| 5 | Cuenta de servicio de Google: Google Cloud → crear proyecto → activar "Google Sheets API" → crear cuenta de servicio → crear clave JSON. Subirla en `/configurar.html` y compartir la planilla con el correo que aparece | console.cloud.google.com | 15 min |
| 6 | Poner tu número con `"rol":"admin"` en `CONTACTOS_JSON` | Netlify | 1 min |
| 7 | MacroDroid para alarmas (opcional) | Celular | 10 min |

### Publicar en Netlify

El sitio **alquimia-mi-dia** ya está creado en tu equipo de Netlify, pero todavía sin contenido publicado.

1. app.netlify.com → **alquimia-mi-dia** → **Site configuration** → **Build & deploy** → **Link repository** → GitHub → `alquimiadigitalcommits/ia`.
2. Rama de producción: `claude/whatsapp-notion-content-ideas-k7et4z` (o `main`, si la unes primero).
3. Netlify lee `netlify.toml`: corre `npm run revisar` (compilación + 60 pruebas) y publica `web/`. Si una prueba falla, no se publica.
4. Desde ahí, cada cambio que se sube a GitHub se publica solo.

**Ojo con el acceso:** el sitio se creó con **inicio de sesión de equipo de Netlify** para todo el sitio. Eso protege el dashboard, pero también bloquea a WhatsApp (Meta no puede iniciar sesión). Antes de conectar WhatsApp: **Site configuration → Access & security → Visitor access** → desactivar el inicio de sesión de equipo. El dashboard sigue protegido con `DASHBOARD_CLAVE`, y el webhook con la firma de Meta.

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
├─ conectores/   Servicios externos: notion · sheets · whatsapp · referencias (todos con reintentos)
├─ ideas/        Ideas de contenido: clasificar (Claude) · guardar (Notion) · chat-export
├─ asistente/    Claude + herramientas (tool runner): qué hacer con cada mensaje
├─ negocios/     Ventas, gastos, compras, proveedores y stock en la planilla de Drive
├─ personal/     Dashboard, finanzas personales, agenda y ciclo
├─ nucleo/       Base compartida: config · clientes · acceso (clave) · idempotencia
└─ canales/      Entrada y salida: whatsapp (roles) · recordatorios (ventana gratuita)
netlify/functions/   /webhook · /api/resumen · /api/registrar · /api/alarmas-hoy · /api/configurar-google · recordatorios (cada 15 min)
web/                 Dashboard (HTML, CSS y JS sin dependencias)
tests/               Pruebas automáticas (Vitest)
scripts/             Servidor local, probar clasificación, importar chat
docs/                Bitácoras de cada paso
```

Regla de capas: `nucleo/` lo puede usar todo. `conectores/` usa solo `nucleo/`, nunca `ideas/`, `personal/` ni `canales/`.

## Pruebas y auditoría

```bash
npm test          # 60 pruebas: Notion, Sheets, duplicados, ideas, asistente y permisos, negocios, recordatorios, WhatsApp, dashboard, chat
npm run revisar   # compilación + pruebas. Netlify lo corre antes de publicar: si algo falla, no se publica.
```
