"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function Login() {
  const [state, formAction, busy] = useActionState<LoginState, FormData>(loginAction, {});
  const err = state.error ?? "";

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
          audits, media plans, weekly optimization — run by AI, signed by people
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
          <form action={formAction} className="flex flex-col gap-4 rise" style={{ "--d": "220ms" } as React.CSSProperties}>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Email</span>
              <input className="field" name="email" defaultValue={state.email ?? ""} type="email" required autoFocus autoComplete="email" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-eyebrow">Password</span>
              <input className="field" name="password" type="password" required autoComplete="current-password" />
            </label>
            {err && <p className="t-body text-danger">{err}</p>}
            <button disabled={busy} className="btn btn-ink mt-1">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="t-mono text-ink-3 mt-2">
              Trouble signing in? Write to your account director — they reset access.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
