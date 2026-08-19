import Link from "next/link";

/* Marta #4: the results layer. KPI tiles built from the metrics table —
   every tile cites the deliverable its numbers came from. */

type Row = {
  metric: string; channel: string; period: string; value: number;
  unit: string | null; source_path: string; run_id: string | null;
  created_at: string;
};

const DOWN_IS_GOOD = new Set(["cac", "cpc", "cpm", "cpa", "cpl", "churn", "bounce_rate"]);
// volume metrics with no inherent direction — a delta is information, not a verdict
const NEUTRAL = new Set(["spend", "impressions", "clicks", "sessions", "budget"]);

function fmt(v: number, unit: string | null) {
  if (unit === "usd") return "$" + v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 });
  if (unit === "%" || unit === "percent" || unit === "pct") return v.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120, h = 30, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    pad + (i * (w - 2 * pad)) / (values.length - 1),
    h - pad - ((v - min) / span) * (h - 2 * pad),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ overflow: "visible" }}>
      <polyline points={line} fill="none" stroke="var(--cobalt)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      <circle cx={ex} cy={ey} r="2.5" fill="var(--cobalt)" />
    </svg>
  );
}

export default function Results({ rows, slug }: { rows: Row[]; slug: string }) {
  // group into series by metric+channel, ordered by period (string sort works
  // within one scheme: 2026-W33 < 2026-W34, 2026-07 < 2026-08)
  // the same number may be reported by more than one deliverable (compilation
  // and final report) — one point per period, the most recent write wins
  const byPoint = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.metric}|${r.channel}|${r.period}`;
    const prev = byPoint.get(k);
    if (!prev || r.created_at > prev.created_at) byPoint.set(k, r);
  }
  const series = new Map<string, Row[]>();
  for (const r of byPoint.values()) {
    const k = `${r.metric}|${r.channel}`;
    if (!series.has(k)) series.set(k, []);
    series.get(k)!.push(r);
  }
  const tiles = [...series.entries()].map(([k, list]) => {
    const s = [...list].sort((a, b) => a.period.localeCompare(b.period));
    const last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
    const delta = prev && prev.value !== 0 ? ((last.value - prev.value) / Math.abs(prev.value)) * 100 : null;
    const good = delta === null || NEUTRAL.has(last.metric) ? null
      : DOWN_IS_GOOD.has(last.metric) ? delta < 0 : delta > 0;
    return { key: k, s, last, delta, good };
  }).sort((a, b) => a.key.localeCompare(b.key));

  if (!tiles.length) return null;

  return (
    <section className="flex flex-col gap-4 rise" style={{ "--d": "60ms" } as React.CSSProperties}>
      <div className="t-eyebrow">results</div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))" }}>
        {tiles.map(({ key, s, last, delta, good }) => (
          <div key={key} className="card-flat p-5 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="t-eyebrow">{last.metric.replace(/_/g, " ")}</span>
              {last.channel && <span className="chip idle">{last.channel}</span>}
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="t-h1" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(last.value, last.unit)}
              </span>
              {delta !== null && (
                <span className="t-mono pb-1" style={{ color: good === null ? "var(--ink-3)" : good ? "var(--ok)" : "var(--danger)" }}>
                  {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
            <Spark values={s.map((r) => r.value)} />
            <div className="t-mono text-ink-3" style={{ fontSize: ".68rem" }}>
              {last.period} ·{" "}
              {last.run_id ? (
                <Link href={`/c/${slug}/r/${last.run_id}`} className="hover:text-ink underline underline-offset-2">
                  from {last.source_path}
                </Link>
              ) : (
                <>from {last.source_path}</>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
