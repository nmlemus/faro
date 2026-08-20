"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { tFor, type Lang } from "@/lib/i18n";

export default function LoginForm({ lang }: { lang: Lang }) {
  const [state, formAction, busy] = useActionState<LoginState, FormData>(loginAction, {});
  const t = tFor(lang);
  const err = state.error ? t(state.error) : "";

  return (
    <form action={formAction} className="flex flex-col gap-4 rise" style={{ "--d": "220ms" } as React.CSSProperties}>
      <label className="flex flex-col gap-1.5">
        <span className="t-eyebrow">{t("Email")}</span>
        <input className="field" name="email" defaultValue={state.email ?? ""} type="email" required autoFocus autoComplete="email" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="t-eyebrow">{t("Password")}</span>
        <input className="field" name="password" type="password" required autoComplete="current-password" />
      </label>
      {err && <p className="t-body text-danger">{err}</p>}
      <button disabled={busy} className="btn btn-ink mt-1">
        {busy ? t("Signing in…") : t("Sign in")}
      </button>
      <p className="t-mono text-ink-3 mt-2">
        {t("Trouble signing in? Write to your account director — they reset access.")}
      </p>
    </form>
  );
}
