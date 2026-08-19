"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabaseBrowser } from "@/lib/supabase/client";

type Phase = {
  id: string; phase_id: string; seq: number; agent: string; produces: string;
  status: string; gate_class: string | null; gate_text: string | null; error: string | null;
};
type Artifact = { id: string; path: string; content: string | null; phase_id: string | null };
type Ev = { id: number; type: string; payload: Record<string, unknown>; created_at: string };

const DOT: Record<string, string> = {
  done: "bg-ok", awaiting_gate: "bg-gate pulse", running: "bg-cobalt pulse",
  failed: "bg-danger", pending: "bg-paper-3 border border-rule", blocked: "bg-paper-3 border border-rule",
};

export default function RunView(props: {
  slug: string; clientName: string; workflow: string; runId: string;
  phases: Phase[]; artifacts: Artifact[]; initialEvents: Ev[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [events, setEvents] = useState<Ev[]>(props.initialEvents);
  const [open, setOpen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const gate = props.phases.find((p) => p.status === "awaiting_gate");
  const running = props.phases.some((p) => p.status === "running");
  const artifact = props.artifacts.find((a) => a.path === open);
  const gateArtifact = gate ? props.artifacts.find((a) => a.phase_id === gate.id) : null;

  useEffect(() => {
    const ch = supabase
      .channel(`run-${props.runId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `run_id=eq.${props.runId}` },
        (msg) => setEvents((prev) => [...prev.slice(-120), msg.new as Ev]))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "phases", filter: `run_id=eq.${props.runId}` },
        () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, props.runId, router]);

  async function decide(decision: "approved" | "rejected") {
    if (decision === "rejected" && !feedback.trim()) {
      setErr("Say what to change — the phase is redone with your words folded in.");
      return;
    }
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("decide_gate", {
      p_phase: gate!.id, p_decision: decision, p_feedback: feedback.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setFeedback("");
    router.refresh();
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-8 min-w-0">
        <header>
          <Link href={`/c/${props.slug}`} className="t-eyebrow hover:text-ink transition-colors">
            ← {props.clientName}
          </Link>
          <h1 className="t-display mt-2 font-mono text-[clamp(1.6rem,3.5vw,2.4rem)]">{props.workflow}</h1>
        </header>

        {gate && (
          <section className="card border-gate p-6 flex flex-col gap-4">
            <div className="t-eyebrow text-gate">
              waiting for your decision — {gate.phase_id}
              {gate.gate_class ? ` · ${gate.gate_class}` : ""}
            </div>
            <p className="t-body text-ink-2">{gate.gate_text}</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => decide("approved")} disabled={busy}
                className="rounded-full bg-gate text-paper font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity">
                Approve
              </button>
              <button onClick={() => decide("rejected")} disabled={busy}
                className="rounded-full bg-danger-soft text-danger font-semibold px-5 py-2.5 hover:opacity-80 disabled:opacity-50 transition-opacity">
                Request changes
              </button>
              {gateArtifact && (
                <button onClick={() => setOpen(gateArtifact.path)}
                  className="rounded-full bg-paper-3 text-ink font-semibold px-5 py-2.5 hover:bg-rule transition-colors">
                  Read {gateArtifact.path}
                </button>
              )}
            </div>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
              placeholder="To request changes: what, concretely."
              className="rounded-lg border border-rule bg-paper px-3 py-2.5 t-body min-h-20 outline-none focus:border-gate" />
            {err && <p className="t-body text-danger">{err}</p>}
          </section>
        )}

        <section className="flex flex-col">
          {props.phases.map((p, i) => {
            const art = props.artifacts.find((a) => a.phase_id === p.id);
            return (
              <div key={p.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className={`mt-1.5 h-3 w-3 rounded-full flex-none ${DOT[p.status] ?? "bg-paper-3"}`} />
                  {i < props.phases.length - 1 && <span className="w-px flex-1 bg-rule" />}
                </div>
                <div className="pb-7 min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="t-h2">{p.phase_id}</span>
                    <span className="t-mono text-ink-3">{p.agent}</span>
                    {p.status === "running" && <span className="t-mono text-cobalt pulse">working…</span>}
                    {p.status === "awaiting_gate" && <span className="t-mono text-gate">⏸ your call</span>}
                    {p.status === "failed" && <span className="t-mono text-danger">failed</span>}
                  </div>
                  {art?.content && (
                    <button onClick={() => setOpen(open === art.path ? null : art.path)}
                      className="t-mono text-cobalt hover:underline underline-offset-2 mt-1">
                      {open === art.path ? "close" : art.path}
                    </button>
                  )}
                  {p.error && <p className="t-mono text-danger mt-1">{p.error}</p>}
                </div>
              </div>
            );
          })}
        </section>

        {artifact?.content && (
          <section className="card p-8">
            <div className="t-eyebrow mb-4">{artifact.path}</div>
            <div className="doc">
              <Markdown remarkPlugins={[remarkGfm]}>{artifact.content}</Markdown>
            </div>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-10 h-fit flex flex-col gap-3 min-w-0">
        <div className="t-eyebrow">
          live activity {running && <span className="text-cobalt pulse">·</span>}
        </div>
        <div className="card p-4 flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
          {events.length === 0 && <p className="t-mono text-ink-3">quiet.</p>}
          {events.map((e) => (
            <p key={e.id} className="t-mono text-ink-2 break-words">
              {e.type === "session_start" && <>· session started <span className="text-ink-3">({String(e.payload.model ?? "")})</span></>}
              {e.type === "tool" && <>▸ {String(e.payload.line ?? "")}</>}
              {e.type === "text" && <span className="text-ink-3">✎ {String(e.payload.line ?? "")}</span>}
              {e.type === "done" && <span className="text-ok">✓ session finished</span>}
            </p>
          ))}
        </div>
      </aside>
    </main>
  );
}
