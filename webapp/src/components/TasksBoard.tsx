"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/* The board: todo / doing / done, filter by person or account, add inline.
   V1 is deliberately buttons-not-drag — reliable beats fancy. */

export type Task = {
  id: string; title: string; detail: string | null; status: "todo" | "doing" | "done";
  client_id: string | null; assignee: string | null; assignee_name: string | null;
  due_date: string | null; source: string; created_at: string;
};
export type Staff = { user_id: string; name: string };
export type ClientRef = { id: string; name: string; slug: string };

const COLS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "to do" }, { key: "doing", label: "doing" }, { key: "done", label: "done" },
];

export default function TasksBoard({ orgId, meId, tasks, staff, clients }: {
  orgId: string; meId: string; tasks: Task[]; staff: Staff[]; clients: ClientRef[];
}) {
  const router = useRouter();
  const [who, setWho] = useState<string>("all");
  const [account, setAccount] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", client_id: "", assignee: "", due_date: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const visible = tasks.filter((t) =>
    (who === "all" || (who === "me" ? t.assignee === meId : t.assignee === who)) &&
    (account === "all" || t.client_id === account));

  async function move(t: Task, dir: 1 | -1) {
    const order: Task["status"][] = ["todo", "doing", "done"];
    const next = order[order.indexOf(t.status) + dir];
    if (!next) return;
    const { error } = await supabaseBrowser().from("tasks").update({ status: next }).eq("id", t.id);
    if (!error) router.refresh();
  }

  async function remove(t: Task) {
    const { error } = await supabaseBrowser().from("tasks").delete().eq("id", t.id);
    if (!error) router.refresh();
  }

  async function add() {
    if (!f.title.trim()) { setErr("a task needs a title"); return; }
    setBusy(true); setErr("");
    const assignee = staff.find((s) => s.user_id === f.assignee);
    const { error } = await supabaseBrowser().from("tasks").insert({
      org_id: orgId,
      title: f.title.trim(),
      client_id: f.client_id || null,
      assignee: f.assignee || null,
      assignee_name: assignee?.name ?? null,
      due_date: f.due_date || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setF({ title: "", client_id: "", assignee: "", due_date: "" });
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select className="field !py-1.5 !w-auto" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">everyone</option>
          <option value="me">assigned to me</option>
          {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <select className="field !py-1.5 !w-auto" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="all">all accounts</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setAdding(!adding)} className="btn btn-ink !py-1.5">+ task</button>
      </div>

      {adding && (
        <div className="card p-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 grow min-w-[16rem]">
            <span className="t-eyebrow">what needs doing</span>
            <input className="field" autoFocus value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && add()} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-eyebrow">account</span>
            <select className="field" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
              <option value="">general</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-eyebrow">assignee</span>
            <select className="field" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
              <option value="">unassigned</option>
              {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-eyebrow">due</span>
            <input type="date" className="field" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </label>
          <button onClick={add} disabled={busy} className="btn btn-ink">{busy ? "adding…" : "add"}</button>
          {err && <span className="t-mono" style={{ color: "var(--danger)" }}>{err}</span>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 items-start">
        {COLS.map((col) => {
          const items = visible.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="card-flat p-3 flex flex-col gap-2.5 min-h-[10rem]">
              <div className="flex items-baseline justify-between px-1">
                <span className="t-eyebrow">{col.label}</span>
                <span className="t-mono text-ink-3">{items.length}</span>
              </div>
              {items.map((t) => {
                const overdue = t.due_date && t.status !== "done" && t.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <div key={t.id} className="card p-3.5 flex flex-col gap-2">
                    <span className="t-h2" style={t.status === "done" ? { textDecoration: "line-through", color: "var(--ink-3)" } : undefined}>
                      {t.title}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.client_id && <span className="chip idle">{clientName.get(t.client_id) ?? "…"}</span>}
                      {t.assignee_name && <span className="t-mono text-ink-2">{t.assignee_name}</span>}
                      {t.due_date && (
                        <span className="t-mono" style={{ color: overdue ? "var(--danger)" : "var(--ink-3)" }}>
                          {overdue ? "⚠ " : ""}{t.due_date}
                        </span>
                      )}
                      {t.source !== "manual" && <span className="chip run">{t.source}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {col.key !== "todo" && (
                        <button onClick={() => move(t, -1)} className="t-mono text-ink-3 hover:text-ink">←</button>
                      )}
                      {col.key !== "done" && (
                        <button onClick={() => move(t, 1)} className="t-mono text-cobalt-ink hover:underline">
                          {col.key === "todo" ? "start →" : "done ✓"}
                        </button>
                      )}
                      <button onClick={() => remove(t)} className="t-mono text-ink-3 hover:text-[color:var(--danger)] ml-auto">✕</button>
                    </div>
                  </div>
                );
              })}
              {!items.length && <p className="t-mono text-ink-3 px-1 py-3">—</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
