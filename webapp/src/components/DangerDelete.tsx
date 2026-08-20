"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/* Destructive actions look destructive: an outlined red button, a two-step
   confirm, and (for account-level deletes) typing the name to arm the final
   button. Owner-only — the RPC enforces it server-side. */

export default function DangerDelete({ label, confirmLabel, rpc, args, redirectTo, danger, requireText }: {
  label: string; confirmLabel: string; rpc: "delete_run" | "delete_client";
  args: Record<string, string>; redirectTo: string;
  danger?: boolean; requireText?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const ready = !requireText || typed.trim() === requireText;

  async function run() {
    if (!ready) return;
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().rpc(rpc, args);
    if (error) { setErr(error.message); setBusy(false); setArmed(false); return; }
    router.push(redirectTo);
    router.refresh();
  }

  if (!armed) return (
    <button onClick={() => { setArmed(true); setTyped(""); }}
      className={danger
        ? "btn t-mono !font-semibold"
        : "t-mono text-ink-3 hover:text-[color:var(--danger)] transition-colors"}
      style={danger ? { background: "transparent", color: "var(--danger)",
                        border: "1px solid var(--danger)", fontSize: ".78rem" } : undefined}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl"
      style={{ border: "1px solid var(--danger)", background: "var(--danger-soft)", maxWidth: "34rem" }}>
      <span className="t-body" style={{ color: "var(--danger)", fontWeight: 600 }}>{confirmLabel}</span>
      {requireText && (
        <input className="field" autoFocus placeholder={`Type “${requireText}” to confirm`}
          value={typed} onChange={(e) => setTyped(e.target.value)} />
      )}
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy || !ready}
          className="btn t-mono !font-semibold"
          style={{ background: "var(--danger)", color: "#fff",
                   opacity: busy || !ready ? 0.5 : 1 }}>
          {busy ? "deleting…" : "yes, delete forever"}
        </button>
        <button onClick={() => setArmed(false)} disabled={busy}
          className="t-mono text-ink-2 hover:text-ink">keep it</button>
        {err && <span className="t-mono" style={{ color: "var(--danger)" }}>{err}</span>}
      </div>
    </div>
  );
}
