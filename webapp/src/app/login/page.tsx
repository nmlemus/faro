import { getLang } from "@/lib/lang-server";
import { tFor } from "@/lib/i18n";
import LoginForm from "./form";
import LangSwitcher from "@/components/LangSwitcher";
import { devLogin } from "./actions";

export default async function Login() {
  const lang = await getLang();
  const t = tFor(lang);

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-rule"
        style={{ background: "var(--paper-2)" }}>
        <div className="rise" style={{ "--d": "80ms" } as React.CSSProperties}>
          <span className="beacon hero" aria-hidden />
        </div>
        <div className="flex flex-col gap-5">
          <h1 className="t-display rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            {t("Nothing ships")}<br /><em>{t("without your yes.")}</em>
          </h1>
          <p className="t-body text-ink-2 max-w-[46ch] rise" style={{ "--d": "300ms" } as React.CSSProperties}>
            {t("What ran this week, what it cost, what came back, and what's waiting on your decision — that's what's inside.")}
          </p>
        </div>
        <p className="t-mono text-ink-3 rise" style={{ "--d": "420ms" } as React.CSSProperties}>
          {t("your marketing, operated week by week")}
        </p>
      </section>

      <section className="relative grid place-items-center p-8">
        <div className="absolute top-6 right-8"><LangSwitcher lang={lang} /></div>
        <div className="w-full max-w-sm flex flex-col gap-8">
          <div className="lg:hidden flex items-center gap-3">
            <span className="beacon lg" aria-hidden />
            <span className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold">
              faro<span className="text-cobalt">.</span>
            </span>
          </div>
          <div className="rise" style={{ "--d": "120ms" } as React.CSSProperties}>
            <div className="t-eyebrow mb-2">{t("sign in")}</div>
            <h2 className="t-h1">{t("Your account is waiting.")}</h2>
          </div>
          <LoginForm lang={lang} />
          {/(127\.0\.0\.1|localhost)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") && (
            <div className="card-flat p-4 flex flex-col gap-3 rise" style={{ "--d": "320ms" } as React.CSSProperties}>
              <span className="t-eyebrow">dev · one-click logins (local only)</span>
              <div className="flex gap-3">
                <form action={devLogin.bind(null, "owner")}>
                  <button className="btn btn-soft t-mono !py-1.5">→ owner (Noel)</button>
                </form>
                <form action={devLogin.bind(null, "client")}>
                  <button className="btn btn-soft t-mono !py-1.5">→ client (YoMap)</button>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
