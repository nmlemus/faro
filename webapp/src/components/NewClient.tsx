"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function NewClient({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ slug: "", name: "", website: "", language: "English", business: "", icp: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function create() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().from("clients").insert({
      org_id: orgId, slug: f.slug.trim(), name: f.name.trim(),
      website: f.website.trim() || null, language: f.language,
      business: f.business.trim() || null, icp: f.icp.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    router.push(`/c/${f.slug.trim()}`); router.refresh();
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="rounded-full bg-ink text-paper font-semibold px-4 py-2 t-body hover:opacity-90 transition-opacity">
      + New client
    </button>
  );

  const field = "rounded-lg border border-rule bg-paper px-3 py-2.5 t-body outline-none focus:border-cobalt";
  return (
    <div className="fixed inset-0 z-20 bg-black/40 grid place-items-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="card w-full max-w-md p-6 flex flex-col gap-4 bg-paper">
        <h3 className="t-h1">New client</h3>
        <label className="flex flex-col gap-1"><span className="t-eyebrow">Short id</span>
          <input className={field} value={f.slug} onChange={set("slug")} placeholder="acme" /></label>
        <label className="flex flex-col gap-1"><span className="t-eyebrow">Name</span>
          <input className={field} value={f.name} onChange={set("name")} placeholder="ACME Inc." /></label>
        <label className="flex flex-col gap-1"><span className="t-eyebrow">Website — the audit runs on this alone</span>
          <input className={field} value={f.website} onChange={set("website")} placeholder="https://…" /></label>
        <label className="flex flex-col gap-1"><span className="t-eyebrow">Deliverable language</span>
          <select className={field} value={f.language} onChange={set("language")}>
            <option>English</option><option>Spanish</option><option>Portuguese</option>
          </select></label>
        <label className="flex flex-col gap-1"><span className="t-eyebrow">Business, one line</span>
          <input className={field} value={f.business} onChange={set("business")} /></label>
        <label className="flex flex-col gap-1"><span className="t-eyebrow">Who they sell to — empty is a valid answer</span>
          <input className={field} value={f.icp} onChange={set("icp")} /></label>
        {err && <p className="t-body text-danger">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={() => setOpen(false)} className="t-body text-ink-3 hover:text-ink">Cancel</button>
          <button onClick={create} disabled={busy || !f.slug || !f.name}
            className="rounded-full bg-ink text-paper font-semibold px-5 py-2 hover:opacity-90 disabled:opacity-40 transition-opacity">
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
