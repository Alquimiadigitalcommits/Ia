import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const llavePublica = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Modo local: solo en el computador, con base PGlite y sin Supabase (npm run local). */
export const MODO_LOCAL = import.meta.env.VITE_MODO_LOCAL === "1";

export const supabase: SupabaseClient | null =
  !MODO_LOCAL && url && llavePublica ? createClient(url, llavePublica, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const supabaseConfigurado = MODO_LOCAL || Boolean(supabase);
