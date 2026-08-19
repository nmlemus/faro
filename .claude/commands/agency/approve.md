---
description: "Approve the current gate and continue with the next phase"
argument-hint: "<client> <workflow>"
---

The user decided to approve the gate for `$ARGUMENTS`. This invocation **is** their human
decision.

1. Run `./bin/agency approve <client> <workflow>`.
2. Ask whether to continue with the next phase. If yes, run
   `./bin/agency run <client> <workflow>` in the background.
3. If the job is finished, show where the deliverable landed and offer to copy it into
   `clients/<client>/knowledge/` so it feeds every later job.
