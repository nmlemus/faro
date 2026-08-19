"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Wf = { id: string; name: string; description: string; needs: string;
            phases: number; gates: number; builds_on: string[] };

export default function StartJob({ clientId, hasWebsite, workflows, activeIds }: {
  clientId: string; hasWebsite: boolean; workflows: Wf[]; activeIds: string[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Wf | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ objective: "", budget: "", timeframe: "", notes: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function start() {
    if (!picked) return;
    setBusy(true); setErr("");
    const intake: Record<string, string> = {};
    if (f.objective.trim()) intake.objective = f.objective.trim();
    if (f.budget.trim()) intake.monthly_budget = f.budget.trim();
    if (f.timeframe.trim()) intake.timeframe = f.timeframe.trim();
    if (f.notes.trim()) intake.notes = f.notes.trim();
    const { data, error } = await supabaseBrowser().rpc("request_run", {
      p_client: clientId, p_workflow: picked.id, p_intake: intake,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setPicked(null); setF({ objective: "", budget: "", timeframe: "", notes: "" });
    router.refresh();
    if (data) router.push(`?run=${data}`);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="t-eyebrow">start work</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {workflows.map((w) => {
          const blocked = w.id === "website-audit" && !hasWebsite;
          const active = activeIds.includes(w.id);
          return (
            <div key={w.id} className="card-flat p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="t-h2 font-[family-name:var(--font-spline-mono)]">{w.id}</span>
                <span className="t-mono text-ink-3">{w.phases} steps · {w.gates} approvals</span>
              </div>
              <p className="t-body text-ink-2">{w.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="t-mono text-ink-3">needs {w.needs}</span>
                <button onClick={() => setPicked(w)}
                  disabled={blocked || active}
                  title={blocked ? "This client has no website" : active ? "Already running" : ""}
                  className="btn btn-soft !px-4 !py-1.5 text-[0.85rem]">
                  {active ? "Active" : "Start…"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {err && !picked && <p className="t-body text-danger">{err}</p>}

      {picked && (
        <div className="fixed inset-0 z-20 bg-black/45 grid place-items-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPicked(null); }}>
          <div className="card w-full max-w-md p-6 flex flex-col gap-4"
            style={{ background: "var(--paper)" }}>
            <div>
              <div className="t-eyebrow">start {picked.id}</div>
              <h3 className="t-h1 mt-1">What should this achieve?</h3>
              <p className="t-body text-ink-2 mt-1.5">
                Your brief shapes every step. A job with no brief gets the AI&apos;s
                assumptions — a job with yours gets yours. All fields optional, all valuable.
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Objective — in your unit, not clicks</span>
              <input className="field" value={f.objective} onChange={set("objective")}
                placeholder="e.g. 30 new paying customers/month by Q4" autoFocus />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Monthly budget, if money is involved</span>
              <input className="field" value={f.budget} onChange={set("budget")}
                placeholder="e.g. US$15,000/month" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Timeframe</span>
              <input className="field" value={f.timeframe} onChange={set("timeframe")}
                placeholder="e.g. next quarter" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Anything the team must know</span>
              <textarea className="field min-h-16 resize-y" value={f.notes} onChange={set("notes")}
                placeholder="constraints, exclusions, context…" />
            </label>
            {err && <p className="t-body text-danger">{err}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setPicked(null)} className="t-body text-ink-3 hover:text-ink">Cancel</button>
              <button onClick={start} disabled={busy} className="btn btn-ink">
                {busy ? "Starting…" : "Start the work"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
