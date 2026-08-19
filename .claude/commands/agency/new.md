---
description: "Create a client — asks you in chat"
argument-hint: "[client id]"
---

Create a new client: `$ARGUMENTS`.

**Do not run `agency new` with no arguments**: the interactive interview needs a terminal and
there is none here, so it would silently take every default. Ask the questions yourself, then
pass the answers with `--set`.

1. Ask the user, one at a time, explaining the consequence of each:
   - **short id** (lowercase, no spaces) if it did not come in `$ARGUMENTS`
   - **name** of the client
   - **website** — required for `website-audit`, the only job that runs with no internal data
   - **deliverable language** — what the client reads, not what the system works in
   - **what business they are in**, one line
   - **who they sell to** — tell them leaving it empty is a valid answer: the audit flags it
     as a finding, and it is usually *the* finding
   - **which tools they genuinely have connected**, from: `ga4`, `google-search-console`,
     `semrush`, `ahrefs`, `buffer`, `mailchimp`, `hubspot`. Warn that listing one without a
     real credential is worse than leaving it out: the phase fails instead of declaring the
     hole cleanly.
   - if they picked any, **which environment variables** hold those credentials — names only,
     never values.

2. Run:
   ```
   ./bin/agency new <id> --set name="..." --set website="..." --set language="..." \
     --set business="..." --set icp="..." --set tools="a,b" --set credentials_env="X,Y"
   ```

3. **Do not fill in `brand.md`.** If the client has a site it stays empty on purpose:
   `website-audit` infers the voice, the proof and the competition by reading the web.
   Filling it first contaminates the judgement with what we assume the site says.

4. Close by saying which job can run now and which needs data the client has not given yet.
