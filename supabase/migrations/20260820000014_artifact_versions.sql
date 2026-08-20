-- Document versioning: every save of an artifact snapshots the PREVIOUS
-- content before it is overwritten (gate redos overwrite in place today).
-- A year from now, the evolution timeline of any deliverable is a query.

create table public.artifact_versions (
  id          uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  org_id      uuid not null,
  client_id   uuid not null,
  run_id      uuid,
  path        text not null,
  content     text not null,
  version     int  not null,
  replaced_at timestamptz not null default now()
);
create index artifact_versions_by_artifact on public.artifact_versions (artifact_id, version);
create index artifact_versions_by_client_path on public.artifact_versions (client_id, path, replaced_at);

alter table public.artifact_versions enable row level security;
create policy artifact_versions_read on public.artifact_versions for select to authenticated
  using (public.can_see_client(client_id));
grant select on public.artifact_versions to authenticated;
grant all on public.artifact_versions to service_role;

create function public.snapshot_artifact_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- snapshot only when the content actually changes
  if old.content is distinct from new.content and old.content is not null then
    insert into artifact_versions (artifact_id, org_id, client_id, run_id, path, content, version)
    values (old.id, old.org_id, old.client_id, old.run_id, old.path, old.content,
            coalesce((select max(version) from artifact_versions where artifact_id = old.id), 0) + 1);
  end if;
  return new;
end;
$$;

create trigger artifacts_version_snapshot
  before update on public.artifacts
  for each row execute function public.snapshot_artifact_version();
