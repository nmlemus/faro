"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChartBlock from "@/components/ChartBlock";
import DangerDelete from "@/components/DangerDelete";
import { prepDoc } from "@/lib/md";
import { workflowName, docName, docTitle, phaseName } from "@/lib/names";
import { tFor, type Lang } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";

type Phase = {
  id: string; phase_id: string; seq: number; agent: string; produces: string;
  status: string; gate_class: string | null; gate_text: string | null; error: string | null;
  started_at: string | null; finished_at: string | null;
  cost_usd: number | string | null;
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

const mdComponents = {
  pre: (props: React.ComponentProps<"pre">) => {
    const child = props.children as React.ReactElement<{ className?: string }> | undefined;
    if (child && typeof child === "object" && "props" in child
        && child.props.className?.includes("language-chart")) return <>{props.children}</>;
    return <pre {...props} />;
  },
  code: (props: React.ComponentProps<"code">) => {
    if (props.className?.includes("language-chart"))
      return <ChartBlock source={String(props.children ?? "")} />;
    return <code {...props} />;
  },
};

export default function RunView(props: {
  owner?: boolean;
  staffView?: boolean;
  lang?: Lang;
  slug: string; clientName: string; workflow: string; runId: string;
  phases: Phase[]; artifacts: Artifact[]; initialEvents: Ev[]; decisions: Decision[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [events, setEvents] = useState<Ev[]>(props.initialEvents);
  const [open, setOpen] = useState<string | null>(null);
  const lang = props.lang ?? "en";
  const t = tFor(lang);
  const docRef = useRef<HTMLDivElement | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
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
    // the document is the protagonist: open the gate's doc, else the latest deliverable
    const fallback = gateArtifact?.path
      ?? [...props.artifacts].reverse().find((a) => a.content)?.path ?? null;
    if (fallback) setOpen(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) docRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

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
      ? t("Approved — signed and recorded under your name.")
      : t("Changes requested — your feedback is folded into the redo, on the record."));
    router.refresh();
  }

  const d = (i: number) => ({ "--d": `${i * 80}ms` } as React.CSSProperties);

  return (
    <main className="max-w-[1440px] mx-auto px-5 py-6 flex flex-col gap-5">
      {/* workspace header */}
      <header className="flex items-center gap-4 flex-wrap rise" style={d(0)}>
        <Link href={`/c/${props.slug}`} className="t-eyebrow hover:text-ink transition-colors flex-none">
          ← {props.clientName}
        </Link>
        <h1 className="t-h1">{workflowName(props.workflow, lang)}</h1>
        {props.staffView && <span className="t-mono text-ink-3">{props.workflow}</span>}
        {props.staffView && (() => {
          const total = props.phases.reduce((s, p) => s + (Number(p.cost_usd) || 0), 0);
          return total > 0 ? <span className="t-mono text-ink-3">· {t("run cost")} ${total.toFixed(2)}</span> : null;
        })()}
        <span className="ml-auto flex items-center gap-3">
          <button onClick={() => setLeftOpen(!leftOpen)}
            className={`t-mono ${leftOpen ? "text-ink" : "text-ink-3"} hover:text-ink`} aria-pressed={leftOpen}>
            ☰ {t("the pipeline")}
          </button>
          {props.staffView && (
            <button onClick={() => setRightOpen(!rightOpen)}
              className={`t-mono ${rightOpen ? "text-ink" : "text-ink-3"} hover:text-ink`} aria-pressed={rightOpen}>
              ▤ {t(running ? "live activity" : "activity log")}
            </button>
          )}
        </span>
      </header>

      {confirmation && (
        <div className="card p-4 flex items-center gap-3 rise" style={{ borderColor: "var(--ok)" }}>
          <span className="text-ok text-lg leading-none">✓</span>
          <p className="t-body text-ink-2">{confirmation}</p>
        </div>
      )}

      <div className="grid gap-5 items-start"
        style={{ gridTemplateColumns: [leftOpen ? "270px" : null, "minmax(0,1fr)",
                 props.staffView && rightOpen ? "330px" : null].filter(Boolean).join(" ") }}>

        {/* left rail — the steps, always clickable */}
        {leftOpen && (
          <aside className="lg:sticky lg:top-16 flex flex-col gap-1 rise" style={d(1)}>
            {props.phases.map((p) => {
              const art = props.artifacts.find((a) => a.phase_id === p.id);
              const active = art && open === art.path;
              const tone = p.status === "done" ? "var(--ok)" : p.status === "awaiting_gate" ? "var(--gate)"
                : p.status === "running" ? "var(--cobalt)" : p.status === "failed" ? "var(--danger)" : "var(--ink-3)";
              const dc = props.decisions.filter((x) => x.phase_id === p.id).at(-1);
              return (
                <button key={p.id} onClick={() => art?.content && setOpen(active ? null : art.path)}
                  disabled={!art?.content}
                  className="desk-row text-left rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
                  style={{ background: active ? "var(--paper-2)" : "transparent",
                           border: `1px solid ${active ? "var(--rule)" : "transparent"}`,
                           cursor: art?.content ? "pointer" : "default" }}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={`grid place-items-center h-6 w-6 rounded-full border text-[0.72rem] font-semibold flex-none ${p.status === "running" || p.status === "awaiting_gate" ? "pulse" : ""}`}
                      style={{ color: tone, borderColor: tone,
                               background: p.status === "done" ? "var(--ok-soft)" : "transparent" }}>
                      {GLYPH[p.status] ?? "·"}
                    </span>
                    <span className="t-h2 truncate">{props.staffView ? p.phase_id : phaseName(p.phase_id, lang)}</span>
                  </span>
                  <span className="t-mono text-ink-3 pl-[34px] truncate">
                    {p.agent} · AI
                    {p.status === "running" && <> · {t("working since")} {fmtTime(p.started_at)}</>}
                    {p.status === "done" && p.finished_at && <> · {fmtTime(p.finished_at)}{props.staffView && p.cost_usd != null ? ` · $${Number(p.cost_usd).toFixed(2)}` : ""}</>}
                  </span>
                  {dc && (
                    <span className="t-mono pl-[34px] truncate"
                      style={{ color: dc.decision === "approved" ? "var(--ok)" : "var(--gate)" }}>
                      {t(dc.decision === "approved" ? "✓ Approved" : "↺ Changes requested")} {t("by")} {dc.decided_name ?? "staff"}
                    </span>
                  )}
                  {p.error && <span className="t-mono text-danger pl-[34px]">{p.error.slice(0, 80)}</span>}
                </button>
              );
            })}
            {props.owner && (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--rule-soft)" }}>
                <DangerDelete label={t("delete this run")} confirmLabel="Run, documents and results go. No undo."
                  rpc="delete_run" args={{ p_run: props.runId }} redirectTo={`/c/${props.slug}`} danger />
              </div>
            )}
          </aside>
        )}

        {/* center stage — gate first, then the document */}
        <div className="flex flex-col gap-5 min-w-0 rise" style={d(2)}>
          {gate && (
            <section className="card p-6 flex flex-col gap-4"
              style={{ borderColor: "var(--gate)", boxShadow: "var(--sh-2)" }}>
              <div className="flex items-center gap-3">
                <span className="text-[1.5rem] leading-none" style={{ color: "var(--gate)" }}>⏸</span>
                <div>
                  <div className="t-eyebrow" style={{ color: "var(--gate)" }}>
                    {gate.gate_class ?? "craft"} {t("gate")} · {props.staffView ? gate.phase_id : phaseName(gate.phase_id, lang)}
                  </div>
                  <h2 className="t-h1 mt-0.5">{t("This needs a human. That is you.")}</h2>
                </div>
              </div>
              <p className="t-body text-ink-2 max-w-[62ch]">{gate.gate_text}</p>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
                placeholder={t("To request changes: what, concretely. Your words are folded into the redo.")}
                className="field min-h-16 resize-y" />
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => decide("approved")} disabled={busy} className="btn btn-gate">{t("Approve")}</button>
                <button onClick={() => decide("rejected")} disabled={busy} className="btn btn-danger">{t("Request changes")}</button>
                {gateArtifact?.content && open !== gateArtifact.path && (
                  <button onClick={() => setOpen(gateArtifact.path)} className="btn btn-soft">
                    {t("Read")} {props.staffView ? gateArtifact.path : docName(gateArtifact.path, lang)}
                  </button>
                )}
                {err && <span className="t-body text-danger">{err}</span>}
              </div>
            </section>
          )}

          {artifact?.content ? (
            <section ref={docRef} className="card-flat px-8 py-7 scroll-mt-16"
              style={{ boxShadow: "var(--sh-2)", background: "var(--paper)" }}>
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <span className="flex items-baseline gap-3 min-w-0">
                  <span className="t-h1 truncate">{docTitle(artifact.path, artifact.content, lang)}</span>
                  {props.staffView && <span className="t-eyebrow flex-none">{artifact.path}</span>}
                </span>
                <span className="flex items-center gap-4 flex-none">
                  <a href={`/c/${props.slug}/r/${props.runId}/export/pdf?file=${encodeURIComponent(artifact.path)}`}
                    className="t-mono text-cobalt-ink hover:underline underline-offset-2">
                    {t("Export PDF ↗")}
                  </a>
                  <a href={`/c/${props.slug}/r/${props.runId}/export?file=${encodeURIComponent(artifact.path)}`}
                    target="_blank" rel="noopener"
                    className="t-mono text-ink-3 hover:underline underline-offset-2">
                    {lang === "es" ? "vista imprimible" : "print view"}
                  </a>
                </span>
              </div>
              <div className="doc mx-auto">
                <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{prepDoc(artifact.content.replace(/^#\s[^\n]*\n+/, ""))}</Markdown>
              </div>
            </section>
          ) : !gate && (
            <section className="card-flat p-14 text-center">
              <p className="t-body text-ink-3">
                {lang === "es" ? "Elige un paso del proceso para leer su documento."
                  : "Pick a step on the left to read its document."}
              </p>
            </section>
          )}
        </div>

        {/* right rail — the executions */}
        {props.staffView && rightOpen && (
          <aside className="lg:sticky lg:top-16 h-fit flex flex-col gap-3 min-w-0 rise" style={d(3)}>
            <div className="flex items-center gap-2">
              <span className={`beacon ${running ? "" : "idle"}`} aria-hidden />
              <span className="t-eyebrow">{t(running ? "live activity" : "activity log")}</span>
            </div>
            <div ref={feedRef} className="feed p-4 flex flex-col gap-1 max-h-[76vh] overflow-y-auto">
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
        )}
      </div>
    </main>
  );
}
