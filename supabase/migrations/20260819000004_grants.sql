-- This local stack does not auto-grant on new tables; make it explicit.
-- RLS remains the actual boundary for anon/authenticated.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to service_role, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
