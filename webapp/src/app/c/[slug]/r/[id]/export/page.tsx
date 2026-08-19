import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChartBlock from "@/components/ChartBlock";
import { prepDoc } from "@/lib/md";
import { supabaseServer } from "@/lib/supabase/server";
import PrintButton from "./print-button";

/* Client-ready view of one deliverable: the document, the signature, nothing else.
   Always light, print-first — File > Save as PDF gives the deck-ready artifact. */

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

export default async function ExportPage({ params, searchParams }: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { slug, id } = await params;
  const { file } = await searchParams;
  if (!file) notFound();

  const supabase = await supabaseServer();
  const { data: client } = await supabase.from("clients").select("*").eq("slug", slug).single();
  if (!client) notFound();
  const { data: artifact } = await supabase
    .from("artifacts").select("path,content,phase_id,created_at")
    .eq("run_id", id).eq("path", file).single();
  if (!artifact?.content) notFound();

  const { data: decision } = artifact.phase_id
    ? await supabase.from("gate_decisions")
        .select("decided_name,created_at").eq("phase_id", artifact.phase_id)
        .eq("decision", "approved").order("created_at", { ascending: false }).limit(1)
    : { data: null };
  const approval = decision?.[0];

  return (
    <div data-theme="light" style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { .no-print { display: none !important; } }
        .export-page {
          /* pin the LIGHT palette locally: the theme toggle lives on :root, so an
             OS-dark viewer would otherwise resolve dark tokens inside this white page */
          --paper: #FFFFFF; --paper-2: #F2F0E9; --paper-3: #E8E5DB;
          --ink: #131518; --ink-2: #46494E; --ink-3: #7E8287;
          --rule: #DDD9CD; --rule-soft: #E9E6DC;
          --cobalt: #2743E3; --cobalt-ink: #1D33B8; --cobalt-soft: #E4E8FC;
          --gate: #965E06; --gate-soft: #F8E8CC; --ok: #1F6B45; --ok-soft: #DFF0E5;
          --danger: #A8231A; --danger-soft: #F9E3E0;
          max-width: 46rem; margin: 0 auto; padding: 3rem 1.5rem 4rem;
          color: var(--ink); }
        
        .export-head { display: flex; justify-content: space-between; align-items: baseline;
          border-bottom: 2px solid #16181A; padding-bottom: 1rem; margin-bottom: 2rem; }
        .export-foot { border-top: 1px solid #DDD9CD; margin-top: 3rem; padding-top: 1rem;
          font-family: var(--font-spline-mono); font-size: .7rem; color: #7E8287;
          display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
      `}</style>
      <div className="export-page">
        <div className="export-head">
          <span style={{ fontFamily: "var(--font-fraunces)", fontWeight: 600, fontSize: "1.1rem" }}>
            faro<span style={{ color: "#2743E3" }}>.</span>
          </span>
          <span style={{ fontFamily: "var(--font-spline-mono)", fontSize: ".7rem", color: "#7E8287" }}>
            prepared for {client.name}
          </span>
        </div>
        <div className="doc" style={{ maxWidth: "none" }}>
          <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{prepDoc(artifact.content)}</Markdown>
        </div>
        <div className="export-foot">
          <span>
            {approval
              ? `Approved by ${approval.decided_name ?? "staff"} · ${new Date(approval.created_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : "Working draft — not yet approved"}
          </span>
          <span>Every number in this document carries its origin.</span>
        </div>
        <PrintButton />
      </div>
    </div>
  );
}
