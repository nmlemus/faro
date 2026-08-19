import Link from "next/link";

export default function Shell({ children, working = false }: {
  children: React.ReactNode; working?: boolean;
}) {
  return (
    <>
      <nav className="sticky top-0 z-10 border-b border-rule-soft"
        style={{ background: "color-mix(in srgb, var(--paper) 88%, transparent)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className={`beacon ${working ? "" : "idle"}`} aria-hidden />
            <span className="font-[family-name:var(--font-fraunces)] text-[1.15rem] font-semibold tracking-tight">
              faro<span className="text-cobalt">.</span>
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="t-mono text-ink-3 hover:text-ink transition-colors">sign out</button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
