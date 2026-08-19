---
description: "Run a job until the next gate"
argument-hint: "<client> <workflow>"
---

Run an agency job: `$ARGUMENTS` (client and workflow).

1. Before starting, check the client is ready — read their `client.yaml` and `brand.md`. If
   something the first phase needs is missing (a `website` for `website-audit`, files in
   `data/` for `growth-audit`), **say so and stop**. Do not start a job that will produce a
   hollow deliverable. The CLI also preflights this, but catching it in conversation is faster.
2. Run `./bin/agency run <client> <workflow>` **in the background** — each phase takes
   several minutes.
3. When it finishes, report which phases ran, where it stopped, and what each produced.
4. If it stopped at a gate, do not approve it: offer `/agency:review`.
5. If a phase failed, show the error and the real state. A phase with no artifact on disk is
   not done, even if the model said it was.
