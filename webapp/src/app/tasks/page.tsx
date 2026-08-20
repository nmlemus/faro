import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Shell from "@/components/Shell";
import TasksBoard from "@/components/TasksBoard";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("org_members").select("role,org_id").eq("user_id", me.user?.id ?? "").limit(1);
  const role = membership?.[0]?.role ?? "client_viewer";
  if (role === "client_viewer") redirect("/");
  const orgId = membership![0].org_id;
  const lang = await getLang();

  const [{ data: tasks }, { data: staff }, { data: clients }] = await Promise.all([
    supabase.from("tasks").select("*").order("updated_at", { ascending: false }).limit(300),
    supabase.rpc("org_staff", { p_org: orgId }),
    supabase.from("clients").select("id,name,slug").order("name"),
  ]);

  return (
    <Shell working={false} lang={lang} staff>
      <main className="max-w-[1280px] mx-auto px-6 py-10 flex flex-col gap-8">
        <header className="rise">
          <h1 className="t-display !text-[clamp(1.6rem,3vw,2.2rem)]">
            {lang === "es" ? <>El tablero<em>.</em></> : <>The board<em>.</em></>}
          </h1>
          <p className="t-body text-ink-2 mt-1">
            {lang === "es"
              ? "Lo que hay que hacer, quién lo tiene y para cuándo — por cuenta o en general."
              : "What needs doing, who has it, and by when — per account or in general."}
          </p>
        </header>
        <div className="rise" style={{ "--d": "90ms" } as React.CSSProperties}>
          <TasksBoard orgId={orgId} meId={me.user!.id}
            tasks={tasks ?? []} staff={staff ?? []} clients={clients ?? []} />
        </div>
      </main>
    </Shell>
  );
}
