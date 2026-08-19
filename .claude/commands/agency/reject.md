---
description: "Reject the gate with feedback; the phase is redone"
argument-hint: "<client> <workflow> <what to change>"
---

The user wants changes to the stopped phase: `$ARGUMENTS`.

1. If the feedback is vague ("I don't like it", "it's weak"), **ask what specifically** before
   running anything. A rejection without concrete feedback makes the phase come back equally
   bad and burns a whole run.
2. Run `./bin/agency reject <client> <workflow> "<the user's verbatim feedback>"`.
3. Run `./bin/agency run <client> <workflow>` in the background to redo the phase.
4. When it finishes, show what changed versus the previous version.
