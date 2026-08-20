"use client";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";

/* EN | ES in the topbar. The choice persists in a cookie and wins over the
   browser language everywhere in the app. */

export default function LangSwitcher({ lang }: { lang: Lang }) {
  const router = useRouter();
  const set = (l: Lang) => {
    document.cookie = `faro_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <span className="t-mono text-ink-3 flex items-center gap-1.5" aria-label="language">
      {(["en", "es"] as Lang[]).map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          <button onClick={() => set(l)}
            className={l === lang ? "text-ink font-semibold" : "hover:text-ink transition-colors"}
            aria-pressed={l === lang}>
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </span>
  );
}
