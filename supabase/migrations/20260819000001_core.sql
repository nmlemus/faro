-- Core schema: the platform's runtime state. The METHOD (agents, workflows,
-- skills) deliberately lives in git, not here — see docs/PLATFORM-ARCHITECTURE.md.

-- ── tenants ─────────────────────────────────────────────────────────────────
create table orgs (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name       text not null,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in
               ('owner','account_director','specialist','analyst','client_viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ── clients ─────────────────────────────────────────────────────────────────
create table clients (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  slug       text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name       text not null,
  website    text,
  language   text not null default 'English',
  business   text, icp text, cadence text,
  brand      jsonb not null default '{}'::jsonb,
  tools      jsonb not null default '{}'::jsonb,
  engagement text not null default 'audit'
             check (engagement in ('audit','performance','full_funnel')),
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- client_viewer users attach here: the client portal is a role + this table.
create table client_members (
  client_id  uuid not null references clients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  primary key (client_id, user_id)
);

-- Secrets: only Vault references, never values.
create table credentials (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  tool       text not null,
  secret_id  uuid not null,          -- vault.secrets id
  created_at timestamptz not null default now(),
  unique (org_id, client_id, tool)
);

-- ── method provenance ───────────────────────────────────────────────────────
create table method_versions (
  id         uuid primary key default gen_random_uuid(),
  git_sha    text unique not null,
  manifest   jsonb not null,          -- agents/workflows/skills at that sha
  created_at timestamptz not null default now()
);

-- ── work ────────────────────────────────────────────────────────────────────
create table jobs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  workflow_id       text not null,
  recurring         text check (recurring in ('weekly','monthly')),
  method_version_id uuid references method_versions(id),
  created_at        timestamptz not null default now(),
  unique (client_id, workflow_id)
);

-- Recurrence is native: one job, many dated runs. One-shot jobs use run_key 'main'.
create table job_runs (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references jobs(id) on delete cascade,
  org_id     uuid not null references orgs(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  run_key    text not null default 'main',
  status     text not null default 'active'
             check (status in ('active','complete','abandoned')),
  created_at timestamptz not null default now(),
  unique (job_id, run_key)
);

create table phases (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references job_runs(id) on delete cascade,
  org_id     uuid not null references orgs(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  seq        int  not null,
  phase_id   text not null,
  agent      text not null,
  produces   text not null,
  gate_class text check (gate_class in ('money','craft','publish','measurement')),
  gate_text  text,
  status     text not null default 'blocked'
             check (status in ('blocked','pending','running','awaiting_gate',
                               'done','failed','rejected')),
  feedback   text,                    -- from a rejection, folded into the redo
  error      text,
  claimed_by text,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, phase_id)
);
create index phases_claimable on phases (status) where status = 'pending';

-- Every human decision, forever: the audit trail a buyer reads first.
create table gate_decisions (
  id           uuid primary key default gen_random_uuid(),
  phase_id     uuid not null references phases(id) on delete cascade,
  org_id       uuid not null references orgs(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  gate_class   text,
  decision     text not null check (decision in ('approved','rejected')),
  decided_by   uuid references auth.users(id),
  decided_name text,
  feedback     text,
  created_at   timestamptz not null default now()
);

create table artifacts (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references job_runs(id) on delete cascade,
  phase_id    uuid references phases(id) on delete set null,
  org_id      uuid not null references orgs(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  path        text not null,
  content     text,                   -- markdown lives here, searchable
  storage_ref text,                   -- binaries go to Storage
  created_at  timestamptz not null default now(),
  unique (run_id, path)
);

-- The live feed the UI streams over Realtime.
create table activity_events (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references orgs(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  run_id     uuid not null references job_runs(id) on delete cascade,
  phase_id   uuid references phases(id) on delete set null,
  type       text not null,           -- session_start | tool | text | done | error | system
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_by_run on activity_events (run_id, id);

create table audit_log (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references orgs(id) on delete cascade,
  actor      uuid references auth.users(id),
  actor_name text,
  action     text not null,
  subject    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── realtime ────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table activity_events, phases;
