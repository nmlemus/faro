#!/usr/bin/env python3
"""Engine worker: claims a phase from Postgres, runs it with claude, streams
activity events, persists the artifact, stops at gates. Stateless — scale by
running more of these.

    python3 engine/worker.py --once            # claim and run one phase, exit
    python3 engine/worker.py                   # loop
    python3 engine/worker.py enqueue <client-slug> <workflow>

AGENCY_ENGINE_FAKE=1 skips claude and writes a canned artifact — plumbing tests.
"""
import importlib.machinery
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import db

ROOT = Path(__file__).resolve().parent.parent
core = importlib.machinery.SourceFileLoader("agency_cli", str(ROOT / "bin" / "agency")).load_module()

WORKER = f"{socket.gethostname()}:{os.getpid()}"
CLAUDE = os.environ.get("AGENCY_CLAUDE", "claude")
MODEL = os.environ.get("AGENCY_MODEL", "sonnet")
FAKE = bool(os.environ.get("AGENCY_ENGINE_FAKE"))


# ── context assembly (the DB-era build_prompt) ──────────────────────────────

def client_context(client):
    tools = "\n".join(f"  {k}: {'true' if v else 'false'}"
                      for k, v in (client.get("tools") or {}).items())
    return f"""id: {client['slug']}
name: {client['name']}
website: "{client.get('website') or ''}"
language: {client.get('language') or 'English'}
business: "{client.get('business') or ''}"
icp: "{client.get('icp') or ''}"
cadence: "{client.get('cadence') or ''}"
tools:
{tools or '  {}'}"""


def prior_block(run, wf):
    out = ""
    # artifacts already produced in THIS run (the phase's requires)
    arts = db.select("artifacts", f"run_id=eq.{run['id']}&select=path,content&order=path")
    for a in arts:
        out += f"\n\n===== {a['path']} =====\n{a['content']}"

    # recurring jobs: inject THIS job's previous run — week N reads week N-1
    prev = db.select(
        "job_runs",
        f"job_id=eq.{run['job_id']}&id=neq.{run['id']}&select=id,run_key,created_at"
        f"&order=created_at.desc&limit=1")
    if prev:
        for a in db.select("artifacts",
                           f"run_id=eq.{prev[0]['id']}&select=path,content&order=path"):
            out += (f"\n\n# Previous run of this job ({prev[0]['run_key']})\n"
                    f"===== {a['path']} =====\n{a['content']}")

    # builds_on deliverables — LATEST run only per dependency
    wfs = core.workflows()
    for dep in (wf.get("builds_on") or []):
        deliverable = wfs.get(dep, {}).get("deliverable")
        rows = db.select(
            "artifacts",
            f"client_id=eq.{run['client_id']}&path=eq.{deliverable}"
            f"&select=path,content,created_at,job_runs!inner(jobs!inner(workflow_id))"
            f"&job_runs.jobs.workflow_id=eq.{dep}&order=created_at.desc&limit=1")
        for a in rows:
            out += (f"\n\n# Previous work: {dep}\nDo not contradict it silently — "
                    f"disagree explicitly if you must.\n\n===== {dep} -> {a['path']} =====\n{a['content']}")
    return out


def build_prompt(phase, run, client, wf, out_file):
    catalog = core.skill_catalog()
    ag = core.agents()[phase["agent"]]
    language = client.get("language") or "English"
    mine = [s for s in ag.get("skills", []) if s in catalog]
    lines = [f"- `{s}` — {catalog[s][0]}\n  -> `{catalog[s][1] / 'SKILL.md'}`" for s in mine]
    wf_phase = next(p for p in wf["phases"] if p["id"] == phase["phase_id"])
    fb = (f"\n\n## Feedback from the previous gate — REDO this phase addressing it\n\n{phase['feedback']}\n"
          if phase.get("feedback") else "")
    intake = run.get("intake") or {}
    intake_block = ""
    if any(str(v).strip() for v in intake.values()):
        lines_i = "\n".join(f"- **{k.replace('_', ' ')}:** {v}" for k, v in intake.items()
                             if str(v).strip())
        intake_block = (f"\n\n# What the human asked for when starting this job\n\n{lines_i}\n\n"
                        "This intake is the brief. If the work cannot honor part of it, say so "
                        "explicitly in the deliverable — do not silently substitute your own brief.")
    brand = (client.get("brand") or {}).get("md", "")

    return f"""{(ROOT / 'AGENCY.md').read_text()}

# Client: {client['name']}

**Deliverable language: {language}.** You think and work in English; what you write into
the artifact ships in {language}. That is house rule 4 and it is not optional.

===== client profile =====
{client_context(client)}

===== brand.md =====
{brand}
{prior_block(run, wf)}

# Your skills

Read the ones that apply with the Read tool from the path under each, follow them, and
name in the deliverable which you used.

{chr(10).join(lines)}

{core.tools_block()}

# Job: {wf['name']} — phase `{phase['phase_id']}`{intake_block}
{fb}
## Your task

{wf_phase['task']}

## How this phase closes

Write the result to **`{out_file}`**. That file is the phase's deliverable: it does not
exist until it is on disk. Do not answer with the content in chat. When done, reply in
two or three lines with what you did and what was declared as a hole.
"""


# ── event streaming ─────────────────────────────────────────────────────────

def emit(phase, etype, payload):
    db.insert("activity_events", [{
        "org_id": phase["org_id"], "client_id": phase["client_id"],
        "run_id": phase["run_id"], "phase_id": phase["id"],
        "type": etype, "payload": payload,
    }])


def tool_line(block):
    """The raw technical line — kept in the payload for operators, never shown raw."""
    name = block.get("name", "?")
    inp = block.get("input") or {}
    for k in ("file_path", "command", "url", "query", "pattern", "name", "description"):
        v = inp.get(k)
        if isinstance(v, str) and v.strip():
            v = " ".join(v.split())
            return f"{name}: {v[:120]}"
    return name


def human_line(block):
    """What a business user (or a client) should read: the intent, never the
    plumbing. File paths and bash commands stay in payload.raw for debugging."""
    name = block.get("name", "?")
    inp = block.get("input") or {}
    fp = str(inp.get("file_path") or "")
    if name == "Read":
        if "SKILL.md" in fp:
            return f"Consulting the {Path(fp).parent.name} playbook"
        if fp:
            base = Path(fp).name
            if base.startswith("brand"):
                return "Reading the brand guidelines"
            return f"Reading {base}"
        return "Reading source material"
    if name in ("Write", "Edit", "MultiEdit"):
        return "Writing the deliverable"
    if name == "WebFetch":
        from urllib.parse import urlparse
        host = urlparse(str(inp.get("url") or "")).netloc
        return f"Reading {host}" if host else "Reading a web page"
    if name == "WebSearch":
        q = " ".join(str(inp.get("query") or "").split())
        return f"Searching the web: {q[:70]}" if q else "Searching the web"
    if name == "Bash":
        d = " ".join(str(inp.get("description") or "").split())
        return d[:90] if d else "Running analysis"
    if name in ("Grep", "Glob"):
        return "Searching the source material"
    if name in ("TodoWrite", "todo_write"):
        return "Planning the next steps"
    if name == "Skill":
        return f"Applying the {inp.get('name', '')} method"
    return "Working"


def run_claude_streaming(phase, persona, prompt, cwd):
    cmd = [CLAUDE, "-p", "--model", MODEL, "--system-prompt", persona,
           "--permission-mode", "bypassPermissions",
           "--output-format", "stream-json", "--verbose",
           *[a for m in core.methods() for a in ("--add-dir", str(m["dir"]))],
           "--add-dir", str(ROOT / "skills"), "--add-dir", tempfile.gettempdir()]
    proc = subprocess.Popen(cmd, cwd=cwd, text=True, stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    proc.stdin.write(prompt)
    proc.stdin.close()
    for line in proc.stdout:
        s = line.strip()
        if not s.startswith("{"):
            continue
        try:
            ev = json.loads(s)
        except json.JSONDecodeError:
            continue
        t = ev.get("type")
        if t == "system" and ev.get("subtype") == "init":
            emit(phase, "session_start", {"model": ev.get("model", "")})
        elif t == "assistant":
            for b in (ev.get("message") or {}).get("content", []):
                if b.get("type") == "tool_use":
                    emit(phase, "tool", {"line": human_line(b), "raw": tool_line(b)})
                elif b.get("type") == "text" and (b.get("text") or "").strip():
                    txt = " ".join(b["text"].split())
                    emit(phase, "text", {"line": txt[:200]})
        elif t == "result":
            emit(phase, "done", {"duration_ms": ev.get("duration_ms")})
    return proc.wait()


# ── the work loop ───────────────────────────────────────────────────────────

def period_key(cadence):
    import datetime
    now = datetime.date.today()
    if cadence == "weekly":
        y, w, _ = now.isocalendar()
        return f"{y}-W{w:02d}"
    return now.strftime("%Y-%m")


def ensure_recurring_runs():
    """A recurring job gets one run per period, automatically. The run appears;
    the gates still belong to humans."""
    jobs = db.select("jobs", "recurring=not.is.null&select=id,org_id,client_id,recurring")
    for j in jobs:
        key = period_key(j["recurring"])
        if db.select("job_runs", f"job_id=eq.{j['id']}&run_key=eq.{key}&select=id"):
            continue
        db.insert("job_runs", [{"job_id": j["id"], "org_id": j["org_id"],
                                "client_id": j["client_id"], "run_key": key}],
                  upsert_on="job_id,run_key")
        print(f"[recurring] run {key} created for job {j['id'][:8]}")


def expand_runs():
    """Materialize phases for UI-requested runs. The UI writes intent; only the
    engine — which has the git method checkout — knows what phases exist."""
    # PostgREST can't filter on "no child rows" directly; fetch and check
    runs = db.select("job_runs", "status=eq.active&select=id,org_id,client_id,job_id,"
                                 "jobs(workflow_id),clients(slug)")
    wfs = core.workflows()
    for r in runs:
        existing = db.select("phases", f"run_id=eq.{r['id']}&select=id&limit=1")
        if existing:
            continue
        wf = wfs.get(r["jobs"]["workflow_id"])
        slug = r["clients"]["slug"]
        if wf is None:
            continue
        # data preflight (transitional: data files still live on disk)
        if r["jobs"]["workflow_id"] == "growth-audit":
            data = ROOT / "clients" / slug / "data"
            if not data.is_dir() or not any(f.suffix.lower() in (".csv", ".tsv", ".json", ".xlsx")
                                            for f in data.glob("*")):
                db.insert("activity_events", [{
                    "org_id": r["org_id"], "client_id": r["client_id"], "run_id": r["id"],
                    "type": "error",
                    "payload": {"line": f"'{slug}' has no data files; growth-audit needs them. "
                                        "Add the client's exports, or run the website audit."}}])
                db.update("job_runs", f"id=eq.{r['id']}", {"status": "abandoned"})
                print(f"[expand] {slug}/growth-audit abandoned: no data")
                continue
        for i, ph in enumerate(wf["phases"]):
            db.insert("phases", [{
                "run_id": r["id"], "org_id": r["org_id"], "client_id": r["client_id"],
                "seq": i, "phase_id": ph["id"], "agent": ph["agent"], "produces": ph["produces"],
                "gate_class": ph.get("gate_class") if ph.get("gate") else None,
                "gate_text": (ph.get("gate") or "").strip() or None,
                "status": "pending" if i == 0 else "blocked",
            }], upsert_on="run_id,phase_id")
        print(f"[expand] {slug}/{r['jobs']['workflow_id']} -> {len(wf['phases'])} phases")


# ---- metrics extraction (Marta #4: the results layer) --------------------
# Deliverables may carry a ```metrics fence with CSV lines:
#   metric,channel,period,value,unit
#   spend,meta,2026-W34,1240.50,usd
# Every row lands in the metrics table pointing back at its artifact, so the
# portal can chart it while keeping "every number has an origin".
METRIC_LINE = re.compile(
    r"^\s*([a-z0-9_.-]+)\s*,\s*([a-z0-9_.-]*)\s*,"
    r"\s*(\d{4}-(?:W\d{2}|\d{2}))\s*,\s*(-?\d[\d,]*\.?\d*)\s*,\s*(.*?)\s*$",
    re.I,
)

def parse_metrics(content):
    rows = []
    for block in re.findall(r"```metrics\s*\n(.*?)```", content, re.S):
        for line in block.strip().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.lower().startswith("metric,"):
                continue
            m = METRIC_LINE.match(line)
            if not m:
                continue
            metric, channel, period, value, unit = m.groups()
            rows.append({"metric": metric.lower(), "channel": channel.lower(),
                         "period": period.upper(), "value": float(value.replace(",", "")),
                         "unit": unit.lower() or None})
    return rows


def store_metrics(phase, run, client, content):
    rows = parse_metrics(content)
    if not rows:
        return
    db.insert("metrics", [dict(r,
        org_id=client["org_id"], client_id=client["id"],
        run_id=run["id"], phase_id=phase["id"],
        source_path=phase["produces"]) for r in rows],
        upsert_on="client_id,metric,channel,period,source_path")
    emit(phase, "metrics", {"line": f"Recorded {len(rows)} KPI value(s) from {phase['produces']}",
                            "count": len(rows)})


def run_one():
    claimed = db.rpc("claim_phase", {"p_worker": WORKER})
    if not claimed:
        return False
    phase = claimed[0]
    run = db.select("job_runs", f"id=eq.{phase['run_id']}&select=*")[0]
    client = db.select("clients", f"id=eq.{phase['client_id']}&select=*")[0]
    job = db.select("jobs", f"id=eq.{run['job_id']}&select=*")[0]
    wf = core.workflows()[job["workflow_id"]]
    print(f"[{WORKER}] {client['slug']} / {job['workflow_id']} / {phase['phase_id']}")

    out_dir = Path(tempfile.mkdtemp(prefix="agency-phase-"))
    out_file = out_dir / Path(phase["produces"]).name

    try:
        if FAKE:
            emit(phase, "session_start", {"model": "fake"})
            out_file.write_text(f"# {phase['produces']}\n\n(fake artifact for plumbing tests)\n")
            emit(phase, "done", {"duration_ms": 1})
            rc = 0
        else:
            persona = core.agents()[phase["agent"]]["persona"]
            prompt = build_prompt(phase, run, client, wf, out_file)
            # workspace: the client's filesystem folder if it still exists (data/),
            # else a scratch dir — transitional until data files live in Storage
            ws = ROOT / "clients" / client["slug"]
            cwd = str(ws if ws.is_dir() else out_dir)
            rc = run_claude_streaming(phase, persona, prompt, cwd)

        if rc == 0 and out_file.is_file():
            content = out_file.read_text()
            db.rpc("finish_phase", {"p_phase": phase["id"], "p_ok": True,
                                    "p_content": content, "p_error": None})
            store_metrics(phase, run, client, content)
            print(f"  done -> {phase['produces']}")
        else:
            db.rpc("finish_phase", {"p_phase": phase["id"], "p_ok": False, "p_content": None,
                                    "p_error": f"claude exited {rc}, artifact "
                                               f"{'missing' if not out_file.is_file() else 'ok'}"})
            print("  FAILED")
    except Exception as e:
        db.rpc("finish_phase", {"p_phase": phase["id"], "p_ok": False,
                                "p_content": None, "p_error": str(e)[:500]})
        raise
    return True


def enqueue(slug, workflow_id, run_key="main"):
    client = db.select("clients", f"slug=eq.{slug}&select=*")[0]
    wf = core.workflows()[workflow_id]
    # Preflight, DB-era: same rules as the CLI. Data files are transitional
    # (still on disk) until they move to Storage.
    if workflow_id == "website-audit" and not (client.get("website") or "").strip():
        raise SystemExit(f"'{slug}' has no website and website-audit comes entirely from it")
    if workflow_id == "growth-audit":
        data = ROOT / "clients" / slug / "data"
        if not data.is_dir() or not any(f.suffix.lower() in (".csv", ".tsv", ".json", ".xlsx")
                                        for f in data.glob("*")):
            raise SystemExit(f"'{slug}' has no data files; growth-audit needs them")
    job = db.insert("jobs", [{"org_id": client["org_id"], "client_id": client["id"],
                              "workflow_id": workflow_id}],
                    upsert_on="client_id,workflow_id")[0]
    run = db.insert("job_runs", [{"job_id": job["id"], "org_id": client["org_id"],
                                  "client_id": client["id"], "run_key": run_key}],
                    upsert_on="job_id,run_key")[0]
    for i, ph in enumerate(wf["phases"]):
        db.insert("phases", [{
            "run_id": run["id"], "org_id": client["org_id"], "client_id": client["id"],
            "seq": i, "phase_id": ph["id"], "agent": ph["agent"], "produces": ph["produces"],
            "gate_class": ph.get("gate_class") if ph.get("gate") else None,
            "gate_text": (ph.get("gate") or "").strip() or None,
            "status": "pending" if i == 0 else "blocked",
        }], upsert_on="run_id,phase_id")
    print(f"enqueued {slug}/{workflow_id} run={run['id']}")
    return run["id"]


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "enqueue":
        enqueue(sys.argv[2], sys.argv[3])
    elif "--once" in sys.argv:
        run_one() or print("nothing to claim")
    elif "--expand" in sys.argv or "--tick" in sys.argv:
        ensure_recurring_runs()
        expand_runs()
    else:
        print(f"worker {WORKER} polling…")
        while True:
            ensure_recurring_runs()
            expand_runs()
            if not run_one():
                time.sleep(3)
