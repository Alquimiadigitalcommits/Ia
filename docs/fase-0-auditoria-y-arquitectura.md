# Fase 0 · Auditoría y arquitectura de Alquimia Mi Día

## 1. Auditoría de lo que existe hoy

### Lo que funciona y se conserva

| Pieza | Estado real | Se conserva |
|---|---|---|
| Asistente de WhatsApp (Claude + 11 herramientas, roles admin/equipo/cliente) | Código y 60 pruebas con servicios simulados. **Nunca probado con claves reales** | Sí. Pasa a ser el canal WhatsApp del asistente transversal |
| Conector de Notion (reintentos, paginación) | Probado con simulaciones | Sí, para el área de trabajo de la agencia |
| Ideas → "Ideas y referencias" (relación con Clientes) | Probado con simulaciones; 1 página de ejemplo real creada | Sí. Notion sigue siendo el sistema de la agencia |
| Conector de Google Sheets (no pisa fórmulas) | Probado con simulaciones | Sí, para negocios con inventario y recetas |
| Idempotencia y estado en Netlify Blobs | Probado | Sí |
| Recordatorios dentro de la ventana gratuita de WhatsApp | Probado | Sí |
| Publicación en Netlify con pruebas obligatorias | Funcionando en alquimia-mi-dia.netlify.app | Sí |
| Diseño (crema, tarjetas pastel, menú negro) | Funcionando | Sí, como sistema de diseño |

### Lo que NO cumple el nuevo alcance

| # | Problema | Por qué importa | Gravedad |
|---|---|---|---|
| A1 | **Datos de salud (ciclo, medicamentos, síntomas) guardados en Notion** | El alcance prohíbe usar Notion como repositorio principal de datos médicos | Alta |
| A2 | **No hay usuarios ni inicio de sesión**: una sola clave compartida | Sin usuarios no hay permisos por área (salud, finanzas, trabajo) ni base para publicar en Google Play | Alta |
| A3 | **No hay base de datos propia**: los datos están repartidos entre Notion, Sheets y Blobs | No permite hacer altas, ediciones y bajas reales, ni historial, ni exportar todo junto, ni consultas entre módulos | Alta |
| A4 | No hay historial de cambios ni papelera | No se puede auditar ni recuperar un dato borrado | Alta |
| A5 | El dashboard es una sola página en JavaScript sin rutas, con los datos de ejemplo mezclados en el código | No escala a 10 módulos ni se puede personalizar | Media |
| A6 | No hay sistema de módulos ni widgets configurables | Requisito central del alcance | Media |
| A7 | Las finanzas personales son solo movimientos sueltos | Faltan cuentas, presupuestos, deudas, metas y gastos recurrentes | Media |
| A8 | El asistente guarda sin pedir confirmación | El alcance exige aprobación para operaciones sensibles | Media |
| A9 | La clave del dashboard quedó escrita en el chat y como variable normal | Hay que cambiarla cuando existan usuarios | Baja |

---

## 2. Arquitectura recomendada

```
 ┌──────────── CLIENTES ────────────┐
 │ App web/PWA (React + TS)         │  ← Android vía TWA (Google Play)
 │ WhatsApp (asistente)             │
 └───────────────┬──────────────────┘
                 │ HTTPS + sesión del usuario
 ┌───────────────▼──────────────────┐
 │ API · Netlify Functions /api/v1  │  valida datos (Zod), revisa permisos,
 │                                  │  registra historial, cifra la salud
 └──┬────────────┬───────────┬──────┘
    │            │           │
 ┌──▼─────────┐ ┌▼────────┐ ┌▼──────────────────────┐
 │ Supabase   │ │ Claude  │ │ Integraciones         │
 │ Postgres   │ │ (IA)    │ │ Notion (agencia)      │
 │ Auth       │ └─────────┘ │ Sheets (negocios)     │
 │ Storage    │             │ WhatsApp              │
 └────────────┘             └───────────────────────┘
```

### Decisiones

| Tema | Recomendación | Por qué | Alternativa descartada |
|---|---|---|---|
| Base de datos | **Supabase (Postgres)** | Plan gratis (500 MB, 50.000 usuarios). Incluye inicio de sesión, políticas de acceso por fila (RLS) y almacenamiento privado para fotos y audios | Netlify Database: exige plan con créditos y tu equipo está en Free. No trae inicio de sesión ni RLS |
| Inicio de sesión | Supabase Auth: correo con enlace mágico + Google | Necesario para Play Store y para permisos por persona | Clave compartida (lo actual) |
| Datos médicos | Tabla aparte + **cifrado AES-256-GCM en la app** antes de guardar | Si alguien obtiene la base, no puede leer la salud sin la llave, que vive en Netlify y no en la base | Guardarlos en texto plano |
| Registros sexuales | Tabla separada, opcional, apagada por defecto. Se piden de nuevo PIN o sesión para verlos. Excluidos de la IA y de los informes salvo que los marques | Privacidad específica, como pide el alcance | — |
| Permisos | Áreas separadas: `personal`, `salud`, `salud_intima`, `finanzas`, `trabajo`. Cada módulo y cada canal (web, WhatsApp, IA) declara qué áreas puede leer o escribir | Separación de datos por políticas, como pide el alcance | Un solo permiso para todo |
| Historial | Tabla `historial` (antes/después, quién, desde dónde, cuándo). Borrado suave (`eliminado_en`) en todo | Auditoría y recuperación | — |
| Exportación | JSON y CSV por área desde la app. Copia semanal automática a Netlify Blobs | Recuperación aunque falle Supabase | — |
| Frontend | **Vite + React + TypeScript + React Router**, PWA con service worker | Multipágina, mantenible, fácil de contratar, compatible con TWA | Seguir en JavaScript sin framework: no escala a 10 módulos |
| Trabajo y agencia | Las áreas de trabajo tienen una "fuente": `interna` (base propia) o `notion` (tu Centro de Operaciones) | El alcance pide no duplicar sistemas que ya existen | Copiar Notion a la base |
| Negocios con inventario | La planilla sigue como fuente; la app la lee y escribe | Ya tiene recetas, producción y stock | Rehacerla entera |
| Pruebas | Vitest + **PGlite** (Postgres real en memoria) para probar esquema, permisos e historial | Se prueban las reglas reales de la base, no una simulación | Solo pruebas con datos simulados |

### Costos (uso de una persona)

| Servicio | Costo |
|---|---|
| Supabase Free | $0. Se pausa tras 7 días sin uso; el uso diario lo evita |
| Netlify Free | $0 |
| Claude | ~USD 1-5 al mes según uso del asistente |
| WhatsApp | $0 dentro de la ventana de 24 h |
| Google Play | USD 25, un solo pago, cuando se publique |

---

## 3. Plan por fases

| Fase | Contenido | Resultado verificable |
|---|---|---|
| **1 · Base** | App React multipágina, navegación inferior, menú de módulos, botón de creación rápida. Sistema de módulos y widgets configurables. Inicio de sesión. Capa de datos con permisos, historial, papelera y exportación. Dashboard con datos reales | Pruebas de permisos e historial sobre Postgres real. App instalable en Android |
| 2 · Salud | Condiciones, registro diario, ciclo avanzado, registros íntimos opcionales, informes PDF. Migrar la salud que hoy está en Notion | Altas, ediciones y bajas cifradas, con pruebas y PDF generado |
| 3 · Finanzas | Cuentas, transacciones, recurrentes, presupuestos, deudas, metas de ahorro, gráficos | Pruebas de saldos y presupuestos |
| 4 · Agenda y hábitos | Calendario mes/semana/día, eventos que se repiten, bloques de tiempo, hábitos con rachas | Pruebas de repeticiones y rachas |
| 5 · Movimiento y alimentación | Gimnasio, movilidad, cardio, diario de comidas con fotos, calendario de colores | Pruebas de progresión y cumplimiento |
| 6 · Trabajo, aprendizaje y diario | Áreas de trabajo (internas y Notion), proyectos, tareas, libros, cursos, diario con voz y búsqueda | Integración con Notion probada |
| 7 · IA transversal y Google Play | Asistente con aprobación de operaciones sensibles, resúmenes, tendencias. TWA en Play Store | Flujo de aprobación probado |

Cada fase empieza con revisión y propuesta, y termina con pruebas, verificación en celular y documentación. **No se publica en producción sin tu aprobación.**
