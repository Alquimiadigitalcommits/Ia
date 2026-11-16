import { useEffect, useRef, type ReactNode } from "react";
import { Icono } from "./Icono";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <div className="estado" role="status"><span className="girador" aria-hidden="true" />{texto}</div>;
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="estado vacio">
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

export function ErrorCaja({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div className="estado error" role="alert">
      <b>No se pudo completar</b>
      <p>{mensaje}</p>
      {reintentar && <button className="boton secundario" onClick={reintentar}>Reintentar</button>}
    </div>
  );
}

export function Modal({ titulo, abierto, alCerrar, children }: { titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className="modal" onClose={alCerrar} onClick={(e) => e.target === ref.current && alCerrar()} aria-labelledby="modal-titulo">
      <div className="modal-cab">
        <h2 id="modal-titulo">{titulo}</h2>
        <button className="icono-btn" onClick={alCerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      </div>
      <div className="modal-cuerpo">{abierto && children}</div>
    </dialog>
  );
}

export function Interruptor({ activo, alCambiar, etiqueta, deshabilitado }: { activo: boolean; alCambiar: (v: boolean) => void; etiqueta: string; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      className={`interruptor${activo ? " activo" : ""}`}
      onClick={() => alCambiar(!activo)}
    >
      <span />
    </button>
  );
}

export function Escala({ valor, alCambiar, etiqueta, max = 5, simbolos }: { valor: number | null; alCambiar: (v: number | null) => void; etiqueta: string; max?: number; simbolos?: string[] }) {
  return (
    <div className="escala" role="radiogroup" aria-label={etiqueta}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          className={valor === n ? "activo" : ""}
          onClick={() => alCambiar(valor === n ? null : n)}
          aria-label={`${etiqueta} ${n} de ${max}`}
        >
          {simbolos?.[n - 1] ?? n}
        </button>
      ))}
    </div>
  );
}

export const CARITAS = ["😞", "🙁", "😐", "🙂", "😄"];
