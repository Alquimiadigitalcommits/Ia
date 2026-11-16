-- SOLO para pruebas y desarrollo local (PGlite). En Supabase esto ya existe.
-- Recrea lo mínimo de Supabase: el esquema auth, auth.uid() y el rol authenticated.
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to authenticated;
