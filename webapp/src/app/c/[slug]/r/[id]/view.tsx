"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabaseBrowser } from "@/lib/supabase/client";

type Phase = {
  id: string; phase_id: string; seq: number; agent: string; produces: string;
  status: string; gate_class: string | null; gate_text: string | null; error: string | null;
  started_at: string | null; finished_at: string | null;
};
type Artifact = { id: string; path: string; content: string | null; phase_id: string | null };
type Ev = { id: number; type: string; payload: Record<string, unknown>; created_at: string };
type Decision = { phase_id: string; decision: string; decided_name: string | null;
                  feedback: string | null; created_at: string };

const fmtTime = (iso: string | null) => iso
  ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit" })
  : "";

// Fallback for events emitted before humanization: never show raw paths/commands.
function humanizeLegacy(line: string): string {
  const m = /^(Read|Write|Edit|Bash|bash|WebFetch|Grep|Glob|Skill|todo_write|TodoWrite):\s*(.*)$/.exec(line);
  if (!m) return line;
  const [, tool, rest] = m;
  if (tool === "Read") {
    if (rest.includes("SKILL.md")) {
      const parts = rest.split("/");
      return `Consulting the ${parts[parts.length - 2] ?? "method"} playbook`;
    }
    return `Reading ${rest.split("/").pop()}`;
  }
  if (tool === "Write" || tool === "Edit") return "Writing the deliverable";
  if (tool === "WebFetch") { try { return `Reading ${new URL(rest).host}`; } catch { return "Reading a web page"; } }
  if (tool === "Grep" || tool === "Glob") return "Searching the source material";
  if (tool === "Skill") return `Applying the ${rest} method`;
  if (tool.toLowerCase() === "todo_write" || tool === "TodoWrite") return "Planning the next steps";
  return "Running analysis";
}

const GLYPH: Record<string, string> = {
  done: "✓", awaiting_gate: "⏸", running: "●", failed: "✕", pending: "·", blocked: "·",
};

export default function RunView(props: {
  slug: string; clientName: string; workflow: string; runId: string;
  phases: Phase[]; artifacts: Artifact[]; initialEvents: Ev[]; decisions: Decision[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [events, setEvents] = useState<Ev[]>(props.initialEvents);
  const [open, setOpen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const gate = props.phases.find((p) => p.status === "awaiting_gate");
  const running = props.phases.some((p) => p.status === "running");
  const artifact = props.artifacts.find((a) => a.path === open);
  const gateArtifact = gate ? props.artifacts.find((a) => a.phase_id === gate.id) : null;

  useEffect(() => {
    const ch = supabase
      .channel(`run-${props.runId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `run_id=eq.${props.runId}` },
        (msg) => setEvents((prev) => [...prev.slice(-140), msg.new as Ev]))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "phases", filter: `run_id=eq.${props.runId}` },
        () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, props.runId, router]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

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
    setConfirmation(decision === "approved"
      ? "Approved — signed and recorded under your name."
      : "Changes requested — your feedback is folded into the redo, on the record.");
    router.refresh();
  }

  const d = (i: number) => ({ "--d": `${i * 80}ms` } as React.CSSProperties);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex flex-col gap-10 min-w-0">
        <header className="rise" style={d(0)}>
          <Link href={`/c/${props.slug}`} className="t-eyebrow hover:text-ink transition-colors">
            ← {props.clientName}
          </Link>
          <h1 className="t-display mt-2 font-[family-name:var(--font-spline-mono)] !text-[clamp(1.5rem,3.2vw,2.2rem)] !tracking-tight">
            {props.workflow}
          </h1>
        </header>

        {confirmation && (
          <div className="card p-4 flex items-center gap-3 rise" style={{ borderColor: "var(--ok)" }}>
            <span className="text-ok text-lg leading-none">✓</span>
            <p className="t-body text-ink-2">{confirmation}</p>
          </div>
        )}

        {gate && (
          <section className="card p-7 flex flex-col gap-5 rise"
            style={{ ...d(1), borderColor: "var(--gate)", boxShadow: "var(--sh-2)" }}>
            <div className="flex items-center gap-3">
              <span className="text-[1.6rem] leading-none" style={{ color: "var(--gate)" }}>⏸</span>
              <div>
                <div className="t-eyebrow" style={{ color: "var(--gate)" }}>
                  {gate.gate_class ?? "craft"} gate · {gate.phase_id}
                </div>
                <h2 className="t-h1 mt-0.5">This needs a human. That is you.</h2>
              </div>
            </div>
            <p className="t-body text-ink-2 max-w-[62ch]">{gate.gate_text}</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => decide("approved")} disabled={busy} className="btn btn-gate">Approve</button>
              <button onClick={() => decide("rejected")} disabled={busy} className="btn btn-danger">Request changes</button>
              {gateArtifact && (
                <button onClick={() => setOpen(gateArtifact.path)} className="btn btn-soft">
                  Read {gateArtifact.path}
                </button>
              )}
            </div>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
              placeholder="To request changes: what, concretely. Your words are folded into the redo."
              className="field min-h-20 resize-y" />
            {err && <p className="t-body text-danger">{err}</p>}
          </section>
        )}

        <section className="rise" style={d(2)}>
          <div className="t-eyebrow mb-4">the pipeline</div>
          <div className="flex flex-col">
            {props.phases.map((p, i) => {
              const art = props.artifacts.find((a) => a.phase_id === p.id);
              const tone = p.status === "done" ? "var(--ok)" : p.status === "awaiting_gate" ? "var(--gate)"
                : p.status === "running" ? "var(--cobalt)" : p.status === "failed" ? "var(--danger)" : "var(--ink-3)";
              return (
                <div key={p.id} className="grid grid-cols-[28px_1fr] gap-x-4">
                  <div className="flex flex-col items-center">
                    <span className={`grid place-items-center h-7 w-7 rounded-full border text-[0.8rem] font-semibold flex-none ${p.status === "running" || p.status === "awaiting_gate" ? "pulse" : ""}`}
                      style={{ color: tone, borderColor: tone,
                               background: p.status === "done" ? "var(--ok-soft)" : "transparent" }}>
                      {GLYPH[p.status] ?? "·"}
                    </span>
                    {i < props.phases.length - 1 && <span className="w-px flex-1 my-1" style={{ background: "var(--rule)" }} />}
                  </div>
                  <div className="pb-8 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="t-h2">{p.phase_id}</span>
                      <span className="t-mono text-ink-3">{p.agent} · AI</span>
                      {p.status === "running" && <span className="t-mono text-cobalt-ink pulse">working since {fmtTime(p.started_at)}</span>}
                      {p.status === "done" && p.finished_at && (
                        <span className="t-mono text-ink-3">{fmtTime(p.finished_at)}</span>
                      )}
                    </div>
                    {props.decisions.filter((dc) => dc.phase_id === p.id).map((dc, di) => (
                      <p key={di} className="t-mono mt-1"
                         style={{ color: dc.decision === "approved" ? "var(--ok)" : "var(--gate)" }}>
                        {dc.decision === "approved" ? "✓ Approved" : "↺ Changes requested"} by {dc.decided_name ?? "staff"} · {fmtTime(dc.created_at)}
                        {dc.feedback ? <span className="text-ink-3"> — “{dc.feedback}”</span> : null}
                      </p>
                    ))}
                    {art?.content && (
                      <button onClick={() => setOpen(open === art.path ? null : art.path)}
                        className="t-mono text-cobalt-ink hover:underline underline-offset-2 mt-1">
                        {open === art.path ? "close document" : `read ${art.path}`}
                      </button>
                    )}
                    {p.error && <p className="t-mono text-danger mt-1">{p.error}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {artifact?.content && (
          <section className="card-flat p-10 rise" style={{ boxShadow: "var(--sh-3)", background: "var(--paper)" }}>
            <div className="flex items-center justify-between mb-6">
              <span className="t-eyebrow">{artifact.path}</span>
              <div className="flex items-center gap-4">
                <a href={`/c/${props.slug}/r/${props.runId}/export?file=${encodeURIComponent(artifact.path)}`}
                  target="_blank" rel="noopener"
                  className="t-mono text-cobalt-ink hover:underline underline-offset-2">
                  export / PDF ↗
                </a>
                <button onClick={() => setOpen(null)} className="t-mono text-ink-3 hover:text-ink">close ✕</button>
              </div>
            </div>
            <div className="doc">
              <Markdown remarkPlugins={[remarkGfm]}>{artifact.content}</Markdown>
            </div>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-20 h-fit flex flex-col gap-3 min-w-0 rise" style={d(3)}>
        <div className="flex items-center gap-2">
          <span className={`beacon ${running ? "" : "idle"}`} aria-hidden />
          <span className="t-eyebrow">live activity</span>
        </div>
        <div ref={feedRef} className="feed p-4 flex flex-col gap-1 max-h-[68vh] overflow-y-auto">
          {events.length === 0 && <p className="dim">quiet. events stream here the moment work starts.</p>}
          {events.map((e) => (
            <p key={e.id} className="break-words">
              {e.type === "session_start" && <span className="dim">· session started ({String(e.payload.model ?? "")})</span>}
              {e.type === "tool" && <><span className="accent">▸</span> {humanizeLegacy(String(e.payload.line ?? ""))}</>}
              {e.type === "text" && <span className="dim">✎ {String(e.payload.line ?? "")}</span>}
              {e.type === "done" && <span className="good">✓ session finished</span>}
              {e.type === "error" && <span className="text-danger">✕ {String(e.payload.line ?? "")}</span>}
            </p>
          ))}
        </div>
      </aside>
    </main>
  );
}
