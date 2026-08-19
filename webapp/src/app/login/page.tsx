"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.push("/"); router.refresh();
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-rule"
        style={{ background: "var(--paper-2)" }}>
        <div className="rise" style={{ "--d": "80ms" } as React.CSSProperties}>
          <span className="beacon hero" aria-hidden />
        </div>
        <div className="flex flex-col gap-5">
          <h1 className="t-display rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            The agency,<br />operated <em>in the open.</em>
          </h1>
          <p className="t-body text-ink-2 max-w-[46ch] rise" style={{ "--d": "300ms" } as React.CSSProperties}>
            Every deliverable traceable. Every number with an origin.
            Every decision signed by a person. That is the whole method —
            and you are looking at it running.
          </p>
        </div>
        <p className="t-mono text-ink-3 rise" style={{ "--d": "420ms" } as React.CSSProperties}>
          six practices · fifty-one methods · nine gates
        </p>
      </section>

      <section className="grid place-items-center p-8">
        <div className="w-full max-w-sm flex flex-col gap-8">
          <div className="lg:hidden flex items-center gap-3">
            <span className="beacon lg" aria-hidden />
            <span className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold">
              faro<span className="text-cobalt">.</span>
            </span>
          </div>
          <div className="rise" style={{ "--d": "120ms" } as React.CSSProperties}>
            <div className="t-eyebrow mb-2">sign in</div>
            <h2 className="t-h1">Your account is waiting.</h2>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 rise" style={{ "--d": "220ms" } as React.CSSProperties}>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Email</span>
              <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoFocus />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Password</span>
              <input className="field" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </label>
            {err && <p className="t-body text-danger">{err}</p>}
            <button disabled={busy} className="btn btn-ink mt-1">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
