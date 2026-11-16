import { api } from "../lib/api";
import { fechaHora } from "../lib/fechas";
import { useCarga, useSesion } from "../lib/sesion";
import { Cargando, ErrorCaja, Modal, Vacio } from "./Basicos";

const OCULTOS = new Set(["id", "usuario_id", "creado_en", "actualizado_en", "eliminado_en"]);
const NOMBRE_OP: Record<string, string> = { crear: "Creado", editar: "Editado", eliminar: "Enviado a la papelera", restaurar: "Restaurado" };
const NOMBRE_CANAL: Record<string, string> = { web: "app", whatsapp: "WhatsApp", ia: "asistente" };

function cambios(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  if (!antes || !despues) return [];
  return Object.keys(despues)
    .filter((k) => !OCULTOS.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
    .map((k) => ({ campo: k.replace(/_/g, " "), antes: antes[k], despues: despues[k] }));
}

const mostrar = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

export function Historial({ entidad, id, alCerrar }: { entidad: string; id: string | null; alCerrar: () => void }) {
  return (
    <Modal titulo="Historial de cambios" abierto={Boolean(id)} alCerrar={alCerrar}>
      {id && <ListaHistorial entidad={entidad} id={id} />}
    </Modal>
  );
}

function ListaHistorial({ entidad, id }: { entidad: string; id: string }) {
  const { zona } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<any[]>(() => api("GET", `/e/${entidad}/${id}/historial`), [entidad, id]);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCaja mensaje={error} reintentar={recargar} />;
  if (!datos?.length) return <Vacio titulo="Sin cambios registrados" />;
  return (
    <ol className="historial">
      {datos.map((h) => (
        <li key={h.id}>
          <div className="historial-cab"><b>{NOMBRE_OP[h.operacion] ?? h.operacion}</b><span>{fechaHora(h.creado_en, zona)} · desde {NOMBRE_CANAL[h.canal] ?? h.canal}</span></div>
          {h.operacion === "editar" && (
            <ul>
              {cambios(h.antes, h.despues).map((c) => (
                <li key={c.campo}><span className="campo">{c.campo}:</span> <s>{mostrar(c.antes)}</s> → {mostrar(c.despues)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
