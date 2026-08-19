#!/usr/bin/env python3
"""Bootstrap the local platform: users, org, and a faithful import of the
filesystem-era clients (with their REAL deliverables) into Postgres.

Idempotent: run it as many times as you like.
    python3 engine/bootstrap.py
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import db

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import importlib.machinery
core = importlib.machinery.SourceFileLoader("agency_cli", str(ROOT / "bin" / "agency")).load_module()

STATUS_MAP = {"done": "done", "awaiting-gate": "awaiting_gate",
              "failed": "failed", "pending": "pending"}


def main():
    # ── users (local dev credentials, printed at the end) ──────────────────
    owner_id = db.ensure_user("owner@local.test", "agency-owner-1", "Noel")
    client_id_user = db.ensure_user("client@local.test", "agency-client-1", "YoMap (client)")

    # ── org ────────────────────────────────────────────────────────────────
    org = db.insert("orgs", [{"slug": "faro", "name": "Faro (working name)"}], upsert_on="slug")[0]
    db.insert("org_members", [
        {"org_id": org["id"], "user_id": owner_id, "role": "owner"},
        {"org_id": org["id"], "user_id": client_id_user, "role": "client_viewer"},
    ], upsert_on="org_id,user_id")

    # ── method provenance ──────────────────────────────────────────────────
    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT,
                         capture_output=True, text=True).stdout.strip()
    wfs = core.workflows()
    manifest = {"workflows": sorted(wfs), "agents": sorted(core.agents()),
                "skills": len(core.skill_catalog())}
    mv = db.insert("method_versions", [{"git_sha": sha, "manifest": manifest}],
                   upsert_on="git_sha")[0]

    # ── clients + their history ────────────────────────────────────────────
    import yaml
    for cdir in sorted((ROOT / "clients").iterdir()):
        if not cdir.is_dir() or cdir.name.startswith("_"):
            continue
        cfg = yaml.safe_load((cdir / "client.yaml").read_text()) or {}
        brand = (cdir / "brand.md").read_text() if (cdir / "brand.md").is_file() else ""
        client = db.insert("clients", [{
            "org_id": org["id"], "slug": cdir.name, "name": cfg.get("name", cdir.name),
            "website": cfg.get("website") or None, "language": cfg.get("language", "English"),
            "business": cfg.get("business") or None, "icp": cfg.get("icp") or None,
            "cadence": cfg.get("cadence") or None,
            "brand": {"md": brand}, "tools": cfg.get("tools") or {},
        }], upsert_on="org_id,slug")[0]
        print(f"client {cdir.name} -> {client['id']}")

        jobs_dir = cdir / "jobs"
        if not jobs_dir.is_dir():
            continue
        for jd in sorted(jobs_dir.iterdir()):
            if not jd.is_dir():
                continue
            wf = wfs.get(jd.name)
            state = {}
            sf = jd / "state.json"
            if sf.is_file():
                state = json.loads(sf.read_text()).get("phases", {})

            if wf is None:
                # ad-hoc deliverables: keep them as artifacts on a pseudo-run
                job = db.insert("jobs", [{"org_id": org["id"], "client_id": client["id"],
                                          "workflow_id": jd.name,
                                          "method_version_id": mv["id"]}],
                                upsert_on="client_id,workflow_id")[0]
                run = db.insert("job_runs", [{"job_id": job["id"], "org_id": org["id"],
                                              "client_id": client["id"], "run_key": "main",
                                              "status": "complete"}],
                                upsert_on="job_id,run_key")[0]
                for f in sorted(jd.glob("*.md")):
                    if f.name.startswith("."):
                        continue
                    db.insert("artifacts", [{"run_id": run["id"], "org_id": org["id"],
                                             "client_id": client["id"], "path": f.name,
                                             "content": f.read_text()}],
                              upsert_on="run_id,path")
                continue

            job = db.insert("jobs", [{"org_id": org["id"], "client_id": client["id"],
                                      "workflow_id": jd.name, "method_version_id": mv["id"]}],
                            upsert_on="client_id,workflow_id")[0]
            run = db.insert("job_runs", [{"job_id": job["id"], "org_id": org["id"],
                                          "client_id": client["id"], "run_key": "main"}],
                            upsert_on="job_id,run_key")[0]

            all_done, saw_open = True, False
            for i, ph in enumerate(wf["phases"]):
                st = STATUS_MAP.get((state.get(ph["id"]) or {}).get("status"), None)
                if st is None:
                    st = "pending" if (not saw_open and all_done) else "blocked"
                if st != "done":
                    all_done = False
                if st in ("pending", "awaiting_gate", "failed"):
                    saw_open = True
                row = db.insert("phases", [{
                    "run_id": run["id"], "org_id": org["id"], "client_id": client["id"],
                    "seq": i, "phase_id": ph["id"], "agent": ph["agent"],
                    "produces": ph["produces"],
                    "gate_class": ph.get("gate_class") if ph.get("gate") else None,
                    "gate_text": (ph.get("gate") or "").strip() or None,
                    "status": st,
                    "feedback": (state.get(ph["id"]) or {}).get("feedback"),
                }], upsert_on="run_id,phase_id")[0]
                art = jd / ph["produces"]
                if art.is_file():
                    db.insert("artifacts", [{"run_id": run["id"], "phase_id": row["id"],
                                             "org_id": org["id"], "client_id": client["id"],
                                             "path": ph["produces"],
                                             "content": art.read_text()}],
                              upsert_on="run_id,path")
            if all_done:
                db.update("job_runs", f"id=eq.{run['id']}", {"status": "complete"})

    # the client user sees yomap only
    yomap = db.select("clients", "slug=eq.yomap&select=id")
    if yomap:
        db.insert("client_members", [{"client_id": yomap[0]["id"],
                                      "user_id": client_id_user}],
                  upsert_on="client_id,user_id")

    print("\nbootstrap complete")
    print("  owner login:  owner@local.test / agency-owner-1")
    print("  client login: client@local.test / agency-client-1  (sees yomap only)")


if __name__ == "__main__":
    main()
