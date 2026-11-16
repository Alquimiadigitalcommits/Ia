import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ConfigModulo, ConfigWidget } from "../../../shared/modulos";
import { api } from "./api";
import { MODO_LOCAL, supabase, supabaseConfigurado } from "./supabase";

export interface Acceso { canal: "whatsapp" | "ia"; area: string; lectura: boolean; escritura: boolean }
export interface Yo {
  usuario: { id: string; email?: string };
  perfil: { nombre: string; zona_horaria: string };
  modulos: ConfigModulo[];
  widgets: ConfigWidget[];
  accesos: Acceso[];
}

type Estado =
  | { tipo: "sin_configurar" }
  | { tipo: "cargando" }
  | { tipo: "sin_sesion" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "lista"; yo: Yo };

interface Sesion {
  estado: Estado;
  yo: Yo | null;
  zona: string;
  recargar: () => Promise<void>;
  guardarModulos: (m: ConfigModulo[]) => Promise<void>;
  guardarWidgets: (w: ConfigWidget[]) => Promise<void>;
  guardarAccesos: (a: Acceso[]) => Promise<void>;
  guardarPerfil: (p: Partial<Yo["perfil"]>) => Promise<void>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(supabaseConfigurado ? { tipo: "cargando" } : { tipo: "sin_configurar" });

  const recargar = useCallback(async () => {
    if (!supabaseConfigurado) return;
    if (!MODO_LOCAL) {
      const { data } = await supabase!.auth.getSession();
      if (!data.session) return setEstado({ tipo: "sin_sesion" });
    }
    try {
      setEstado({ tipo: "lista", yo: await api<Yo>("GET", "/yo") });
    } catch (e) {
      const err = e as { status?: number; message: string };
      setEstado(err.status === 401 ? { tipo: "sin_sesion" } : { tipo: "error", mensaje: err.message });
    }
  }, []);

  useEffect(() => {
    void recargar();
    const sub = supabase?.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT") void recargar();
    });
    return () => sub?.data.subscription.unsubscribe();
  }, [recargar]);

  const yo = estado.tipo === "lista" ? estado.yo : null;
  const actualizar = (parcial: Partial<Yo>) => setEstado((e) => (e.tipo === "lista" ? { tipo: "lista", yo: { ...e.yo, ...parcial } } : e));

  const valor: Sesion = {
    estado,
    yo,
    zona: yo?.perfil.zona_horaria ?? "America/Santiago",
    recargar,
    guardarModulos: async (m) => actualizar({ modulos: await api("PUT", "/modulos", m) }),
    guardarWidgets: async (w) => actualizar({ widgets: await api("PUT", "/widgets", w) }),
    guardarAccesos: async (a) => actualizar({ accesos: await api("PUT", "/accesos", a) }),
    guardarPerfil: async (p) => {
      const perfil = await api("PUT", "/perfil", p);
      setEstado((e) => (e.tipo === "lista" ? { tipo: "lista", yo: { ...e.yo, perfil: { ...e.yo.perfil, ...perfil } } } : e));
    },
    salir: async () => {
      await supabase?.auth.signOut();
      setEstado({ tipo: "sin_sesion" });
    },
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSesion fuera de SesionProvider");
  return s;
}

/** Carga datos de la API con estados de carga y error, y permite recargar. */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const ejecutar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await cargar());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void ejecutar();
  }, [ejecutar]);
  return { datos, setDatos, error, cargando, recargar: ejecutar };
}
