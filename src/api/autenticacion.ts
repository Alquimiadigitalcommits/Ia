// Verifica la sesión de Supabase (token JWT) en cada solicitud a la API.
// La identidad SIEMPRE sale del token firmado por Supabase, nunca de datos que mande el navegador.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface Usuario {
  id: string;
  email?: string;
  nombre?: string;
}

export type Verificador = (token: string) => Promise<Usuario | null>;

function aUsuario(p: JWTPayload): Usuario | null {
  if (typeof p.sub !== "string" || p.aud !== "authenticated") return null;
  const meta = (p as any).user_metadata ?? {};
  return { id: p.sub, email: (p as any).email, nombre: meta.full_name ?? meta.name };
}

/**
 * Proyectos nuevos de Supabase firman con llaves asimétricas publicadas en JWKS.
 * Proyectos antiguos usan un secreto compartido (SUPABASE_JWT_SECRET). Se aceptan ambos.
 */
export function verificadorSupabase(supabaseUrl = process.env.SUPABASE_URL, secreto = process.env.SUPABASE_JWT_SECRET): Verificador {
  const jwks = supabaseUrl ? createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`)) : null;
  const llave = secreto ? new TextEncoder().encode(secreto) : null;
  const emisor = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/auth/v1` : undefined;
  return async (token) => {
    try {
      if (llave) {
        const { payload } = await jwtVerify(token, llave, { audience: "authenticated", issuer: emisor });
        return aUsuario(payload);
      }
      if (jwks) {
        const { payload } = await jwtVerify(token, jwks, { audience: "authenticated", issuer: emisor });
        return aUsuario(payload);
      }
      return null;
    } catch {
      return null; // vencido, mal firmado o de otro proyecto
    }
  };
}

export const tokenDe = (req: Request) => {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
};
