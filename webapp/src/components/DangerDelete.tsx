"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/* Two-step delete: first click arms, second click executes. Owner-only —
   the RPC enforces it server-side; this component just renders the affordance. */

export default function DangerDelete({ label, confirmLabel, rpc, args, redirectTo }: {
  label: string; confirmLabel: string; rpc: "delete_run" | "delete_client";
  args: Record<string, string>; redirectTo: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().rpc(rpc, args);
    if (error) { setErr(error.message); setBusy(false); setArmed(false); return; }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {!armed ? (
        <button onClick={() => setArmed(true)}
          className="t-mono text-ink-3 hover:text-[color:var(--danger)] transition-colors">
          {label}
        </button>
      ) : (
        <>
          <span className="t-mono" style={{ color: "var(--danger)" }}>{confirmLabel}</span>
          <button onClick={run} disabled={busy}
            className="t-mono px-3 py-1 rounded-md"
            style={{ background: "var(--danger)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {busy ? "deleting…" : "yes, delete"}
          </button>
          <button onClick={() => setArmed(false)} disabled={busy}
            className="t-mono text-ink-3 hover:text-ink">keep it</button>
        </>
      )}
      {err && <span className="t-mono" style={{ color: "var(--danger)" }}>{err}</span>}
    </div>
  );
}
