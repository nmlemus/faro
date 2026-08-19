# The whole agency in one container: runner + web console + Claude Code as the
# executor. Auth comes in as ANTHROPIC_API_KEY at run time — never baked in.
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-yaml git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /agency
COPY . .

# Vendor the pinned methods at build time so the image works offline-ish.
RUN ./bin/agency setup

# bypassPermissions inside a container IS the sandbox story: the blast radius
# is the container, not your machine.
ENV AGENCY_PERMISSION_MODE=bypassPermissions \
    NO_COLOR=1

EXPOSE 4747
CMD ["./bin/agency", "serve", "--host", "0.0.0.0", "--port", "4747"]
