// API v1 de Alquimia Mi Día (datos en Supabase, sesión de Supabase).
import type { Config } from "@netlify/functions";
import { verificadorSupabase } from "../../src/api/autenticacion.js";
import { manejarApi } from "../../src/api/router.js";
import { bdDesdeEntorno } from "../../src/datos/bd.js";

const verificar = verificadorSupabase();

export default (req: Request) => manejarApi(req, { bd: bdDesdeEntorno, verificar });

export const config: Config = { path: "/api/v1/*" };
