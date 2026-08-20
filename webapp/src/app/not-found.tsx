import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-6" style={{ background: "var(--paper)" }}>
      <div className="flex flex-col items-start gap-5 max-w-md">
        <div className="flex items-center gap-3">
          <span className="beacon" aria-hidden />
          <span className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold">
            faro<span className="text-cobalt">.</span>
          </span>
        </div>
        <h1 className="t-display !text-[2rem]">This page isn&apos;t here.</h1>
        <p className="t-body text-ink-2">
          The link may be old, or it points to something your account can&apos;t see.
        </p>
        <Link href="/" className="btn btn-ink">← Back to your account</Link>
      </div>
    </main>
  );
}
