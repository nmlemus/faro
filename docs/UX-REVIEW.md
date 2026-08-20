# Adversarial UX/UI review — 2026-08-20

Auditor: uncontaminated agent, senior product designer persona, browsing the
live app as staff AND as client. Verdict: "would not ship to paying clients
today" — visual identity and signed provenance are real differentiators, but
the client portal leaked agency internals.

Status legend: [x] fixed · [ ] open

## P0 — pre-launch absolutes
- [x] Client sees AI run cost ($3.38 + per-phase) → costs are staff-only now
- [x] Client sees raw agent log (model name, internal paths, "ran without data"
      confession) → activity panel is staff-only; renamed "activity log" when
      idle (pulse only while running)
- [x] Destructive actions dressed as plain text → red outlined buttons; run
      delete moved to bottom of page; account delete in a "danger zone" with
      type-the-name confirmation

## P1 — before any real client gets credentials
- [x] "account settings" / "connectors" look like metadata, not actions →
      now bordered pill buttons with icon and connection count
- [x] Connectors: human tool & field labels (env var kept as hint),
      backticks stripped, connected state on chips
- [x] Client-facing names are slugs → clients see "Growth audit", "Leer:
      Diagnosis", dates instead of run_keys; staff keeps technical slugs
- [x] Client portal chrome localized by client language (es dict incl. the
      gate approval flow); language is a select in settings
- [x] Document auto-scrolls into view on open
- [~] No forgot-password on login — support line added ('write to your account director'); email reset flow pending SMTP
- [x] Desk table rows fully clickable (keyboard too)
- [x] Branded 404 with 'back to your account'

## P2 — polish
- [ ] Progress bars: no labels/tooltips per segment
- [x] Desk KPIs are anchor links to their sections (jargon labels kept for now)
- [x] Start modal states steps + approvals before confirming
- [x] Doc viewer: human title (deliverable's own H1) as header, filename
      staff-only; single "Export PDF ↗"; print button says what it does
- [ ] Deliverable meta line runs together ("Date: … Prepared for: …")
- [x] Settings: language/cadence selects, cancel button, visible notice
- [x] Login panel copy — now "audits, media plans, weekly optimization — run
      by AI, signed by people"

## Keep (auditor's list of what works)
Visual identity & contrast; signed pipeline provenance ("Approved by Noel");
Start-modal microcopy; connectors vault note; export letterhead; access scoping;
login error UX (keeps email, inline red).

## Coverage gap
No open gate existed during the audit — the client-approves-a-publish-gate flow
(the trust-critical moment) is still unaudited. Audit it when one is live.

## Supplement (2026-08-20, second pass)
- [x] Dead controls pre-hydration: login lost typed credentials (controlled
      inputs reset on hydrate; hit by both auditors AND the owner earlier) →
      login is a native form via server action: works without JS, friendly
      error, keeps email without putting it in the URL
- [x] Duplicate metric card PAID vs PAID CUSTOMERS → not corruption: two
      deliverables named the same concept differently; data normalized and
      AGENCY.md rule 1b now carries a canonical metric vocabulary
- [x] 404 on demo-saas media-plan run → not a bug: shared-cookie interference
      between two simultaneous audit sessions; run opens fine as owner
- [ ] Still uncovered: the client-approves-a-publish-gate flow (no open gate
      existed during either pass)
