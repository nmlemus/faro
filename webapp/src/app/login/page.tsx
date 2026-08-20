import { getLang } from "@/lib/lang-server";
import { tFor } from "@/lib/i18n";
import LoginForm from "./form";

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
            {t("The agency,")}<br />{lang === "es" ? <em>operada a la vista.</em> : <>operated <em>in the open.</em></>}
          </h1>
          <p className="t-body text-ink-2 max-w-[46ch] rise" style={{ "--d": "300ms" } as React.CSSProperties}>
            {t("Every deliverable traceable. Every number with an origin. Every decision signed by a person. That is the whole method — and you are looking at it running.")}
          </p>
        </div>
        <p className="t-mono text-ink-3 rise" style={{ "--d": "420ms" } as React.CSSProperties}>
          {t("audits, media plans, weekly optimization — run by AI, signed by people")}
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
            <div className="t-eyebrow mb-2">{t("sign in")}</div>
            <h2 className="t-h1">{t("Your account is waiting.")}</h2>
          </div>
          <LoginForm lang={lang} />
        </div>
      </section>
    </main>
  );
}
