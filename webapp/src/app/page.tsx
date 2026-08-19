import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import NewClient from "@/components/NewClient";

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

  const { data: gates } = staff
    ? await supabase
        .from("phases")
        .select("id,phase_id,gate_class,run_id,clients(slug,name),job_runs(id),created_at")
        .eq("status", "awaiting_gate")
        .order("created_at")
    : { data: [] as never[] };

  return (
    <main className="max-w-5xl mx-auto px-6 py-14 flex flex-col gap-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="t-eyebrow mb-2">faro · {staff ? "operations" : "accounts"}</div>
          <h1 className="t-display">
            {gates && gates.length > 0
              ? <>{gates.length} decision{gates.length > 1 ? "s" : ""} waiting<span className="text-gate">.</span></>
              : <>All quiet<span className="text-cobalt">.</span></>}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {staff && <NewClient orgId={membership![0].org_id} />}
          <form action="/auth/signout" method="post">
            <button className="t-mono text-ink-3 hover:text-ink transition-colors">sign out</button>
          </form>
        </div>
      </header>

      {staff && gates && gates.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="t-eyebrow">waiting on you</div>
          {gates.map((g) => {
            const c = g.clients as unknown as { slug: string; name: string };
            return (
              <Link key={g.id} href={`/c/${c.slug}/r/${g.run_id}`}
                className="card border-gate p-4 flex items-center justify-between gap-4 hover:opacity-90 transition-opacity">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="t-h2">{c.name}</span>
                  <span className="t-mono text-ink-3 truncate">{g.phase_id}</span>
                </div>
                <span className="t-mono bg-gate-soft text-gate rounded-full px-2.5 py-1 flex-none">
                  {g.gate_class ?? "craft"}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="t-eyebrow">accounts</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {clients.map((c) => {
            const phases = (c.job_runs ?? []).flatMap((r) => r.phases ?? []);
            const g = phases.filter((p) => p.status === "awaiting_gate").length;
            const running = phases.some((p) => p.status === "running");
            return (
              <Link key={c.slug} href={`/c/${c.slug}`}
                className="card p-6 flex flex-col gap-3 hover:border-cobalt transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="t-h1">{c.name}</h2>
                  {g > 0 && <span className="t-mono bg-gate-soft text-gate rounded-full px-2.5 py-1">{g} waiting</span>}
                  {running && !g && <span className="t-mono bg-cobalt-soft text-cobalt rounded-full px-2.5 py-1 pulse">working</span>}
                </div>
                <p className="t-mono text-ink-3">{c.website || "no site"} · {c.language}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
