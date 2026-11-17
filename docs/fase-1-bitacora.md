# Fase 1 · Base de Alquimia Mi Día

**Estado:** construida y verificada en local. **No publicada en producción** (requiere tu aprobación y tu proyecto de Supabase).

## Qué se construyó

| Pieza | Qué hace | Dónde |
|---|---|---|
| Base de datos | Postgres con perfiles, módulos, widgets, permisos por canal y área, historial y primeras entidades (bienestar, tareas, eventos) | `supabase/migrations/` |
| Reglas en la base (RLS) | Cada persona ve solo lo suyo. WhatsApp e IA solo acceden a las áreas que autorices. Sin borrado físico. Los permisos solo se cambian desde la app | La misma migración |
| Historial automático | Cada crear, editar, eliminar y restaurar queda registrado con el valor anterior, el nuevo y el canal. Lo escribe un trigger de la base; nadie puede escribirlo a mano | `registrar_historial()` |
| Capa de datos | Altas, ediciones, bajas, papelera, restauración, historial y exportación genéricas para cualquier entidad | `src/datos/` |
| API v1 | Un punto de entrada para todos los módulos, con verificación de la sesión de Supabase | `src/api/`, `/api/v1/*` |
| Sistema de módulos | Registro único de 14 módulos y 12 widgets. Activar, desactivar y ordenar. Los opcionales vienen apagados | `shared/modulos.ts` |
| App React multipágina | Inicio de sesión (enlace por correo o Google), dashboard, agenda, tareas, bienestar, módulos y ajustes | `app/` |
| Navegación móvil | Barra inferior con botón central "+", ventanas que suben desde abajo, formularios compactos | `Estructura.tsx` |
| Dashboard personalizable | Ocultar, mostrar, reordenar y cambiar el tamaño de los widgets. Se guarda por persona | `Dashboard.tsx` |
| Registro rápido | +1 vaso, ánimo y energía, tarea o evento en 1 o 2 toques | `CreacionRapida.tsx` |
| Ajustes | Perfil y zona horaria, permisos por canal y área, exportar (todo o por área), papelera, actividad reciente | `Ajustes.tsx` |
| PWA | Instalable en Android. El service worker guarda solo la interfaz, **nunca tus datos** | `app/public/` |
| Servidor local | La app y la API reales con Postgres en memoria, para probar sin Supabase | `npm run local` |

## Verificación

| Prueba | Resultado |
|---|---|
| Pruebas automáticas | ✅ 109 de 109 (49 nuevas en esta fase) |
| Postgres real (PGlite) | ✅ Privacidad entre personas, permisos por canal, historial, papelera, validaciones y exportación |
| Tokens de Supabase | ✅ Acepta válidos. Rechaza vencidos, de otra audiencia o firmados con otra llave |
| Prueba de punta a punta en navegador | ✅ 23 de 23 pasos: crear, completar, editar, ver historial, eliminar, deshacer, restaurar desde la papelera, personalizar el dashboard y recargar, activar un módulo, cambiar un permiso y recargar, exportar JSON |
| Celular (Pixel 7) | ✅ Sin desplazamiento lateral en inicio, tareas, módulos y ajustes. Botón "+" y barra inferior funcionando |
| Errores en la consola del navegador | ✅ Ninguno |

## Errores encontrados y corregidos en esta fase

1. Las fechas de Postgres llegaban como objetos `Date` y el día se corría según la zona horaria del servidor. Ahora llegan como texto `AAAA-MM-DD`.
2. Restar un vaso de agua se rechazaba porque se validaba como total en vez de como cambio.
3. El dashboard calculaba "hoy" y "esta semana" con la medianoche UTC en vez de la de Chile: un evento de anoche a las 22:00 aparecía como de hoy.
4. Una migración que fallaba podía dejar la conexión con una transacción abierta.
5. El service worker copiaba la respuesta después de devolverla.
6. Al agregar Vite, las pruebas dejaron de ejecutarse. Si se hubiera publicado así, Netlify habría fallado.
7. Algunas pruebas antiguas no se revisaban con TypeScript. Ahora todo se revisa.

## Qué cambia respecto de la versión publicada hoy

- La página principal pasa a ser la app nueva, con inicio de sesión. El dashboard antiguo con datos de ejemplo desaparece.
- El bot de WhatsApp, las alarmas, los recordatorios y los conectores de Notion y Sheets **no cambian**. Siguen funcionando como antes y se migran a la base nueva en las fases 2, 3 y 7.

## Lo que necesito para publicar

1. **Crear el proyecto en Supabase** (supabase.com → New project, región São Paulo, plan Free).
2. Cargar en Netlify las 4 variables de `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` y `SUPABASE_DB_URL`. La última es secreta: no la pegues en el chat.
3. En Supabase → Authentication → URL Configuration: agregar `https://alquimia-mi-dia.netlify.app` como URL del sitio.
4. **Tu aprobación para publicar.** En esa publicación, Netlify aplica la migración automáticamente.

## Pendiente para fases siguientes (honesto)

- Los widgets de finanzas, hábitos, movimiento, alimentación, proyectos y asistente no aparecen todavía, porque sus módulos se construyen en las fases 3 a 7. No se muestran datos de ejemplo.
- La agenda tiene vista de lista. Las vistas de mes y semana, las repeticiones y los bloques de tiempo llegan en la fase 4.
- La salud en Notion (medicamentos, ciclo) sigue ahí hasta la fase 2, que la migra a la base con cifrado.
- La papelera no se vacía de forma definitiva: borrar de verdad requerirá una confirmación explícita.
- Para publicar en Google Play (TWA) falta el archivo `assetlinks.json` con la firma de la app. Va en la fase 7.

---

## Supabase configurado (17-11-2026)

| Qué | Estado |
|---|---|
| Proyecto | `alquimia-mi-dia` · São Paulo (sa-east-1) · plan Free · activo |
| Migraciones aplicadas | `base`, `endurecer_supabase`, `funciones_privadas` |
| Seguridad por fila (RLS) | ✅ Activa en las 8 tablas, con sus políticas |
| Visitantes anónimos | ✅ Sin acceso a ninguna tabla |
| Borrado físico | ✅ Bloqueado para personas con sesión (Supabase lo concede por defecto: se retiró) |
| Funciones internas | ✅ Fuera de la API pública (esquema `privado`) |
| Avisos de seguridad de Supabase | ✅ 0 |
| Usuario de la API `mi_dia_api` | ✅ Sin superusuario, sin saltarse RLS, sin crear tablas; solo puede actuar como "persona con sesión" |
| Firma de sesiones | ES256 con llaves públicas (la API las verifica sin secretos) |
| Variables en Netlify | ✅ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (llave publicable), `SUPABASE_URL` |

### Hallazgos de la auditoría en Supabase real

1. **Supabase concede DELETE y TRUNCATE por defecto** a las personas con sesión y a visitantes anónimos. Con eso, la papelera se podía saltar llamando directo a la API REST de Supabase. Se retiró, y las pruebas ahora simulan esos permisos por defecto para detectarlo.
2. **Dos funciones internas estaban expuestas** en `/rest/v1/rpc/`. Se movieron a un esquema privado.
3. **La conexión de la API usa un usuario propio con mínimo privilegio**, no la contraseña maestra. Las migraciones se aplican desde Supabase y no desde la publicación.

### Pendiente (requiere a la dueña de la cuenta)

- Definir la contraseña de `mi_dia_api` y cargar `SUPABASE_DB_URL` en Netlify. Así la contraseña nunca pasa por el chat.
- Authentication → URL Configuration → Site URL `https://alquimia-mi-dia.netlify.app`. Sin esto, el enlace del correo apunta a `localhost`.
- Verificación de certificado TLS contra la base: la conexión va cifrada, pero sin validar el certificado de Supabase (falta cargar su certificado raíz).
