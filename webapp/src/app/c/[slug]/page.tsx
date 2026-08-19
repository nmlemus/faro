import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const STATUS_STYLE: Record<string, string> = {
  done: "bg-ok-soft text-ok",
  awaiting_gate: "bg-gate-soft text-gate",
  running: "bg-cobalt-soft text-cobalt pulse",
  failed: "bg-danger-soft text-danger",
  pending: "bg-paper-3 text-ink-3",
  blocked: "bg-paper-3 text-ink-3",
};
const STATUS_LABEL: Record<string, string> = {
  done: "done", awaiting_gate: "waiting for you", running: "working",
  failed: "needs attention", pending: "queued", blocked: "queued",
};

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await supabaseServer();
  const { data: client } = await supabase
    .from("clients").select("*").eq("slug", slug).single();
  if (!client) notFound();

  const { data: runs } = await supabase
    .from("job_runs")
    .select("id,run_key,status,created_at,jobs(workflow_id),phases(phase_id,seq,status,gate_class)")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <Link href="/" className="t-eyebrow hover:text-ink transition-colors">faro · {slug}</Link>
          <h1 className="t-display mt-2">{client.name}</h1>
          <p className="t-body text-ink-2 mt-2 max-w-[52ch]">
            {client.business || "Every piece of work we do for this account, with every decision on the record."}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="t-mono text-ink-3 hover:text-ink transition-colors">sign out</button>
        </form>
      </header>

      <section className="flex flex-col gap-4">
        {(runs ?? []).map((r) => {
          const phases = [...(r.phases ?? [])].sort((a, b) => a.seq - b.seq);
          const wf = (r.jobs as unknown as { workflow_id: string })?.workflow_id ?? "";
          const gate = phases.find((p) => p.status === "awaiting_gate");
          const running = phases.find((p) => p.status === "running");
          const headline = gate ? "awaiting_gate" : running ? "running"
            : r.status === "complete" ? "done" : phases.some((p) => p.status === "failed") ? "failed" : "pending";
          return (
            <Link key={r.id} href={`/c/${slug}/r/${r.id}`}
              className="card p-5 flex flex-col gap-3.5 hover:border-cobalt transition-colors">
              <div className="flex items-center justify-between gap-3">
                <h2 className="t-h2 font-mono">{wf}{r.run_key !== "main" ? ` · ${r.run_key}` : ""}</h2>
                <span className={`t-mono rounded-full px-2.5 py-1 ${STATUS_STYLE[headline]}`}>
                  {STATUS_LABEL[headline]}
                </span>
              </div>
              <div className="flex gap-1.5">
                {phases.map((p) => (
                  <span key={p.phase_id} title={`${p.phase_id}: ${p.status}`}
                    className={`h-1.5 flex-1 rounded-full ${
                      p.status === "done" ? "bg-ok" :
                      p.status === "awaiting_gate" ? "bg-gate pulse" :
                      p.status === "running" ? "bg-cobalt pulse" :
                      p.status === "failed" ? "bg-danger" : "bg-paper-3"}`} />
                ))}
              </div>
              {gate && (
                <p className="t-body text-gate">
                  ⏸ <strong>{gate.phase_id}</strong> is waiting for a decision.
                </p>
              )}
            </Link>
          );
        })}
        {!runs?.length && (
          <div className="card p-10 text-center t-body text-ink-3">Nothing here yet.</div>
        )}
      </section>
    </main>
  );
}
