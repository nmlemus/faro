---
description: "Status of every client and their jobs"
argument-hint: "[client, optional]"
---

Show the agency's status.

1. Run `./bin/agency clients`.
2. For each client (or only `$ARGUMENTS` if given), run `./bin/agency status <client>`.
3. Summarise in a table: what jobs exist, what phase each is in, and **which ones are
   stopped waiting on a human decision**.
4. If any gate is waiting, say so at the top and offer to review it with `/agency:review`.
   Do not approve it.
