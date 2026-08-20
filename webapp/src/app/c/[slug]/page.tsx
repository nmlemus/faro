import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import StartJob from "@/components/StartJob";
import Results from "@/components/Results";
import DangerDelete from "@/components/DangerDelete";
import ClientSettings from "@/components/ClientSettings";
import Connectors from "@/components/Connectors";

export const dynamic = "force-dynamic";

const CHAIN = ["website-audit", "growth-audit", "media-plan", "campaign-build",
               "optimization-loop", "monthly-report", "launch", "content-engine"];

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await supabaseServer();
  const { data: client } = await supabase.from("clients").select("*").eq("slug", slug).single();
  if (!client) notFound();

  const { data: me } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("org_members").select("role").eq("user_id", me.user?.id ?? "").limit(1);
  const staff = (membership?.[0]?.role ?? "client_viewer") !== "client_viewer";
  const owner = membership?.[0]?.role === "owner";
  const canEdit = ["owner", "account_director"].includes(membership?.[0]?.role ?? "");

  const { data: methodRow } = await supabase
    .from("method_versions").select("manifest").order("created_at", { ascending: false }).limit(1);
  const workflows = (methodRow?.[0]?.manifest?.workflows ?? []) as {
    id: string; name: string; description: string; needs: string;
    phases: number; gates: number; builds_on: string[] }[];
  workflows.sort((a, b) => CHAIN.indexOf(a.id) - CHAIN.indexOf(b.id));

  const { data: runs } = await supabase
    .from("job_runs")
    .select("id,run_key,status,created_at,jobs(workflow_id,recurring),phases(phase_id,seq,status,gate_class)")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const { data: metrics } = await supabase
    .from("metrics")
    .select("metric,channel,period,value,unit,source_path,run_id,created_at")
    .eq("client_id", client.id)
    .order("period", { ascending: true });

  const anyRunning = (runs ?? []).some((r) => (r.phases ?? []).some((p) => p.status === "running"));
  const d = (i: number) => ({ "--d": `${i * 90}ms` } as React.CSSProperties);

  return (
    <Shell working={anyRunning}>
      <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-12">
        <header className="rise" style={d(0)}>
          {staff && <Link href="/" className="t-eyebrow hover:text-ink transition-colors">← all accounts</Link>}
          <div className="flex items-end justify-between gap-6 flex-wrap mt-2">
            <h1 className="t-display">{client.name}<span className="text-cobalt">.</span></h1>
            <p className="t-mono text-ink-3 pb-2">
              {(client.website || "").replace(/^https?:\/\//, "")} · deliverables in {client.language}
            </p>
          </div>
          {client.business && <p className="t-body text-ink-2 mt-3 max-w-[56ch]">{client.business}</p>}
          {canEdit && (
            <div className="mt-4 flex items-center gap-6">
              <ClientSettings client={client} />
              {owner && (
                <Connectors clientId={client.id} tools={client.tools ?? {}}
                  catalog={methodRow?.[0]?.manifest?.connectors ?? []} />
              )}
            </div>
          )}
        </header>

        {!!metrics?.length && <Results rows={metrics} slug={slug} />}

        <section className="flex flex-col gap-4 rise" style={d(1)}>
          <div className="t-eyebrow">the work</div>
          {(runs ?? []).map((r) => {
            const phases = [...(r.phases ?? [])].sort((a, b) => a.seq - b.seq);
            const job = r.jobs as unknown as { workflow_id: string; recurring: string | null };
            const gate = phases.find((p) => p.status === "awaiting_gate");
            const running = phases.find((p) => p.status === "running");
            const headline = gate ? "awaiting_gate" : running ? "running"
              : r.status === "complete" ? "done" : r.status === "abandoned" ? "failed"
              : phases.some((p) => p.status === "failed") ? "failed" : "idle";
            const label = { awaiting_gate: "waiting for you", running: "working", done: "complete",
                            failed: "needs attention", idle: "queued" }[headline];
            return (
              <Link key={r.id} href={`/c/${slug}/r/${r.id}`} className="card p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2.5 min-w-0">
                    <h2 className="t-h2 font-[family-name:var(--font-spline-mono)]">{job?.workflow_id}</h2>
                    {r.run_key !== "main" && <span className="t-mono text-ink-3">{r.run_key}</span>}
                    {job?.recurring && <span className="chip idle">{job.recurring}</span>}
                  </div>
                  <span className={`chip ${headline === "awaiting_gate" ? "gate" : headline === "running" ? "run" : headline === "done" ? "done" : headline === "failed" ? "failed" : "idle"}`}>
                    {label}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {phases.map((p) => (
                    <span key={p.phase_id} title={`${p.phase_id}: ${p.status}`}
                      className={`pip ${p.status === "done" ? "done" : p.status === "awaiting_gate" ? "gate"
                        : p.status === "running" ? "running" : p.status === "failed" ? "failed" : "idle"}`} />
                  ))}
                </div>
                {gate && (
                  <p className="t-body" style={{ color: "var(--gate)" }}>
                    ⏸ <strong>{gate.phase_id}</strong> is waiting for a decision
                    {gate.gate_class ? ` (${gate.gate_class})` : ""}.
                  </p>
                )}
              </Link>
            );
          })}
          {!runs?.length && (
            <div className="card-flat p-10 text-center t-body text-ink-3">
              Nothing yet — start below.
            </div>
          )}
        </section>

        {staff && (
          <div className="rise" style={d(2)}>
            <StartJob clientId={client.id} hasWebsite={!!client.website}
              workflows={workflows}
              activeIds={(runs ?? [])
                .filter((r) => r.status === "active")
                .map((r) => (r.jobs as unknown as { workflow_id: string })?.workflow_id ?? "")} />
          </div>
        )}
        {owner && (
          <footer className="rise pt-4" style={{ borderTop: "1px solid var(--rule-soft)" }}>
            <DangerDelete
              label={`delete ${client.name} — the account, its runs, documents and results`}
              confirmLabel={`This removes ${client.name} and everything under it. No undo.`}
              rpc="delete_client" args={{ p_client: client.id }} redirectTo="/" />
          </footer>
        )}
      </main>
    </Shell>
  );
}
