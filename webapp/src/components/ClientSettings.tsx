"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/* Inline account settings: the fields every phase reads. RLS enforces who can
   write (owner / account_director) — this form is only rendered for them. */

const FIELDS: { key: string; label: string; hint: string; long?: boolean }[] = [
  { key: "name", label: "name", hint: "how the account is called everywhere" },
  { key: "website", label: "website", hint: "the site audits and campaigns point at" },
  { key: "language", label: "deliverable language", hint: "what the client reads — the system still works in English" },
  { key: "business", label: "business", hint: "what they do, one line — every agent reads this first", long: true },
  { key: "icp", label: "ideal customer profile", hint: "who they sell to — targeting, tone and diagnosis all key off this", long: true },
  { key: "cadence", label: "cadence", hint: "content rhythm, e.g. “4 weeks” or “2 posts per week”" },
];

export default function ClientSettings({ client }: { client: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(({ key }) => [key, client[key] ?? ""])));

  async function save() {
    setBusy(true); setErr(""); setSaved(false);
    const { error } = await supabaseBrowser().from("clients").update(f).eq("id", client.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSaved(true); setOpen(false);
    router.refresh();
  }

  if (!open) return (
    <button onClick={() => { setOpen(true); setSaved(false); }}
      className="btn btn-soft t-mono !py-1.5 !px-3.5"
      style={{ border: "1px solid var(--rule)" }}>
      ⚙︎ account settings{saved ? " · saved ✓" : ""}
    </button>
  );

  return (
    <div className="card p-6 flex flex-col gap-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <span className="t-eyebrow">account settings</span>
        <button onClick={() => setOpen(false)} className="t-mono text-ink-3 hover:text-ink">close ✕</button>
      </div>
      {FIELDS.map(({ key, label, hint, long }) => (
        <label key={key} className="flex flex-col gap-1.5">
          <span className="t-mono text-ink-2">{label}</span>
          {long ? (
            <textarea className="field" rows={3} value={f[key]}
              onChange={(e) => setF({ ...f, [key]: e.target.value })} />
          ) : (
            <input className="field" value={f[key]}
              onChange={(e) => setF({ ...f, [key]: e.target.value })} />
          )}
          <span className="t-mono text-ink-3" style={{ fontSize: ".65rem" }}>{hint}</span>
        </label>
      ))}
      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn btn-ink">
          {busy ? "saving…" : "save"}
        </button>
        {err && <span className="t-mono" style={{ color: "var(--danger)" }}>{err}</span>}
      </div>
      <p className="t-mono text-ink-3" style={{ fontSize: ".65rem" }}>
        Changes apply to the NEXT run — work already delivered keeps the profile it was made with.
      </p>
    </div>
  );
}
