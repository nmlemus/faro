-- RLS: org isolation + role-gated decisions + client-scoped portal access.
-- Writes to runtime tables (phases, artifacts, events) are service-role only:
-- no insert/update policies for authenticated means the engine is the only writer.

-- Staff = any member who is not a client_viewer.
create function public.is_staff(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and m.role <> 'client_viewer');
$$;

create function public.org_role(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from org_members m
  where m.org_id = p_org and m.user_id = auth.uid();
$$;

create function public.can_see_client(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients c where c.id = p_client and public.is_staff(c.org_id))
      or exists (select 1 from client_members cm
                 where cm.client_id = p_client and cm.user_id = auth.uid());
$$;

-- Who may decide a gate of a given class: the roles design, in one place.
create function public.can_decide_gate(p_client uuid, p_class text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.org_role((select org_id from clients where id = p_client))
    when 'owner'            then true
    when 'account_director' then coalesce(p_class,'craft') in ('money','craft','publish','measurement')
    when 'specialist'       then coalesce(p_class,'craft') = 'craft'
    when 'analyst'          then coalesce(p_class,'craft') = 'measurement'
    else coalesce(p_class,'') = 'publish'
         and exists (select 1 from client_members cm
                     where cm.client_id = p_client and cm.user_id = auth.uid())
  end;
$$;

alter table orgs            enable row level security;
alter table org_members     enable row level security;
alter table clients         enable row level security;
alter table client_members  enable row level security;
alter table credentials     enable row level security;
alter table method_versions enable row level security;
alter table jobs            enable row level security;
alter table job_runs        enable row level security;
alter table phases          enable row level security;
alter table gate_decisions  enable row level security;
alter table artifacts       enable row level security;
alter table activity_events enable row level security;
alter table audit_log       enable row level security;

create policy org_read on orgs for select using (
  exists (select 1 from org_members m where m.org_id = id and m.user_id = auth.uid()));

create policy members_read on org_members for select using (
  org_id in (select org_id from org_members where user_id = auth.uid()));

create policy clients_read on clients for select using (can_see_client(id));
create policy clients_write on clients for all using (
  org_role(org_id) in ('owner','account_director'))
  with check (org_role(org_id) in ('owner','account_director'));

create policy client_members_read on client_members for select using (
  can_see_client(client_id));

-- Secrets metadata: owner eyes only. Values live in Vault, unreachable from the API.
create policy credentials_owner on credentials for all using (
  org_role(org_id) = 'owner') with check (org_role(org_id) = 'owner');

create policy method_read on method_versions for select using (true);

create policy jobs_read     on jobs            for select using (can_see_client(client_id));
create policy runs_read     on job_runs        for select using (can_see_client(client_id));
create policy phases_read   on phases          for select using (can_see_client(client_id));
create policy artifacts_read on artifacts      for select using (can_see_client(client_id));
create policy events_read   on activity_events for select using (can_see_client(client_id));
create policy decisions_read on gate_decisions for select using (can_see_client(client_id));

-- The ONE authenticated write: deciding a gate you are entitled to decide.
create policy decisions_insert on gate_decisions for insert with check (
  decided_by = auth.uid() and can_decide_gate(client_id, gate_class));

create policy audit_read on audit_log for select using (
  org_role(org_id) in ('owner','account_director'));
