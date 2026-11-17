-- Endurecimiento para Supabase real.
-- Supabase concede por defecto TODOS los privilegios (incluido DELETE y TRUNCATE) sobre las
-- tablas nuevas a los roles anon y authenticated, y EXECUTE sobre las funciones a todos.
-- Sin esto, cualquiera con la llave pública podría intentar borrar filas propias por la API REST
-- de Supabase, saltándose la papelera. RLS ya impide tocar filas ajenas; esto cierra lo demás.

-- 1. Visitantes sin sesión (anon): nada.
revoke all on perfiles, modulos_usuario, widgets_usuario, accesos, historial,
  registros_bienestar, tareas, eventos from anon;

-- 2. Personas con sesión: sin borrado físico ni truncate, y el historial es solo lectura.
revoke delete, truncate, references, trigger on perfiles, modulos_usuario, widgets_usuario, accesos,
  registros_bienestar, tareas, eventos from authenticated;
revoke insert, update, delete, truncate, references, trigger on historial from authenticated;

-- 3. Funciones: search_path fijo (evita que alguien las engañe creando objetos con el mismo nombre)
--    y sin ejecución para anon.
alter function canal_actual() set search_path = public;
alter function tocar_actualizado() set search_path = public;
revoke execute on function canal_actual(), tocar_actualizado(), registrar_historial(), tiene_acceso(area_datos, boolean) from public, anon;
grant execute on function canal_actual(), tiene_acceso(area_datos, boolean) to authenticated;
