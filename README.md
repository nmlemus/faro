# agency

An AI-operated marketing agency. **The method is data, not code.**

The skills are third-party ([coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills),
MIT) — 49 methods and 64 tool CLIs, vendored and pinned. What is ours is what was missing on
top: **personas, gated workflows, own skills, per-client memory, and a runner.**

**Which bodies of knowledge the agency mounts is declared in `method.yaml`, not in the code.**
Switching vertical — marketing today, data or development tomorrow — is adding a row there and
running `agency setup`.

> The **system** is in English. The **deliverables** ship in each client's language
> (`client.yaml -> language`).

## Getting started

```sh
./bin/agency setup                   # vendor the pinned methods from method.yaml
./bin/agency doctor                  # check it composes (no model, no tokens)
./bin/agency new acme                 # interviews you — no YAML editing
./bin/agency run acme website-audit   # runs to the first gate
./bin/agency approve acme website-audit
./bin/agency run acme website-audit   # continues to the next gate
```

`new` asks what it needs and writes `client.yaml` with its comments intact.
`agency edit <client>` runs the same interview with the current values pre-filled.

From a script or from Claude Code — where there is no interactive terminal — use the
non-interactive path, which exists so the interview does not silently take every default:

```sh
./bin/agency new acme --set name="ACME Inc." --set website=https://acme.com \
  --set language=Spanish --set business="..." --set icp="..." --set tools=ga4,buffer
```

Before starting a job, `run` preflights: if what the first phase needs is missing (the site
for `website-audit`, files in `data/` for `growth-audit`), it fails there instead of spending
minutes and tokens producing a hollow deliverable.

## The two modes

**With a workflow** — declared phases and human gates:

| workflow | what it delivers | needs | phases · gates |
|---|---|---|---|
| `website-audit` | positioning, conversion and discoverability diagnosis | **the URL alone** | 5 · 2 |
| `growth-audit` | funnel diagnosis and prioritised plan | data in `data/` | 5 · 2 |
| `content-engine` | assets written, edited, ready to schedule | `brand.md` | 4 · 2 |
| `launch` | positioning, offer, day-by-day plan and assets | `brand.md` | 5 · 3 |

**`website-audit` is the door-opener**: the only one that runs on what a client gives you in
the first conversation — their site and nothing else. Its last section lists what accesses
would be needed for the next layer, which is how the paid work opens.

**Without a workflow** — for what does not have one yet:

```sh
./bin/agency ask acme "Review the pricing page and tell me what you'd change"
```

The model builds the plan itself, **restricted to the agency catalog**. And before executing
it has to say whether this should become a stable workflow — so the workflow catalog grows out
of real work, not out of guessing.

## The six personas

| agent | what it decides |
|---|---|
| `strategist` | where the brand plays: ICP, positioning, offer, where the money goes |
| `researcher` | the facts: audience, competition, market — each with its source |
| `analyst` | what is really happening: funnel, cohorts, attribution, unit economics |
| `channel-planner` | the executable plan: mix, calendar, budget |
| `copywriter` | the assets, in the client's voice |
| `editor` | the last filter before the client or the publish button |

Each declares which catalog skills it may use. `agency doctor` fails if a persona references
a skill that does not exist.

## The house rules

`AGENCY.md` is injected into **every** phase, of every workflow, for every client. The core:

- **No number without an origin.** If it did not come from something you ran this session, it
  does not go in. A declared hole is worth something; a plausible invented number is fraud.
- **Every assumption is labelled, named, and carried with its sensitivity** — what changes if
  it is wrong.
- **Nothing is published without a human gate.** Writing a draft yes; pressing the button never.
- **A phase that could not be done is reported, not simulated.**

That discipline comes from a measured lesson, not an intuition: in earlier tests a model under
pressure to "complete the table" produced an LTV that was arithmetically correct but rested on
an assumption no automated check could see. Hence the rule is not "don't invent" but
**"declare the assumption and say what breaks it"**.

## How it is built

```
method.yaml          WHICH external methods the agency mounts (repo · tag · where)
AGENCY.md            the house rules — injected into every phase
skills/<id>/         OUR skills — they shadow a method's skill of the same name
agents/<id>.md       the persona (system prompt)
agents/<id>.yaml     which catalog skills it may use
workflows/<id>.yaml  phases · what each produces · what it requires · where it stops
clients/<id>/
  client.yaml        language, ICP, cadence, which tools are connected
  brand.md           voice, what we do NOT say, available proof, competition
  data/              the client's CSVs and exports — the analyst queries HERE
  knowledge/         approved deliverables: injected into every new job
  jobs/<wf>/         the job's artifacts and state.json
bin/agency           the runner
.vendor/             the pinned methods (not versioned)
```

**A phase is not done until its artifact is on disk.** The runner checks after each phase and
fails if it is missing — the model cannot declare a phase finished that produced nothing.

**`knowledge/` is the account's memory.** When a job is approved, you copy its deliverable
there and every later job reads it. It is what makes job N+1 better than job N — and in
marketing, where there is no repo, that store is the asset.

## How the skills reach the model

The model **discovers nothing**: the absolute path of every skill its persona is allowed to
use is injected into the prompt, and `--add-dir` grants read access outside the cwd. If a
skill is not on that list, it does not exist as far as the model is concerned. That is what
makes the catalog hermetic.

`agency setup` clones each method from `method.yaml` pinned by tag into `.vendor/<id>-<ref>/`.
It is idempotent: if it is already there, it does not clone again.

## Connected tools

Whatever CLIs each method contributes (GA4, Search Console, Semrush, Ahrefs, Buffer, HubSpot,
Mailchimp...) list themselves in the prompt from the `tools_dir` declared in `method.yaml`.

An agent uses a CLI **only** if `client.yaml -> tools` declares that tool available. Otherwise
the data point is declared as a hole rather than estimated. Credentials never go in
`client.yaml`: only the environment variable name.

## Configuration

| variable | default | what it does |
|---|---|---|
| `AGENCY_MODEL` | `sonnet` | model used by the phases |
| `AGENCY_PERMISSION_MODE` | `bypassPermissions` | required headless: without it phases hang waiting for permissions |
| `AGENCY_CLAUDE` | `claude` | executable |
| `NO_COLOR` | — | set it to turn colour off |

⚠️ `bypassPermissions` gives the agent tool access without prompting, with the client
directory as cwd. It is what makes unattended runs possible; know that it is on.

## Portability

The shape (`agents/` + `workflows/` + gates) is the same as Fluxo's `registry/`. If this later
becomes a web app on the Agent SDK, the `agents/*.md` copy over unchanged and the
`workflows/*.yaml` translate into `design` + `human_gate` steps. **Nothing written here is
thrown away.**

## Licences

Each method declares its own in `method.yaml`. Today:
`.vendor/marketingskills-v2.10.0/` is a pinned clone of
[coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) — MIT,
© 2025 Corey Haines. It is not versioned in this repo: `agency setup` brings it.

The own skill `social-by-platform` condenses heuristics from
[MatthiasMRC/bmad-marketing-growth](https://github.com/MatthiasMRC/bmad-marketing-growth)
(MIT, declared in its `module.yaml` and README), translated and rewritten. The attribution is
in its frontmatter.
