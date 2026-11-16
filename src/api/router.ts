// API v1 de Alquimia Mi Día. Un solo punto de entrada para todos los módulos:
//   GET    /api/v1/yo                         perfil + módulos + widgets + permisos (crea el perfil la 1ª vez)
//   PUT    /api/v1/perfil | /modulos | /widgets | /accesos
//   GET    /api/v1/dashboard
//   GET    /api/v1/e/:entidad?desde&hasta&estado&limite
//   POST   /api/v1/e/:entidad
//   GET    /api/v1/e/:entidad/:id
//   PATCH  /api/v1/e/:entidad/:id
//   DELETE /api/v1/e/:entidad/:id             (a la papelera)
//   POST   /api/v1/e/:entidad/:id/restaurar
//   GET    /api/v1/e/:entidad/:id/historial
//   POST   /api/v1/bienestar/hoy              registro rápido del día (agua suma)
//   GET    /api/v1/papelera | /actividad | /exportar?area=
//
// Es una función pura (Request → Response) para poder probarla sin Netlify.

import { AREAS, type Area } from "../../shared/modulos.js";
import type { BaseDatos, Consulta } from "../datos/bd.js";
import { entidadPorNombre } from "../datos/entidades.js";
import * as repo from "../datos/repositorio.js";
import { asegurarPerfil, guardarAccesos, guardarModulos, guardarPerfil, guardarWidgets, leerConfiguracion } from "../datos/usuario.js";
import { tokenDe, type Verificador } from "./autenticacion.js";
import { datosDashboard, hoyEn } from "./dashboard.js";

export interface Dependencias {
  bd: () => Promise<BaseDatos>;
  verificar: Verificador;
  ahora?: () => Date;
}

const json = (datos: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(datos), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

const error = (status: number, mensaje: string) => json({ error: mensaje }, status);

async function cuerpo(req: Request): Promise<unknown> {
  const texto = await req.text();
  if (texto.length > 100_000) throw new repo.ErrorDatos(413, "La solicitud es demasiado grande.");
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new repo.ErrorDatos(400, "El cuerpo no es JSON válido.");
  }
}

export async function manejarApi(req: Request, deps: Dependencias): Promise<Response> {
  const url = new URL(req.url);
  const partes = url.pathname.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  const metodo = req.method.toUpperCase();

  const token = tokenDe(req);
  const usuario = token ? await deps.verificar(token) : null;
  if (!usuario) return error(401, "Inicia sesión para continuar.");

  let bd: BaseDatos;
  try {
    bd = await deps.bd();
  } catch (e) {
    return error(503, (e as Error).message);
  }
  const ctx = { usuarioId: usuario.id, canal: "web" as const };
  const ahora = deps.ahora?.() ?? new Date();
  const enTransaccion = <T>(fn: (q: Consulta) => Promise<T>) => bd.transaccion(ctx, fn);

  try {
    const [recurso, a, b, c] = partes;

    if (recurso === "yo" && metodo === "GET") {
      return json(
        await enTransaccion(async (q) => {
          await asegurarPerfil(q, usuario.nombre ?? usuario.email?.split("@")[0] ?? "");
          return { usuario: { id: usuario.id, email: usuario.email }, ...(await leerConfiguracion(q)) };
        }),
      );
    }
    if (metodo === "PUT" && recurso === "perfil") return json(await enTransaccion(async (q) => guardarPerfil(q, await cuerpo(req))));
    if (metodo === "PUT" && recurso === "modulos") return json(await enTransaccion(async (q) => guardarModulos(q, await cuerpo(req))));
    if (metodo === "PUT" && recurso === "widgets") return json(await enTransaccion(async (q) => guardarWidgets(q, await cuerpo(req))));
    if (metodo === "PUT" && recurso === "accesos") return json(await enTransaccion(async (q) => guardarAccesos(q, await cuerpo(req))));

    if (recurso === "dashboard" && metodo === "GET") {
      return json(
        await enTransaccion(async (q) => {
          const [p] = await q<{ zona_horaria: string }>("select zona_horaria from perfiles");
          return datosDashboard(q, p?.zona_horaria ?? "America/Santiago", ahora);
        }),
      );
    }

    if (recurso === "bienestar" && a === "hoy" && metodo === "POST") {
      const datos = (await cuerpo(req)) as Record<string, any>;
      return json(
        await enTransaccion(async (q) => {
          const [p] = await q<{ zona_horaria: string }>("select zona_horaria from perfiles");
          const fecha = typeof datos.fecha === "string" ? datos.fecha : hoyEn(p?.zona_horaria ?? "America/Santiago", ahora);
          const { fecha: _f, ...cambios } = datos;
          return repo.registrarBienestar(q, fecha, cambios);
        }),
      );
    }

    if (recurso === "papelera" && metodo === "GET") return json(await enTransaccion((q) => repo.papelera(q)));
    if (recurso === "actividad" && metodo === "GET") return json(await enTransaccion((q) => repo.actividadReciente(q)));
    if (recurso === "exportar" && metodo === "GET") {
      const area = url.searchParams.get("area");
      if (area && !AREAS.includes(area as Area)) return error(400, "Área no válida.");
      const datos = await enTransaccion((q) => repo.exportar(q, (area as Area) || undefined));
      return json(datos, 200, { "Content-Disposition": `attachment; filename="mi-dia-${area ?? "todo"}-${hoyEn("America/Santiago", ahora)}.json"` });
    }

    if (recurso === "e") {
      const ent = a ? entidadPorNombre(a) : undefined;
      if (!ent) return error(404, "Esa sección no existe.");
      if (!b && metodo === "GET") {
        const f = url.searchParams;
        const limite = Number(f.get("limite") ?? 100);
        return json(await enTransaccion((q) => repo.listar(q, ent, { desde: f.get("desde") ?? undefined, hasta: f.get("hasta") ?? undefined, estado: f.get("estado") ?? undefined, limite: Number.isFinite(limite) ? limite : 100 })));
      }
      if (!b && metodo === "POST") return json(await enTransaccion(async (q) => repo.crear(q, ent, await cuerpo(req))), 201);
      if (b && !c && metodo === "GET") return json(await enTransaccion((q) => repo.obtener(q, ent, b)));
      if (b && !c && metodo === "PATCH") return json(await enTransaccion(async (q) => repo.editar(q, ent, b, await cuerpo(req))));
      if (b && !c && metodo === "DELETE") return json(await enTransaccion((q) => repo.eliminar(q, ent, b)));
      if (b && c === "restaurar" && metodo === "POST") return json(await enTransaccion((q) => repo.restaurar(q, ent, b)));
      if (b && c === "historial" && metodo === "GET") return json(await enTransaccion((q) => repo.historial(q, ent, b)));
    }

    return error(404, "Ruta no encontrada.");
  } catch (e) {
    const t = repo.traducirError(e);
    if (t.status >= 500) console.error("API", metodo, url.pathname, e);
    return json({ error: t.message }, t.status);
  }
}
