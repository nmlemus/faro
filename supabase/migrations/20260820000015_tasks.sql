-- The task board: what the workflows and the humans generate as work-to-do,
-- assignable, filterable by account or person. Staff-facing (v1).

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  run_id        uuid references public.job_runs(id) on delete set null,
  title         text not null,
  detail        text,
  status        text not null default 'todo' check (status in ('todo','doing','done')),
  assignee      uuid,
  assignee_name text,
  due_date      date,
  source        text not null default 'manual' check (source in ('manual','gate','handoff','workflow')),
  created_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  done_at       timestamptz
);
create index tasks_board on public.tasks (org_id, status, updated_at desc);
create index tasks_by_assignee on public.tasks (assignee, status);
create index tasks_by_client on public.tasks (client_id, status);

alter table public.tasks enable row level security;
create policy tasks_staff_all on public.tasks for all to authenticated
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

create or replace function public.touch_task()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  return new;
end; $$;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_task();

-- who can be assigned: the org's staff with their display names
create function public.org_staff(p_org uuid)
returns table (user_id uuid, name text, role text)
language sql security definer set search_path = public as $$
  select m.user_id,
         coalesce(u.raw_user_meta_data->>'name', u.email) as name,
         m.role
  from org_members m join auth.users u on u.id = m.user_id
  where m.org_id = p_org and m.role <> 'client_viewer'
    and public.is_staff(p_org);
$$;
revoke all on function public.org_staff(uuid) from public;
grant execute on function public.org_staff(uuid) to authenticated;
