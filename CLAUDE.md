# Operating this agency from Claude Code

This repo is a marketing agency whose method lives in data: `agents/`, `workflows/`, `skills/`
and `AGENCY.md`. `bin/agency` executes it.

The **system** is in English. The **deliverables** ship in each client's language
(`client.yaml -> language`). Keep that separation: do not translate the system to match a
client, and do not write a deliverable in English because the system is.

## The rule that does not bend

**Do not do the work yourself.** If the user asks for an audit, a calendar or an asset, your
job is to **run the command**, not to start writing the deliverable in chat.

Why it matters: when you run `agency run`, a session is launched with the right persona, a
narrowed skill catalog, the house rules injected, and the obligation to leave the artifact on
disk. If instead you answer directly, all four are lost — what remains is an ordinary
conversation, with the user's personal `~/.claude/CLAUDE.md` in the middle and no gates.
**It looks similar and it is not.**

## Gates belong to the human, not to you

**Never run `agency approve` on your own initiative.** A gate exists so a person looks at the
artifact and decides.

What you should do when a job is stopped at a gate:

1. Read the phase's artifact.
2. Summarise for the user what it says and **where it is weak** — above all: findings without
   a citation, numbers without an origin, recommendations without a verification metric, and
   whether it is in the client's language.
3. If something does not hold up, say so. You are the second pair of eyes, not the rubber stamp.
4. Wait for the user to decide.

Run `approve` only when the user explicitly asks. If they want changes, use
`agency reject <client> <workflow> "<what to change>"` with their verbatim feedback, then
`run` so the phase is redone.

## The commands

```sh
./bin/agency doctor                      # checks the method composes (free, no model)
./bin/agency clients                     # clients
./bin/agency new <id> --set k=v ...      # new client (see /agency:new — ask in chat first)
./bin/agency edit <client> --set k=v     # change a client's file
./bin/agency workflows                   # available jobs
./bin/agency status <client>             # where each job stands
./bin/agency run <client> <workflow>     # runs to the next gate
./bin/agency approve <client> <wf>       # ONLY if the user asks
./bin/agency reject <client> <wf> "..."  # reject with feedback; the phase is redone
./bin/agency ask <client> "<request>"    # no workflow: the model plans
```

Phases take minutes. Run `run` **in the background** and report when it finishes, instead of
blocking the conversation.

`new` and `edit` are interactive in a terminal. **From here there is no tty**, so always pass
`--set key=value` — otherwise the interview silently takes every default. See `/agency:new`.

## If another body of knowledge is needed

External methods are declared in `method.yaml` (repo, tag, where the skills are). Adding a
vertical means adding a row and running `agency setup` — the runner is not touched.

Two warnings before adding one: skill names are a flat namespace (if two methods ship
`analytics`, the last wins and `agency doctor` tells you), and a bigger catalog forces you to
narrow what each persona sees in `agents/`.

## Before starting a job

Check the client is complete, because everything else depends on it:

- `client.yaml` — `website` (required for `website-audit`), `language`, `icp`, and above all
  `tools`: an agent uses a CLI **only** if it is `true`. If `false`, the data point is declared
  as a hole. Do not set it `true` without a real credential.
- `brand.md` — voice, what we do NOT say, and what proof is available. If `Proof` is empty the
  copy cannot use figures. That is correct, not a problem to solve by inventing.
- `data/` — required for `growth-audit`. Without data that workflow delivers well-written
  opinion, not an audit; with only the site, `website-audit` is the right job.

## When a job finishes

If the user approves the final deliverable, copy it into `clients/<id>/knowledge/`. Every `.md`
in that folder is injected into every new job for that client: it is the account's memory and
what makes the next job better than the last.

## If the requested work has no workflow

Use `agency ask`. That mode forces the model to say whether the request **should** be a stable
workflow. If it says yes and the answer is good, propose writing `workflows/<id>.yaml` — that
is how the catalog grows out of real work instead of guessing.

## Publishing

No workflow publishes anything. They write drafts and plans; pressing the button is always an
explicit human action. Do not automate it and do not suggest it as a silent next step.
