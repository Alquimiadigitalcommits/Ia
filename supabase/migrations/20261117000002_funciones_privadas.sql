-- Las funciones internas de seguridad no deben estar en "public": Supabase expone ese esquema
-- como API REST (/rest/v1/rpc/...). Se mueven a "privado", que la API no expone.
-- Las políticas RLS siguen funcionando: guardan la función por su identificador, no por su nombre.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

alter function canal_actual() set schema privado;
alter function tiene_acceso(area_datos, boolean) set schema privado;
alter function privado.canal_actual() set search_path = public, privado;
alter function privado.tiene_acceso(area_datos, boolean) set search_path = public, privado;
alter function registrar_historial() set search_path = public, privado;

-- Las funciones de trigger no se llaman directamente: nadie necesita permiso para ejecutarlas.
-- (Postgres no revisa ese permiso cuando se dispara el trigger.)
revoke execute on function registrar_historial(), tocar_actualizado() from public, anon, authenticated;
