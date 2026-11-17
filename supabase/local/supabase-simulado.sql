-- SOLO para pruebas y desarrollo local (PGlite). En Supabase esto ya existe.
-- Recrea lo mínimo de Supabase: el esquema auth, auth.uid(), los roles anon y authenticated,
-- y sus privilegios por defecto (Supabase concede TODO sobre las tablas nuevas a ambos roles:
-- simularlo hace que las pruebas detecten si una migración olvida retirar permisos).
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
