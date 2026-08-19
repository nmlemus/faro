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
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function start(wfId: string) {
    setBusy(wfId); setErr("");
    const { data, error } = await supabaseBrowser().rpc("request_run", {
      p_client: clientId, p_workflow: wfId,
    });
    setBusy(null);
    if (error) { setErr(error.message); return; }
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
            <div key={w.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="t-h2 font-mono">{w.id}</span>
                <span className="t-mono text-ink-3">{w.phases} phases · {w.gates} gates</span>
              </div>
              <p className="t-body text-ink-2">{w.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="t-mono text-ink-3">needs {w.needs}</span>
                <button onClick={() => start(w.id)}
                  disabled={busy === w.id || blocked || active}
                  title={blocked ? "This client has no website" : active ? "Already running" : ""}
                  className="rounded-full bg-cobalt-soft text-cobalt font-semibold px-4 py-1.5 t-body hover:opacity-80 disabled:opacity-40 transition-opacity">
                  {active ? "Active" : busy === w.id ? "Starting…" : "Start"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {err && <p className="t-body text-danger">{err}</p>}
    </section>
  );
}
