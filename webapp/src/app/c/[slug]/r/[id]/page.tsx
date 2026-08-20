import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import RunView from "./view";
import Shell from "@/components/Shell";

export default async function RunPage(
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const supabase = await supabaseServer();
  const { data: client } = await supabase.from("clients").select("*").eq("slug", slug).single();
  if (!client) notFound();
  const { data: run } = await supabase
    .from("job_runs").select("id,run_key,status,jobs(workflow_id)").eq("id", id).single();
  if (!run) notFound();
  const { data: phases } = await supabase
    .from("phases").select("*").eq("run_id", id).order("seq");
  const { data: artifacts } = await supabase
    .from("artifacts").select("id,path,content,phase_id").eq("run_id", id).order("path");
  const { data: events } = await supabase
    .from("activity_events").select("id,type,payload,created_at")
    .eq("run_id", id).order("id", { ascending: false }).limit(80);
  const { data: decisions } = await supabase
    .from("gate_decisions").select("phase_id,decision,decided_name,feedback,created_at")
    .in("phase_id", (phases ?? []).map((p) => p.id))
    .order("created_at");

  const { data: me } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("org_members").select("role").eq("user_id", me.user?.id ?? "").limit(1);
  const owner = membership?.[0]?.role === "owner";
  const staffView = (membership?.[0]?.role ?? "client_viewer") !== "client_viewer";

  const running = (phases ?? []).some((p) => p.status === "running");
  return (
    <Shell working={running}>
    <RunView
      slug={slug}
      clientName={client.name}
      workflow={(run.jobs as unknown as { workflow_id: string })?.workflow_id ?? ""}
      runId={run.id}
      phases={phases ?? []}
      artifacts={artifacts ?? []}
      initialEvents={(events ?? []).reverse()}
      decisions={decisions ?? []}
      owner={owner}
      staffView={staffView}
      language={client.language}
    />
    </Shell>
  );
}
