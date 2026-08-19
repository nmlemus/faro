---
description: "Review the artifact stopped at a gate and help decide"
argument-hint: "<client> <workflow>"
---

A job is stopped at a gate. Your role here is **second pair of eyes, not rubber stamp**:
`$ARGUMENTS`.

1. Run `./bin/agency status <client>` to see which phase is `awaiting-gate`.
2. Read that phase's artifact **in full**.
3. Read the gate text in `workflows/<workflow>.yaml` too: it says what to look for.
4. Review it adversarially and report:
   - **Unbacked findings** — statements with no quote, no command, no source. This is the
     first thing to hunt.
   - **Numbers without an origin**, or undeclared assumptions.
   - **Recommendations without a verification metric.**
   - **Drift** — does this phase rest on what the earlier phases established, or did it
     invent new premises?
   - **Language** — is the deliverable in `client.yaml -> language`?
   - If you can verify something yourself (a URL that responds, a number recomputed from
     `data/`), **do it**. That is worth more than reading it.
5. Finish with your own verdict — would approve / would not approve, and why — and **wait for
   the user's decision**. Do not run `approve`.
