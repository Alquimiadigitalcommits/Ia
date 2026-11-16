import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { verificadorSupabase } from "../src/api/autenticacion.js";
import { manejarApi, type Dependencias } from "../src/api/router.js";
import type { BaseDatos } from "../src/datos/bd.js";
import { ANA, BETO, bdDePrueba } from "./ayuda-bd.js";

let bd: BaseDatos;
let deps: Dependencias;
// 16-11-2026 14:00 en Chile (UTC-3)
const ahora = new Date("2026-11-16T17:00:00Z");

beforeEach(async () => {
  bd = await bdDePrueba();
  deps = {
    bd: async () => bd,
    verificar: async (t) => (t === "ana" ? { id: ANA, email: "ana@correo.cl" } : t === "beto" ? { id: BETO } : null),
    ahora: () => ahora,
  };
});

async function api(metodo: string, ruta: string, cuerpo?: unknown, token = "ana") {
  const res = await manejarApi(
    new Request(`https://x.app/api/v1${ruta}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    }),
    deps,
  );
  return { status: res.status, datos: await res.json() };
}

describe("API: sesión", () => {
  it("sin sesión → 401", async () => {
    expect((await api("GET", "/yo", undefined, "")).status).toBe(401);
    expect((await api("GET", "/yo", undefined, "token-falso")).status).toBe(401);
  });
  it("primera entrada crea el perfil con el nombre del correo", async () => {
    const r = await api("GET", "/yo");
    expect(r.status).toBe(200);
    expect(r.datos.perfil.nombre).toBe("ana");
    expect(r.datos.modulos.length).toBeGreaterThan(5);
  });
  it("sin base de datos configurada → 503 con mensaje", async () => {
    deps.bd = async () => { throw new Error("Falta SUPABASE_DB_URL: la base de datos no está configurada."); };
    expect(await api("GET", "/yo")).toEqual({ status: 503, datos: { error: "Falta SUPABASE_DB_URL: la base de datos no está configurada." } });
  });
});

describe("API: operaciones completas", () => {
  beforeEach(async () => { await api("GET", "/yo"); });

  it("crear, listar, editar, eliminar, restaurar y ver historial de una tarea", async () => {
    const creada = await api("POST", "/e/tareas", { titulo: "Enviar guiones a Plasok", prioridad: "alta", vence: "2026-11-18" });
    expect(creada.status).toBe(201);
    const id = creada.datos.id;
    expect((await api("GET", "/e/tareas")).datos).toHaveLength(1);
    expect((await api("PATCH", `/e/tareas/${id}`, { estado: "hecha" })).datos.estado).toBe("hecha");
    expect((await api("DELETE", `/e/tareas/${id}`)).status).toBe(200);
    expect((await api("GET", "/e/tareas")).datos).toHaveLength(0);
    expect((await api("GET", "/papelera")).datos[0].titulo).toBe("Enviar guiones a Plasok");
    expect((await api("POST", `/e/tareas/${id}/restaurar`)).status).toBe(200);
    const h = await api("GET", `/e/tareas/${id}/historial`);
    expect(h.datos.map((x: any) => x.operacion)).toEqual(["restaurar", "eliminar", "editar", "crear"]);
  });

  it("errores claros: validación 400, sección inexistente 404, JSON roto 400", async () => {
    expect((await api("POST", "/e/tareas", { titulo: "" })).status).toBe(400);
    expect((await api("GET", "/e/inventada")).status).toBe(404);
    const roto = await manejarApi(new Request("https://x.app/api/v1/e/tareas", { method: "POST", headers: { Authorization: "Bearer ana" }, body: "{no" }), deps);
    expect(roto.status).toBe(400);
  });

  it("Beto no ve ni toca lo de Ana", async () => {
    const { datos } = await api("POST", "/e/tareas", { titulo: "Secreta" });
    await api("GET", "/yo", undefined, "beto");
    expect((await api("GET", "/e/tareas", undefined, "beto")).datos).toEqual([]);
    expect((await api("PATCH", `/e/tareas/${datos.id}`, { titulo: "x" }, "beto")).status).toBe(404);
  });

  it("registro rápido de agua usa la fecha de Chile y suma", async () => {
    await api("POST", "/bienestar/hoy", { agua_vasos: 1 });
    const r = await api("POST", "/bienestar/hoy", { agua_vasos: 1, humor: 4 });
    expect(r.datos).toMatchObject({ fecha: "2026-11-16", agua_vasos: 2, humor: 4 });
  });

  it("dashboard: tareas vencidas, eventos de hoy (hora de Chile) y estadísticas", async () => {
    await api("POST", "/e/tareas", { titulo: "Vencida", vence: "2026-11-10" });
    await api("POST", "/e/tareas", { titulo: "Futura", vence: "2026-11-30" });
    await api("POST", "/e/eventos", { titulo: "Kine", inicio: "2026-11-16T18:00:00-03:00" });
    await api("POST", "/e/eventos", { titulo: "Anoche tarde", inicio: "2026-11-15T22:30:00-03:00" }); // 01:30 UTC del 16
    await api("POST", "/bienestar/hoy", { agua_vasos: 8, humor: 5 });
    const d = (await api("GET", "/dashboard")).datos;
    expect(d.hoy).toBe("2026-11-16");
    expect(d.tareas).toMatchObject({ pendientes: 2, vencidas: 1 });
    expect(d.agenda.hoy.map((e: any) => e.titulo)).toEqual(["Kine"]);
    expect(d.agenda.proximos.map((e: any) => e.titulo)).not.toContain("Anoche tarde");
    expect(d.estadisticas).toMatchObject({ dias_registrados: 1, dias_meta_agua: 1, humor_promedio: 5 });
  });

  it("configuración: ocultar un widget y activar un módulo opcional", async () => {
    await api("PUT", "/widgets", [{ widget: "estadisticas", visible: false, orden: 0, tamano: "grande", config: {} }]);
    await api("PUT", "/modulos", [{ modulo: "ciclo", activo: true, orden: 3, config: {} }]);
    const yo = (await api("GET", "/yo")).datos;
    expect(yo.widgets.find((w: any) => w.widget === "estadisticas").visible).toBe(false);
    expect(yo.modulos.find((m: any) => m.modulo === "ciclo").activo).toBe(true);
  });

  it("exportar devuelve un archivo descargable y valida el área", async () => {
    await api("POST", "/e/tareas", { titulo: "x" });
    const res = await manejarApi(new Request("https://x.app/api/v1/exportar", { headers: { Authorization: "Bearer ana" } }), deps);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="mi-dia-todo-2026-11-16\.json"/);
    expect((await res.json()).datos.tareas).toHaveLength(1);
    expect((await api("GET", "/exportar?area=inventada")).status).toBe(400);
  });
});

describe("verificación real de tokens de Supabase", () => {
  const secreto = "secreto-de-prueba-con-al-menos-32-caracteres!!";
  const url = "https://proyecto.supabase.co";
  const firmar = (extra: Record<string, unknown> = {}, exp = "1h") =>
    new SignJWT({ aud: "authenticated", email: "ana@correo.cl", ...extra })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(ANA)
      .setIssuer(`${url}/auth/v1`)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(secreto));
  const verificar = verificadorSupabase(url, secreto);

  it("acepta un token válido", async () => {
    expect(await verificar(await firmar())).toMatchObject({ id: ANA, email: "ana@correo.cl" });
  });
  it("rechaza un token vencido", async () => {
    expect(await verificar(await firmar({}, "-1m"))).toBeNull();
  });
  it("rechaza un token de otra audiencia (ej. anónimo)", async () => {
    expect(await verificar(await firmar({ aud: "anon" }))).toBeNull();
  });
  it("rechaza un token firmado con otra llave", async () => {
    expect(await verificadorSupabase(url, "otra-llave-distinta-de-32-caracteres-o-mas")(await firmar())).toBeNull();
  });
});
