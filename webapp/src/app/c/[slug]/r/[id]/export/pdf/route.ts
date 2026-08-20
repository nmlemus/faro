import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { supabaseServer } from "@/lib/supabase/server";
import { mdToTex, texDocument } from "@/lib/md-to-tex";
import { docName, isSpanish } from "@/lib/names";
import { tFor } from "@/lib/i18n";

const run = promisify(execFile);
const TEXBIN = "/Library/TeX/texbin/xelatex";

/* Real PDF export: markdown → LaTeX → xelatex. Long tables paginate with
   repeated headers (tabularray longtblr) — the html-print path stays as
   fallback but this is the deliverable-quality artifact. */

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const file = req.nextUrl.searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file param required" }, { status: 400 });

  const supabase = await supabaseServer();
  const { data: client } = await supabase.from("clients").select("*").eq("slug", slug).single();
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: artifact } = await supabase
    .from("artifacts").select("path,content,phase_id,created_at")
    .eq("run_id", id).eq("path", file).single();
  if (!artifact?.content) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: decision } = artifact.phase_id
    ? await supabase.from("gate_decisions")
        .select("decided_name,created_at").eq("phase_id", artifact.phase_id)
        .eq("decision", "approved").order("created_at", { ascending: false }).limit(1)
    : { data: null };
  const approval = decision?.[0];

  const lang = isSpanish(client.language) ? ("es" as const) : ("en" as const);
  const t = tFor(lang);
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(
    lang === "es" ? "es" : "en", { day: "numeric", month: "long", year: "numeric" });

  const tex = texDocument({
    body: mdToTex(artifact.content),
    clientName: client.name,
    date: dateFmt(artifact.created_at),
    approvalLine: approval
      ? `${t("Approved by")} ${approval.decided_name ?? "staff"} · ${dateFmt(approval.created_at)}`
      : t("Working draft — not yet approved"),
    originLine: t("Every number in this document carries its origin."),
  });

  const dir = await mkdtemp(join(tmpdir(), "faro-pdf-"));
  try {
    await writeFile(join(dir, "doc.tex"), tex, "utf8");
    const env = { ...process.env, PATH: `${process.env.PATH}:/Library/TeX/texbin` };
    // two passes: longtblr needs one to measure column widths
    for (let pass = 0; pass < 2; pass++) {
      await run(TEXBIN, ["-interaction=nonstopmode", "-halt-on-error", "doc.tex"],
        { cwd: dir, env, timeout: 90_000 }).catch(async (e) => {
        const log = await readFile(join(dir, "doc.log"), "utf8").catch(() => "");
        const errLines = log.split("\n").filter((l) => l.startsWith("!")).slice(0, 4).join(" | ");
        throw new Error(`xelatex pass ${pass + 1}: ${errLines || e.message}`);
      });
    }
    const pdf = await readFile(join(dir, "doc.pdf"));
    const filename = `${client.slug}-${docName(artifact.path, lang).toLowerCase().replace(/\s+/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
