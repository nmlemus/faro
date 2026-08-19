import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import NewClient from "@/components/NewClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("org_members").select("role,org_id").eq("user_id", me.user?.id ?? "").limit(1);
  const role = membership?.[0]?.role ?? "client_viewer";
  const staff = role !== "client_viewer";

  const { data: clients } = await supabase
    .from("clients")
    .select("id,slug,name,website,language,job_runs(id,status,phases(status))")
    .order("name");
  if (!clients?.length) redirect("/login");
  if (!staff && clients.length === 1) redirect(`/c/${clients[0].slug}`);

  const allPhases = clients.flatMap((c) => (c.job_runs ?? []).flatMap((r) => r.phases ?? []));
  const working = allPhases.filter((p) => p.status === "running").length;
  const gatesN = allPhases.filter((p) => p.status === "awaiting_gate").length;
  const activeRuns = clients.flatMap((c) => c.job_runs ?? []).filter((r) => r.status === "active").length;

  const { data: gates } = staff
    ? await supabase.from("phases")
        .select("id,phase_id,gate_class,run_id,clients(slug,name),created_at")
        .eq("status", "awaiting_gate").order("created_at")
    : { data: [] as never[] };

  const d = (i: number) => ({ "--d": `${i * 90}ms` } as React.CSSProperties);

  return (
    <Shell working={working > 0}>
      <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-14">
        <header className="flex flex-col gap-8">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <h1 className="t-display rise" style={d(0)}>
              {gatesN > 0
                ? <>{gatesN} decision{gatesN > 1 ? "s" : ""} need{gatesN > 1 ? "" : "s"} <em>a human.</em></>
                : working > 0
                ? <>The agency is <em>working.</em></>
                : <>All quiet on <em>every account.</em></>}
            </h1>
            {staff && <div className="rise" style={d(1)}><NewClient orgId={membership![0].org_id} /></div>}
          </div>
          <div className="flex gap-10 flex-wrap rise" style={d(2)}>
            {[
              [clients.length, "accounts"],
              [activeRuns, "active jobs"],
              [working, "running now"],
              [gatesN, "waiting on you"],
            ].map(([n, label]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <span className="tnum font-[family-name:var(--font-fraunces)] text-[2rem] leading-none font-medium">
                  {n as number}
                </span>
                <span className="t-eyebrow">{label as string}</span>
              </div>
            ))}
          </div>
        </header>

        {staff && gates && gates.length > 0 && (
          <section className="flex flex-col gap-3 rise" style={d(3)}>
            <div className="t-eyebrow">waiting on you</div>
            {gates.map((g) => {
              const c = g.clients as unknown as { slug: string; name: string };
              return (
                <Link key={g.id} href={`/c/${c.slug}/r/${g.run_id}`}
                  className="card p-5 flex items-center justify-between gap-4"
                  style={{ borderColor: "var(--gate)" }}>
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="t-h2">{c.name}</span>
                    <span className="t-mono text-ink-3 truncate">{g.phase_id}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-none">
                    <span className="chip gate">{g.gate_class ?? "craft"}</span>
                    <span className="t-mono text-ink-3">review →</span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        <section className="flex flex-col gap-4 rise" style={d(4)}>
          <div className="t-eyebrow">accounts</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => {
              const phases = (c.job_runs ?? []).flatMap((r) => r.phases ?? []);
              const g = phases.filter((p) => p.status === "awaiting_gate").length;
              const run = phases.some((p) => p.status === "running");
              return (
                <Link key={c.slug} href={`/c/${c.slug}`} className="card p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="t-h1">{c.name}</h2>
                    {g > 0 && <span className="chip gate">{g} waiting</span>}
                    {run && !g && <span className="beacon" aria-hidden />}
                  </div>
                  <p className="t-mono text-ink-3">
                    {(c.website || "no site").replace(/^https?:\/\//, "")} · {c.language}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </Shell>
  );
}
