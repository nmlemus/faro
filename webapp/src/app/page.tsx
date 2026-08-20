import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import NewClient from "@/components/NewClient";

export const dynamic = "force-dynamic";

/* The desk — the staff cockpit. Built to hold 20 accounts on one screen:
   the org numbers, the decision queue (money first, oldest first), what is
   running right now, and every account as one dense row. Client viewers
   never see this — they land on their own editorial page. */

const fmtAge = (iso: string | null) => {
  if (!iso) return "";
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};
const fmtDay = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("org_members").select("role,org_id").eq("user_id", me.user?.id ?? "").limit(1);
  const role = membership?.[0]?.role ?? "client_viewer";
  const staff = role !== "client_viewer";

  const { data: clients } = await supabase
    .from("clients")
    .select("id,slug,name,website,language,job_runs(id,status,run_key,jobs(workflow_id,recurring),phases(status,phase_id))")
    .order("name");
  if (!clients?.length) redirect("/login");
  if (!staff) {
    if (clients.length === 1) redirect(`/c/${clients[0].slug}`);
    // a viewer on several clients gets the simple editorial list
    return (
      <Shell working={false}>
        <main className="max-w-3xl mx-auto px-6 py-14 flex flex-col gap-6">
          <h1 className="t-display rise">Your accounts<span className="text-cobalt">.</span></h1>
          {clients.map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="card p-6 t-h1">{c.name}</Link>
          ))}
        </main>
      </Shell>
    );
  }

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [{ data: gates }, { data: running }, { data: costs }, { data: lastArts }] = await Promise.all([
    supabase.from("phases")
      .select("id,phase_id,gate_class,run_id,cost_usd,started_at,created_at,clients(slug,name),job_runs(jobs(workflow_id))")
      .eq("status", "awaiting_gate").order("created_at"),
    supabase.from("phases")
      .select("id,phase_id,run_id,started_at,clients(slug,name),job_runs(jobs(workflow_id))")
      .eq("status", "running"),
    supabase.from("phases")
      .select("client_id,cost_usd,finished_at")
      .not("cost_usd", "is", null).gte("finished_at", monthStart.toISOString()),
    supabase.from("artifacts")
      .select("client_id,path,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const costByClient = new Map<string, number>();
  for (const c of costs ?? [])
    costByClient.set(c.client_id, (costByClient.get(c.client_id) ?? 0) + Number(c.cost_usd));
  const orgCost = [...costByClient.values()].reduce((a, b) => a + b, 0);

  const lastByClient = new Map<string, { path: string; created_at: string }>();
  for (const a of lastArts ?? [])
    if (!lastByClient.has(a.client_id)) lastByClient.set(a.client_id, a);

  // gates: money first, then oldest first
  const gateOrder = { money: 0, measurement: 1, publish: 2, craft: 3 } as Record<string, number>;
  const queue = [...(gates ?? [])].sort((a, b) =>
    (gateOrder[a.gate_class ?? "craft"] ?? 9) - (gateOrder[b.gate_class ?? "craft"] ?? 9) ||
    (a.started_at ?? a.created_at ?? "").localeCompare(b.started_at ?? b.created_at ?? ""));
  const oldestGateIso = queue.length
    ? [...queue].sort((a, b) => (a.started_at ?? a.created_at ?? "").localeCompare(b.started_at ?? b.created_at ?? ""))[0]
    : null;

  // account rows, needs-attention first
  const rows = clients.map((c) => {
    const runs = c.job_runs ?? [];
    const phases = runs.flatMap((r) => r.phases ?? []);
    const gateN = phases.filter((p) => p.status === "awaiting_gate").length;
    const runN = phases.filter((p) => p.status === "running").length;
    const failN = phases.filter((p) => p.status === "failed").length;
    const inFlight = [...new Set(runs.filter((r) => r.status === "active")
      .map((r) => (r.jobs as unknown as { workflow_id: string })?.workflow_id).filter(Boolean))];
    const recurring = runs.map((r) => r.jobs as unknown as { workflow_id: string; recurring: string | null })
      .filter((j) => j?.recurring);
    const nextSched = recurring.length
      ? [...new Set(recurring.map((j) => `${j.workflow_id} · ${j.recurring}`))].join(", ") : "—";
    const state = gateN ? "gate" : runN ? "run" : failN ? "fail" : "quiet";
    const urgency = { gate: 0, fail: 1, run: 2, quiet: 3 }[state]!;
    return { c, gateN, inFlight, nextSched, state, urgency,
             cost: costByClient.get(c.id) ?? 0, last: lastByClient.get(c.id) };
  }).sort((a, b) => a.urgency - b.urgency || b.cost - a.cost);

  const d = (i: number) => ({ "--d": `${i * 90}ms` } as React.CSSProperties);

  return (
    <Shell working={(running ?? []).length > 0}>
      <main className="max-w-[1280px] mx-auto px-6 py-10 flex flex-col gap-10">

        {/* org strip */}
        <header className="grid gap-4 items-stretch rise" style={{ ...d(0), gridTemplateColumns: "1.5fr repeat(3, minmax(10rem, 1fr))" }}>
          <h1 className="t-display self-center !text-[clamp(1.6rem,3vw,2.2rem)]">
            {queue.length > 0
              ? <>{queue.length} decision{queue.length > 1 ? "s" : ""} need{queue.length > 1 ? "" : "s"} <em>a human.</em></>
              : (running ?? []).length > 0 ? <>The agency is <em>working.</em></>
              : <>All quiet on <em>every account.</em></>}
          </h1>
          {[
            [String(queue.length), queue.length && oldestGateIso
              ? `open gates · oldest ${fmtAge(oldestGateIso.started_at ?? oldestGateIso.created_at)}`
              : "open gates"],
            [String((running ?? []).length), "running now"],
            [`$${orgCost.toFixed(2)}`, "ai cost · month to date"],
          ].map(([v, label]) => (
            <div key={label} className="card-flat p-4 flex flex-col justify-center gap-0.5">
              <span className="tnum font-[family-name:var(--font-fraunces)] text-[1.5rem] leading-tight font-semibold">{v}</span>
              <span className="t-eyebrow">{label}</span>
            </div>
          ))}
        </header>

        {/* decision queue */}
        {queue.length > 0 && (
          <section className="flex flex-col gap-3 rise" style={d(1)}>
            <div className="flex items-baseline gap-3">
              <span className="t-eyebrow">needs a human</span>
              <span className="t-mono text-ink-3">money first, oldest first</span>
            </div>
            <div className="card !p-0 overflow-hidden flex flex-col">
              {queue.map((g) => {
                const c = g.clients as unknown as { slug: string; name: string };
                const wf = (g.job_runs as unknown as { jobs: { workflow_id: string } })?.jobs?.workflow_id;
                const age = Date.now() - new Date(g.started_at ?? g.created_at!).getTime();
                return (
                  <Link key={g.id} href={`/c/${c.slug}/r/${g.run_id}`}
                    className="desk-row grid items-center gap-4 px-5 py-2.5 border-b last:border-b-0"
                    style={{ gridTemplateColumns: "6.5rem 10rem 1fr 6rem 5rem 5.5rem", borderColor: "var(--rule-soft)" }}>
                    <span className={`chip ${g.gate_class === "money" ? "gate" : g.gate_class === "publish" ? "run" : "idle"}`}>
                      {g.gate_class ?? "craft"}
                    </span>
                    <span className="t-h2 truncate">{c.name}</span>
                    <span className="t-mono text-ink-2 truncate">{wf} · {g.phase_id}</span>
                    <span className="t-mono" style={{ color: age > 24 * 3600e3 ? "var(--danger)" : "var(--ink-3)" }}>
                      {fmtAge(g.started_at ?? g.created_at)}
                    </span>
                    <span className="t-mono text-ink-3 text-right tnum">
                      {g.cost_usd != null ? `$${Number(g.cost_usd).toFixed(2)}` : ""}
                    </span>
                    <span className="t-mono text-cobalt-ink text-right">review →</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* running now */}
        {(running ?? []).length > 0 && (
          <section className="flex flex-col gap-3 rise" style={d(2)}>
            <span className="t-eyebrow">running now</span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(running ?? []).map((r) => {
                const c = r.clients as unknown as { slug: string; name: string };
                const wf = (r.job_runs as unknown as { jobs: { workflow_id: string } })?.jobs?.workflow_id;
                return (
                  <Link key={r.id} href={`/c/${c.slug}/r/${r.run_id}`} className="card p-4 flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="t-h2 truncate"><span className="beacon mr-2" aria-hidden />{c.name}</span>
                      <span className="t-mono text-cobalt-ink truncate">{wf} · {r.phase_id}</span>
                    </div>
                    <span className="t-mono text-ink-3">working for {fmtAge(r.started_at)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* accounts, dense */}
        <section className="flex flex-col gap-3 rise" style={d(3)}>
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="t-eyebrow">accounts</span>
              <span className="t-mono text-ink-3">{clients.length} · needs-attention first</span>
            </div>
            <NewClient orgId={membership![0].org_id} />
          </div>
          <div className="card !p-0 overflow-x-auto">
            <table className="desk-table w-full" style={{ minWidth: "56rem", borderCollapse: "collapse" }}>
              <thead><tr>
                <th>account</th><th>state</th><th>in flight</th>
                <th style={{ textAlign: "right" }}>ai cost mtd</th>
                <th>last deliverable</th><th>scheduled</th>
              </tr></thead>
              <tbody>
                {rows.map(({ c, gateN, state, inFlight, nextSched, cost, last }) => (
                  <tr key={c.slug} className="desk-row">
                    <td>
                      <Link href={`/c/${c.slug}`} className="t-h2 hover:text-cobalt-ink">{c.name}</Link>
                      <span className="t-mono text-ink-3 ml-2">{(c.website || "").replace(/^https?:\/\//, "")}</span>
                    </td>
                    <td className="t-mono" style={{ color: state === "gate" ? "var(--gate)" : state === "run" ? "var(--cobalt-ink)" : state === "fail" ? "var(--danger)" : "var(--ink-3)" }}>
                      {state === "gate" ? `⏸ ${gateN} waiting on you` : state === "run" ? "● working"
                        : state === "fail" ? "✕ needs attention" : "quiet"}
                    </td>
                    <td className="t-mono text-ink-2">{inFlight.length ? inFlight.join(", ") : "—"}</td>
                    <td className="t-mono tnum" style={{ textAlign: "right" }}>{cost ? `$${cost.toFixed(2)}` : "—"}</td>
                    <td className="t-mono text-ink-3">{last ? `${last.path} · ${fmtDay(last.created_at)}` : "—"}</td>
                    <td className="t-mono text-ink-3">{nextSched}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-mono text-ink-3">
            ai cost counts every phase finished this month. spend &amp; margin columns arrive with
            recorded retainers and connected ad accounts — no number shows up here before its origin does.
          </p>
        </section>
      </main>
    </Shell>
  );
}
