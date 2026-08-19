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
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div>
          <div className="t-display">faro<span className="text-cobalt">.</span></div>
          <p className="t-body text-ink-2 mt-2">
            The agency, operated in the open. Sign in to see your account.
          </p>
        </div>
        <form onSubmit={submit} className="card p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="t-eyebrow">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
              className="rounded-lg border border-rule bg-paper px-3 py-2.5 t-body outline-none focus:border-cobalt" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="t-eyebrow">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
              className="rounded-lg border border-rule bg-paper px-3 py-2.5 t-body outline-none focus:border-cobalt" />
          </label>
          {err && <p className="t-body text-danger">{err}</p>}
          <button disabled={busy}
            className="rounded-full bg-ink text-paper font-semibold py-2.5 mt-1 hover:opacity-90 disabled:opacity-50 transition-opacity">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
