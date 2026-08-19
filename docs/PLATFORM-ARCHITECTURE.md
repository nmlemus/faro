# Platform architecture — the AI-native agency as a product

*2026-08-19. Supersedes the "local tool" framing. Premises set by the owner: this is a
new thing (no prior project's constraints apply); multi-tenant from the design; Postgres/
Supabase as substrate (already the local practice — CLI 2.113.0, per-project stacks in
Docker); must be deployable wherever a buyer wants it; the whole system must be sellable
to a traditional agency (Publicis/Kantar-scale) as-is; UI at the level of the best
competitors (Metaflow, Magister, NoGood); no POC mentality.*

---

## 1. The shape: three planes, one hard rule

```
┌─ PLATFORM ────────────────────────────────────────────────────────┐
│  Next.js app · Supabase (Postgres + Auth + Realtime + Storage +   │
│  Vault) · multi-tenant · roles · the amazing UI                   │
├─ ENGINE ──────────────────────────────────────────────────────────┤
│  Workers that execute phases: claim job → assemble prompt →       │
│  run claude (stream-json) → persist artifact + events → stop at   │
│  gates. Today's runner, re-plumbed from filesystem to Postgres.   │
├─ METHOD ──────────────────────────────────────────────────────────┤
│  agents/ · workflows/ · skills/ · AGENCY.md · method.yaml         │
│  Stays in GIT, versioned, MIT-composable. THE sellable IP.        │
└───────────────────────────────────────────────────────────────────┘
```

**The hard rule: the method never moves into the database.** Runtime state lives in
Postgres; the method (personas, workflows, skills, house rules) lives in git and is
mounted into engines. This is what makes the system sellable as a whole — a buyer gets
a repo they can read, fork and extend, not rows in our database — and what lets us
gradually replace Corey Haines' skills with our own core without a data migration.
Engines sync the method into a read model (`method_versions`) so the UI can render it
and every job records *which method version produced it* — provenance a Kantar buyer
will ask about on day one.

## 2. Data model (Postgres, RLS everywhere)

```
orgs                 the tenant. An agency (ours is just the first row)
org_members          user_id · org_id · role: owner | account_director |
                     specialist | analyst | client_viewer
clients              org_id · name · website · language · icp · brand (jsonb) ·
                     engagement (audit | performance | full_funnel)
client_members       scoping: which members see which clients; client_viewer
                     users attach HERE — the client portal falls out of this
credentials          org_id · client_id · tool · secret_ref → Supabase Vault.
                     Never in client rows, never in artifacts
jobs                 client_id · workflow_id · method_version · recurring rule
job_runs             job_id · run_date — RECURRING IS NATIVE from day one
                     (the weekly optimization loop was the retainer heartbeat
                     in the operating model; here it is just rows)
phases               run_id · phase_id · agent · status: pending | running |
                     awaiting_gate | done | failed | rejected · claimed_by
gate_decisions       phase_id · decision · decided_by · feedback · gate_class:
                     money | craft | publish | measurement — the audit trail
                     and the role-permission hook in one table
artifacts            phase_id · path · content (md) · storage_ref for binaries
activity_events      run_id · seq · type · payload — the live feed, streamed
                     to the UI via Supabase Realtime
method_versions      git sha · manifest of agents/workflows/skills at that sha
audit_log            append-only: who did what, when, from where
```

**RLS strategy:** every table carries `org_id` (denormalized where needed); policies
derive from `org_members.role` + `client_members`. `client_viewer` reads only their
client's runs, artifacts and `publish`-class gates. Workers use the service role and
are the only writers of phase/artifact/event rows. Under the old premises RLS was
over-engineering; under "sellable to Publicis" it is table stakes — their security
review will read these policies before anything else.

## 3. The engine — how today's runner becomes workers

Same loop, new plumbing:

1. Worker claims a `phases` row atomically (`FOR UPDATE SKIP LOCKED` — Postgres is
   the queue; no Redis, no extra moving part).
2. Assembles the prompt exactly as today: house rules + client context + prior
   artifacts (`builds_on` and prior runs come from `artifacts` instead of the
   filesystem) + the persona's skill catalog from the mounted method checkout.
3. Runs `claude -p --output-format stream-json`; every event lands in
   `activity_events` (the humanizer moves server-side, unchanged) → Realtime → UI.
4. Artifact to `artifacts`; status transition; gate rows created; stop at gates.

Engines are stateless containers: `image: agency-engine` + method git ref + service
key. Scale = run more of them. A buyer's on-prem deploy = the same compose file
pointed at their Supabase. **The CLI survives** as a thin client of the same API —
useful for us, invisible to clients.

What carries over untouched from the proven system: prompt assembly, gates, the
artifact-or-it-didn't-happen rule, preflight validation, the log humanizer, doctor
(now validating method + DB migrations). What dies: `state.json`, pid files,
`jobs/<wf>/` directories as the source of truth.

## 4. Auth, roles, tenancy

- **Supabase Auth** (email magic link + Google to start; SSO/SAML is a paid-buyer
  feature, slot reserved, not built).
- Role model as designed in the roles discussion: `gate_class` on every gate, roles
  grant *classes* not individual gates; money gates = owner/account_director;
  publish gates = client_viewer can approve — **the portal is not a feature, it is
  a role**.
- Tenancy: shared Postgres + RLS for our own SaaS operation; **the same images
  deploy single-tenant on a buyer's infrastructure** (their Supabase, their keys).
  Both modes from one codebase — this duality IS the product strategy: we operate
  multi-tenant, we sell single-tenant.

## 5. The UI — honest audit of what exists, and the bar

**Verdict on the current console and landings (mine, so no mercy):** functionally
correct, visually a project — not a product. Specifics: stdlib-served single-file
HTML with DOM-built views; a borrowed MD3-ish token set applied timidly; no brand
(literally named "agency"); no typographic point of view at product scale; list-shaped
screens where the work (deliverables, activity, decisions) deserves document-shaped
and feed-shaped surfaces; zero motion design; nothing that says *strong agency* in
the first five seconds. It was the right artifact to prove the engine. It is the
wrong artifact to show a client, and the owner said exactly that.

**The bar** (from the market research): Metaflow, Magister, NoGood — sites that read
as confident products. Ours must additionally read as *an agency you'd trust with
your budget*, in Spanish and English.

**Build:** Next.js (App Router) + Tailwind + a real design system owned by us —
name, voice, type pairing, motion language — defined once in `design/` and enforced.
Key surfaces, in build order:
1. **The client portal** (what a client sees: their runs, deliverables rendered
   beautifully, publish gates to approve) — this is also the sales demo.
2. **The operator console** (all clients, gate queue across accounts, activity).
3. **The public site** (the storefront; built WITH our own method — content-engine
   and landing-page skills produce it, which is itself the proof).

## 6. Deployment

- `deploy/docker-compose.yml`: supabase stack + N × engine + web. One command,
  anywhere — laptop today, VPS tomorrow, buyer's cloud later.
- Migrations via `supabase migration` (SQL in repo, versioned like the method).
- Secrets: Supabase Vault + env; never in images.

## 7. Build sequence (replaces the local-tool phasing)

| # | deliverable | proves |
|---|---|---|
| P0 | `supabase init` + schema migration + RLS policies + seed | the substrate |
| P1 | engine v2: one phase end-to-end against Postgres (claim → claude → artifact → gate) | the re-plumb works |
| P2 | design system + client portal (read + approve publish gates) | the amazing UI, smallest surface first |
| P3 | operator console on the same design system | we can operate on it |
| P4 | recurring runs + optimization-loop + monthly-report workflows | the retainer (operating-model phases 2–3 land here) |
| P5 | media-buyer/measurement personas + media-plan/campaign-build | the media practice (phases 1+4) |
| P6 | gated execution via ads CLIs; engagement templates; public site | money moves; packaging |

The operating-model roadmap (docs/OPERATING-MODEL.md) is unchanged in content —
its phases now land on this substrate instead of the filesystem.

## 8. Explicitly deferred (named so they're decisions, not omissions)

SSO/SAML & SOC2 track (when a real enterprise buyer appears) · MMM & synthetic-
research practice (the Kantar-attack layer — after the agency operates) · billing/
metering (Stripe slot reserved) · mobile.
