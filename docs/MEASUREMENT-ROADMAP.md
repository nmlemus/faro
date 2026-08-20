# The measurement ladder — mapped 2026-08-20

Owner's directive: once money flows, Faro climbs from spending plans to causal
proof. Each rung is a WORKFLOW in the method (same machinery: phases, gates,
evidence, metrics-with-origin) — nothing here requires re-architecting.

## Rung 1 — Strategic allocation (next)
`strategic-plan` workflow (quarterly/annual). Where the money goes across
channels/markets/objectives before any tactical plan exists. Inputs: business
goals, historical metrics table, completed audits. Output: allocation with
floors/ceilings per bucket + the measurement contract for the period.
Gate: money (owner/director). Feeds media-plan as builds_on.

## Rung 2 — Tactical granularity (with write access)
Extends campaign-build + execution phase: campaign/adset/ad level operations
inside platforms via the vendored CLIs (meta-ads, google-ads, tiktok-ads
already in catalog). Requires ads_management tokens. Everything behind money
gates; dry-run first; per-client opt-in (handoff sheet remains the fallback).

## Rung 3 — Experiments: A/B + in-market tests
`experiment` workflow (design → money/measurement gate → setup → readout):
- A/B: creative/audience/landing splits set up in-platform via CLI.
- In-market (geo-lift, holdouts): test design with power analysis, market
  selection, run window, then readout against the BUSINESS variable the
  client cares about (sales, app installs, retention — declared in the
  measurement contract, never proxies-only).
Readouts write to `metrics` with source_path like everything else. The
optimization-loop's TEST verb graduates from proposing to launching.

## Rung 4 — Causal inference / MMM (mapped today, built later)
`mmm` workflow using **pymc-marketing** (which ships its own AI agents —
evaluate embedding them as the modeling step inside our phase).
- Engine impact: first NON-claude phase runner — a python job (pymc) in its
  own container with real deps (pymc, pandas). The worker gains a phase
  `runner: python` alongside the default claude runner. Long-running phases
  already survive via the reaper + progress events.
- Data: needs 2y+ weekly spend/outcome series per channel — the metrics
  table accumulates exactly this shape from rung 1 onward. **Every week of
  operation from today is training data for the MMM.**
- Deliverables: channel contribution, saturation curves, budget optimizer →
  feeds rung 1's next strategic plan. Gates: measurement (model quality,
  analyst) then money (reallocation, owner).
- Positioning: this rung is the Nielsen/Kantar-competing capability from the
  original thesis.

## Sequencing gates (what unlocks what)
1 needs: nothing new (build when first real budget lands).
2 needs: ads_management tokens per client.
3 needs: rung 2 + enough volume for power.
4 needs: rungs 1-3 running long enough to have series (or client historicals).

Dependency note: pymc-marketing/pymc = new Python deps, isolated in the mmm
runner container — the core engine stays stdlib.
