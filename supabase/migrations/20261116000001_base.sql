-- Alquimia Mi Día · Fase 1 · Base: perfiles, módulos, widgets, permisos por área,
-- historial de cambios y primeras entidades (bienestar, tareas, eventos).
--
-- Reglas que aplica la propia base (no solo la app):
--   1. Cada persona ve y edita solo sus filas (RLS con auth.uid()).
--   2. Cada canal (web, whatsapp, ia) solo accede a las áreas que la persona autorizó.
--   3. Nada se borra de verdad: se marca eliminado_en (papelera) y queda en el historial.
--   4. WhatsApp y la IA no pueden cambiar permisos: solo desde la web.

-- ─────────────────────────── Tipos ───────────────────────────
create type area_datos as enum ('personal', 'salud', 'salud_intima', 'finanzas', 'trabajo');
create type canal_acceso as enum ('web', 'whatsapp', 'ia');

-- Canal de la solicitud actual (lo fija la API en cada transacción). Por defecto: web.
create function canal_actual() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('app.canal', true), ''), 'web')
$$;

-- ─────────────────────────── Perfil y configuración ───────────────────────────
create table perfiles (
  id uuid primary key default auth.uid(),
  nombre text not null default '' check (length(nombre) <= 80),
  zona_horaria text not null default 'America/Santiago',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table modulos_usuario (
  usuario_id uuid not null default auth.uid(),
  modulo text not null check (modulo ~ '^[a-z_]{2,40}$'),
  activo boolean not null default true,
  orden int not null default 0,
  config jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, modulo)
);

create table widgets_usuario (
  usuario_id uuid not null default auth.uid(),
  widget text not null check (widget ~ '^[a-z_]{2,40}$'),
  visible boolean not null default true,
  orden int not null default 0,
  tamano text not null default 'mediano' check (tamano in ('chico', 'mediano', 'grande')),
  config jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, widget)
);

-- Qué áreas puede leer o escribir cada canal. La web siempre tiene acceso a su dueña.
create table accesos (
  usuario_id uuid not null default auth.uid(),
  canal canal_acceso not null,
  area area_datos not null,
  lectura boolean not null default false,
  escritura boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, canal, area),
  check (canal <> 'web')
);

create function tiene_acceso(a area_datos, escribir boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when canal_actual() = 'web' then true
    else coalesce((
      select case when escribir then x.escritura else x.lectura end
      from accesos x
      where x.usuario_id = auth.uid() and x.canal::text = canal_actual() and x.area = a
    ), false)
  end
$$;

-- ─────────────────────────── Historial ───────────────────────────
create table historial (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  tabla text not null,
  registro_id uuid not null,
  operacion text not null check (operacion in ('crear', 'editar', 'eliminar', 'restaurar')),
  antes jsonb,
  despues jsonb,
  canal text not null default 'web',
  creado_en timestamptz not null default now()
);
create index historial_por_registro on historial (usuario_id, tabla, registro_id, creado_en desc);

create function registrar_historial() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  op text;
begin
  if tg_op = 'INSERT' then
    insert into historial (usuario_id, tabla, registro_id, operacion, despues, canal)
    values (new.usuario_id, tg_table_name, new.id, 'crear', to_jsonb(new), canal_actual());
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.eliminado_en is null and new.eliminado_en is not null then op := 'eliminar';
    elsif old.eliminado_en is not null and new.eliminado_en is null then op := 'restaurar';
    else op := 'editar';
    end if;
    insert into historial (usuario_id, tabla, registro_id, operacion, antes, despues, canal)
    values (new.usuario_id, tg_table_name, new.id, op, to_jsonb(old), to_jsonb(new), canal_actual());
    return new;
  end if;
  return old;
end
$$;

create function tocar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

-- ─────────────────────────── Entidades de la fase 1 ───────────────────────────
create table registros_bienestar (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  fecha date not null,
  agua_vasos int not null default 0 check (agua_vasos between 0 and 40),
  meta_agua int not null default 8 check (meta_agua between 1 and 40),
  humor smallint check (humor between 1 and 5),
  energia smallint check (energia between 1 and 5),
  sueno_horas numeric(4, 1) check (sueno_horas between 0 and 24),
  notas text check (length(notas) <= 2000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en timestamptz
);
create unique index bienestar_un_registro_por_dia on registros_bienestar (usuario_id, fecha) where eliminado_en is null;

create table tareas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  titulo text not null check (length(titulo) between 1 and 300),
  descripcion text check (length(descripcion) <= 5000),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'hecha')),
  prioridad text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  vence date,
  area area_datos not null default 'personal' check (area <> 'salud_intima'),
  completada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en timestamptz
);
create index tareas_pendientes on tareas (usuario_id, estado, vence) where eliminado_en is null;

create table eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  titulo text not null check (length(titulo) between 1 and 300),
  inicio timestamptz not null,
  fin timestamptz,
  todo_el_dia boolean not null default false,
  lugar text check (length(lugar) <= 300),
  notas text check (length(notas) <= 5000),
  recordatorio_min int check (recordatorio_min between 0 and 10080),
  area area_datos not null default 'personal' check (area <> 'salud_intima'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en timestamptz,
  check (fin is null or fin >= inicio)
);
create index eventos_por_fecha on eventos (usuario_id, inicio) where eliminado_en is null;

-- Triggers de historial y fecha de actualización
create trigger historial_bienestar after insert or update on registros_bienestar for each row execute function registrar_historial();
create trigger historial_tareas after insert or update on tareas for each row execute function registrar_historial();
create trigger historial_eventos after insert or update on eventos for each row execute function registrar_historial();
create trigger actualizado_perfiles before update on perfiles for each row execute function tocar_actualizado();
create trigger actualizado_bienestar before update on registros_bienestar for each row execute function tocar_actualizado();
create trigger actualizado_tareas before update on tareas for each row execute function tocar_actualizado();
create trigger actualizado_eventos before update on eventos for each row execute function tocar_actualizado();

-- ─────────────────────────── Seguridad por fila (RLS) ───────────────────────────
alter table perfiles enable row level security;
alter table modulos_usuario enable row level security;
alter table widgets_usuario enable row level security;
alter table accesos enable row level security;
alter table historial enable row level security;
alter table registros_bienestar enable row level security;
alter table tareas enable row level security;
alter table eventos enable row level security;

create policy perfil_propio on perfiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy modulos_propios on modulos_usuario for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and canal_actual() = 'web');
create policy widgets_propios on widgets_usuario for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and canal_actual() = 'web');

-- Permisos: cualquiera de sus canales puede LEERLOS, solo la web puede CAMBIARLOS.
create policy accesos_leer on accesos for select to authenticated using (usuario_id = auth.uid());
create policy accesos_cambiar on accesos for insert to authenticated
  with check (usuario_id = auth.uid() and canal_actual() = 'web');
create policy accesos_editar on accesos for update to authenticated
  using (usuario_id = auth.uid() and canal_actual() = 'web')
  with check (usuario_id = auth.uid() and canal_actual() = 'web');

-- Historial: solo lectura y solo el propio. Lo escribe el trigger.
create policy historial_leer on historial for select to authenticated using (usuario_id = auth.uid());

-- Bienestar es área "personal"
create policy bienestar_leer on registros_bienestar for select to authenticated
  using (usuario_id = auth.uid() and tiene_acceso('personal', false));
create policy bienestar_crear on registros_bienestar for insert to authenticated
  with check (usuario_id = auth.uid() and tiene_acceso('personal', true));
create policy bienestar_editar on registros_bienestar for update to authenticated
  using (usuario_id = auth.uid() and tiene_acceso('personal', true))
  with check (usuario_id = auth.uid() and tiene_acceso('personal', true));

-- Tareas y eventos: el área va en cada fila
create policy tareas_leer on tareas for select to authenticated
  using (usuario_id = auth.uid() and tiene_acceso(area, false));
create policy tareas_crear on tareas for insert to authenticated
  with check (usuario_id = auth.uid() and tiene_acceso(area, true));
create policy tareas_editar on tareas for update to authenticated
  using (usuario_id = auth.uid() and tiene_acceso(area, true))
  with check (usuario_id = auth.uid() and tiene_acceso(area, true));

create policy eventos_leer on eventos for select to authenticated
  using (usuario_id = auth.uid() and tiene_acceso(area, false));
create policy eventos_crear on eventos for insert to authenticated
  with check (usuario_id = auth.uid() and tiene_acceso(area, true));
create policy eventos_editar on eventos for update to authenticated
  using (usuario_id = auth.uid() and tiene_acceso(area, true))
  with check (usuario_id = auth.uid() and tiene_acceso(area, true));

-- Sin DELETE para las personas: el borrado es suave (papelera).
grant usage on schema public to authenticated;
grant select, insert, update on perfiles, modulos_usuario, widgets_usuario, accesos to authenticated;
grant select on historial to authenticated;
grant select, insert, update on registros_bienestar, tareas, eventos to authenticated;
grant usage on type area_datos, canal_acceso to authenticated;
