# Operating model — a real media agency, end to end

*Plan, 2026-08-19. Grounded in the actual catalog: 51 skills and 64 tool CLIs were
reviewed against how a full-service media agency actually runs. This is the blueprint
for turning a system that audits sites into a system that runs accounts.*

---

## 1. What a real media agency does

Not "analyze a site". The lifecycle of a paying account:

```
PITCH            audit + proposal — free or cheap, opens the account
ONBOARD          accesses, tracking foundation, baseline numbers    ← everything depends on this
PLAN             objectives → channel mix → budget split → targets
PRODUCE          campaign structures, ads, landing pages, emails
TRAFFICK         QA + launch in the platforms
OPTIMIZE         the weekly loop: pause / scale / shift money       ← where the retainer lives
REPORT           monthly: vs targets, in client language
REPLAN           quarterly: what the data changed
```

Two horizontal practices serve every stage: **creative** (ads wear out; refresh is
constant) and **measurement** (if attribution is broken, every other number lies).

The money insight: **pitch → plan happens once; optimize → report repeats forever.**
The current system only covers the left side. The retainer — the part agencies bill
monthly — is the loop, and the loop does not exist yet.

## 2. Coverage map — what the catalog already supports

Reviewed skill by skill. The raw material is much better than the current 4 workflows use:

| agency function | skills that cover it | tool CLIs | status |
|---|---|---|---|
| Pitch / audit | seo-audit, cro, landing-page, competitors, competitor-profiling | similarweb, semrush, ahrefs | ✅ covered (website-audit, growth-audit) |
| Measurement foundation | **analytics** (tracking plans, GA4, GTM, UTM), **attribution** ("my dashboards disagree", real CAC) | ga4, google-search-console, segment, mixpanel, amplitude, posthog | ⚠️ skills exist, **no workflow** |
| Media planning | **ads** (channel choice, budget, ROAS/CPA), marketing-plan (AARRR), pricing, offers | — | ⚠️ skills exist, **no workflow** |
| Campaign production | **ad-creative** (headlines/variations at scale, RSA, creative testing), copywriting, landing-page, signup, ab-testing | google-ads, **meta-ads, tiktok-ads, linkedin-ads** | ⚠️ skills + CLIs exist, **no workflow** |
| Lifecycle / CRM | emails, sms, **onboarding**†, churn-prevention, lead-magnets, revops (scoring, MQL/SQL, handoff) | mailchimp, klaviyo, customer-io, brevo, sendgrid, kit, hubspot, salesforce, close | ⚠️ skills exist, **no workflow** |
| Organic | seo-audit, programmatic-seo, ai-seo, content-strategy, social, social-by-platform, schema, site-architecture | gsc, semrush, ahrefs, buffer | ✅ partial (content-engine) |
| The optimization loop | **marketing-loops** — literally "recurring agent-run workflows: weekly review, ad fatigue check, churn watch", ab-testing, cro | **all the ads + analytics CLIs** | ❌ **the biggest gap** |
| Reporting | analytics, attribution | ga4 + platform CLIs | ❌ missing |
| App practice | **aso**† | — | optional vertical |
| Sales support | **sales-enablement**†, **free-tools**† | — | optional vertical |

† = the four orphan skills nobody can reach today. Three of them (onboarding, aso,
sales-enablement) are exactly the lifecycle/app/sales practices the roster lacks.

**Conclusion of the review:** the catalog is not the bottleneck. The bottleneck is
that (a) the roster has no media buyer and no measurement owner, (b) there is no
recurring workflow — and the runner cannot represent one, and (c) nothing closes the
loop from numbers back to money movements.

## 3. Target shape

### 3.1 The roster grows from 6 to 8 — practices, not job titles

Keep the 6. Add 2, and sharpen 2:

| agent | practice | key skills | new? |
|---|---|---|---|
| strategist | account strategy, budget allocation | marketing-plan, offers, pricing, ads | sharpened: owns the media plan |
| **media-buyer** | paid: structure, bids, budgets, pacing | **ads, ab-testing, attribution, ad-creative** | **NEW** |
| **measurement-analyst** | tracking, attribution, reporting truth | **analytics, attribution**, ab-testing | **NEW** (analyst evolves: analyst keeps funnel/cohorts; this one owns tracking + reporting) |
| copywriter | creative studio | ad-creative, copywriting, video, image, landing-page | sharpened: ad variations at scale |
| researcher | audience, competitive, market | unchanged | |
| channel-planner | organic + lifecycle planning | + emails, sms, onboarding†, churn-prevention | absorbs lifecycle |
| editor | last filter, claims, brand safety | + ad policy sanity (no misleading claims in paid) | |
| analyst | funnel, cohorts, unit economics | unchanged | |

This re-homes 3 of the 4 orphans (onboarding → channel-planner; aso and
sales-enablement → declared optional verticals, or dropped from the default catalog).

### 3.2 Five new workflows, in dependency order

```
onboarding            ← the foundation everything else builds on
  access checklist (which of the 64 CLIs can we actually use) → tracking audit
  (analytics skill) → attribution baseline ("what do the dashboards disagree on")
  → KPI definitions signed at a gate. Deliverable: measurement-foundation.md.
  WITHOUT THIS, the optimization loop optimizes lies.

media-plan            builds_on: website-audit, growth-audit, onboarding
  objectives → channel mix with rationale (ads skill) → budget split with expected
  CPA/ROAS per channel → flighting calendar → targets. GATE: the client signs the
  money. Deliverable: media-plan.md — the contract the loop optimizes against.

campaign-build        builds_on: media-plan          (one job PER CHANNEL)
  campaign structure (campaigns/ad sets/audiences) → ads at scale (ad-creative:
  N headlines × M descriptions, variations mapped to angles) → landing page spec
  (landing-page skill) → UTM plan (analytics) → launch checklist. GATE: nothing
  reaches a platform without approval. Deliverable: launch-ready spec a human (or
  later, a gated CLI call) executes.

optimization-loop     RECURRING, weekly — the retainer heartbeat
  pull performance (platform CLIs if connected; else ask for exports — declared
  hole as always) → judge vs media-plan targets → recommendations table:
  PAUSE (what, why, evidence) / SCALE (what, expected marginal CPA) / SHIFT
  (from where to where, how much, why) / REFRESH (creative fatigue: frequency
  up + CTR down = the ad is tired) / TEST (next experiment from the queue).
  GATE: every money movement is approved by a human. The marketing-loops skill
  is the method; ab-testing governs the test queue.

monthly-report        RECURRING, monthly — builds_on: media-plan, optimization-loop
  what was spent vs planned → what it bought (by channel, vs targets) → what the
  loop changed and what happened after → holes declared → next month. In the
  client's language. This is the artifact that renews the retainer.
```

Plus one small one later: `creative-refresh` (copywriter + editor only) so the loop
can order new ad batches without re-running campaign-build.

### 3.3 What the runner needs — the ONE structural change

Everything above is YAML except this: **recurring workflows.** Today a job is
`clients/<id>/jobs/<workflow>/` — one instance forever. A loop needs dated runs:

```
clients/acme/jobs/optimization-loop/
  2026-08-19/   01-performance.md  02-recommendations.md  state.json
  2026-08-26/   …
```

- `recurring: weekly|monthly` in the workflow YAML
- runner: a new run = a new dated folder; `latest` resolves to the newest
- prior_jobs injection: a recurring job injects its OWN previous run (so week 2
  knows what week 1 changed) plus the media-plan it optimizes against
- console: recurring jobs render as a timeline of runs, not a single rail
- ~100 lines in the runner, one day of work. Everything else stays data.

### 3.4 Closing the money loop — in three honest stages

The user's phrase: "ver a dónde y cómo se optimiza la plata."

1. **Stage 1 (recommend):** the loop produces the PAUSE/SCALE/SHIFT table with
   evidence and expected impact. A human executes in the platform. Ships with the
   loop itself — zero new mechanics.
2. **Stage 2 (one-click, gated):** each recommendation carries the exact CLI call
   (`google-ads.js`, `meta-ads.js`…) that would execute it. Approving the gate in
   the console runs it and logs the platform's response as evidence. House rule 5
   holds: writing the recommendation is the system's job; the button is human.
3. **Stage 3 (bounded autopilot):** per-client policy in client.yaml — e.g. "may
   pause ads autonomously; may never raise a budget; ±10% weekly shift cap". Only
   after stage 2 has months of history. Not before.

### 3.5 Engagement templates — how it sells

The console's map today hardcodes one chain. Real accounts differ:

| package | workflows | cadence |
|---|---|---|
| **Audit** (door-opener) | website-audit | once |
| **Performance** (media retainer) | onboarding → media-plan → campaign-build×N → optimization-loop + monthly-report | weekly + monthly |
| **Full-funnel** | Performance + content-engine + lifecycle | everything |

`engagement:` field per client picks the template; the console renders that chain.

## 4. Build order

| phase | what | effort | unblocks |
|---|---|---|---|
| 1 | media-buyer + measurement-analyst personas; onboarding + media-plan workflows | YAML only | planning revenue; the orphans get homes |
| 2 | recurring runs in the runner + console timeline | ~1 day code | the retainer |
| 3 | optimization-loop + monthly-report workflows | YAML | the actual heartbeat |
| 4 | campaign-build (+ creative-refresh) | YAML | production revenue |
| 5 | stage-2 gated execution via ads CLIs | code, small | "the money moves from the console" |
| 6 | engagement templates | small | packaging/sales |

Phases 1+3+4 are pure data — the thesis holds. Phase 2 is the one structural
change, and it is the difference between a project tool and an agency tool.

## 5. What was deliberately left out

- **Programmatic/DSP, TV, OOH** — no tooling in the catalog; out of scope honestly.
- **MMM / incrementality testing** — attribution skill covers model choice;
  real MMM needs a data practice this system should not fake.
- **Autopilot money movements (stage 3)** — designed, gated behind history.
- **Multi-seat / client portal** — after there are accounts worth portaling.
