import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: clients } = await supabase
    .from("clients")
    .select("slug,name,website,language,job_runs(status,phases(status))")
    .order("name");

  if (!clients?.length) redirect("/login");
  if (clients.length === 1) redirect(`/c/${clients[0].slug}`);

  return (
    <main className="max-w-5xl mx-auto px-6 py-14 flex flex-col gap-10">
      <header className="flex items-end justify-between">
        <div>
          <div className="t-eyebrow mb-2">faro · accounts</div>
          <h1 className="t-display">Every account,<br />one glance.</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button className="t-mono text-ink-3 hover:text-ink transition-colors">sign out</button>
        </form>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {clients.map((c) => {
          const phases = (c.job_runs ?? []).flatMap((r) => r.phases ?? []);
          const gates = phases.filter((p) => p.status === "awaiting_gate").length;
          const running = phases.some((p) => p.status === "running");
          return (
            <Link key={c.slug} href={`/c/${c.slug}`}
              className="card p-6 flex flex-col gap-3 hover:border-cobalt transition-colors">
              <div className="flex items-start justify-between gap-3">
                <h2 className="t-h1">{c.name}</h2>
                {gates > 0 && (
                  <span className="t-mono bg-gate-soft text-gate rounded-full px-2.5 py-1">
                    {gates} waiting
                  </span>
                )}
                {running && !gates && (
                  <span className="t-mono bg-cobalt-soft text-cobalt rounded-full px-2.5 py-1 pulse">
                    working
                  </span>
                )}
              </div>
              <p className="t-mono text-ink-3">{c.website || "no site"} · {c.language}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
