-- Marta #4: the results layer. Structured KPIs extracted from deliverables —
-- every row points at the artifact it came from, so every chart keeps
-- "every number has an origin".

create table public.metrics (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  run_id      uuid references public.job_runs(id) on delete set null,
  phase_id    uuid references public.phases(id) on delete set null,
  metric      text not null,            -- e.g. spend, cac, conversions, ctr
  channel     text not null default '', -- e.g. meta, google, email; '' = account-wide
  period      text not null,            -- ISO week 2026-W34 or month 2026-08
  value       numeric not null,
  unit        text,                     -- usd, %, count …
  source_path text not null,            -- artifact path the number came from
  created_at  timestamptz not null default now(),
  unique (client_id, metric, channel, period, source_path)
);

create index metrics_client_series on public.metrics (client_id, metric, channel, period);

alter table public.metrics enable row level security;

create policy metrics_read on public.metrics for select to authenticated
  using (public.can_see_client(client_id));

-- writes come only from the engine (service_role bypasses RLS via grant)
grant select on public.metrics to authenticated;
grant all on public.metrics to service_role;
