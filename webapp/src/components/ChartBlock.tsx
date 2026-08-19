/* Renders a ```chart fence from a deliverable as a native SVG — no chart
   library. Spec: header lines "key: value" (type bar|line, title, unit,
   series A, B), then CSV rows "label, v1[, v2…]". Numbers must already
   exist in the surrounding document — the chart visualizes, never invents. */

type Spec = { type: string; title?: string; unit?: string; series: string[];
              rows: { label: string; values: number[] }[] };

const PALETTE = ["var(--cobalt)", "#8A63D2", "var(--gate)", "var(--ok)", "var(--danger)"];

function parse(text: string): Spec | null {
  const spec: Spec = { type: "bar", series: [], rows: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const kv = line.match(/^(type|title|unit|series)\s*:\s*(.+)$/i);
    if (kv && !spec.rows.length) {
      const [, k, v] = kv;
      if (k.toLowerCase() === "series") spec.series = v.split(",").map((s) => s.trim());
      else (spec as unknown as Record<string, string>)[k.toLowerCase()] = v.trim();
      continue;
    }
    const parts = line.split(",").map((s) => s.trim());
    if (parts.length < 2) continue;
    const values = parts.slice(1).map((v) => parseFloat(v.replace(/[$%\s]/g, "").replace(/,/g, "")));
    if (values.some((v) => Number.isNaN(v))) continue;
    spec.rows.push({ label: parts[0], values });
  }
  return spec.rows.length ? spec : null;
}

function fmt(v: number, unit?: string) {
  const n = v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 1 });
  if (unit === "usd") return "$" + n;
  if (unit === "%" || unit === "pct") return n + "%";
  return n;
}

function Legend({ series }: { series: string[] }) {
  if (series.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: ".68rem",
                  fontFamily: "var(--font-spline-mono)", color: "var(--ink-2)" }}>
      {series.map((s, i) => (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />
          {s}
        </span>
      ))}
    </div>
  );
}

function Bars({ spec }: { spec: Spec }) {
  const max = Math.max(...spec.rows.flatMap((r) => r.values), 0) || 1;
  const bar = 16, gap = 6, groupGap = 14, labelW = 110, valueW = 74;
  const rowH = (r: Spec["rows"][0]) => r.values.length * (bar + gap) - gap;
  let y = 0;
  const groups = spec.rows.map((r) => { const g = { r, y }; y += rowH(r) + groupGap; return g; });
  const H = y - groupGap, W = 560;
  const plotW = W - labelW - valueW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }} role="img">
      {groups.map(({ r, y: gy }) => (
        <g key={r.label}>
          <text x={labelW - 10} y={gy + rowH(r) / 2 + 3.5} textAnchor="end"
            style={{ font: ".65rem var(--font-spline-mono)", fill: "var(--ink-2)" }}>{r.label}</text>
          {r.values.map((v, i) => (
            <g key={i}>
              <rect x={labelW} y={gy + i * (bar + gap)} height={bar} rx={3}
                width={Math.max((v / max) * plotW, 2)} fill={PALETTE[i % PALETTE.length]} opacity={0.9} />
              <text x={labelW + Math.max((v / max) * plotW, 2) + 8} y={gy + i * (bar + gap) + bar / 2 + 3.5}
                style={{ font: ".65rem var(--font-spline-mono)", fill: "var(--ink-3)" }}>{fmt(v, spec.unit)}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function Lines({ spec }: { spec: Spec }) {
  const W = 560, H = 220, padL = 56, padR = 16, padT = 12, padB = 28;
  const nSeries = Math.max(...spec.rows.map((r) => r.values.length));
  const all = spec.rows.flatMap((r) => r.values);
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(spec.rows.length - 1, 1);
  const yOf = (v: number) => H - padB - ((v - min) / span) * (H - padT - padB);
  const every = Math.ceil(spec.rows.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }} role="img">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={yOf(min + t * span)} y2={yOf(min + t * span)}
            stroke="var(--rule)" strokeWidth=".5" />
          <text x={padL - 8} y={yOf(min + t * span) + 3.5} textAnchor="end"
            style={{ font: ".62rem var(--font-spline-mono)", fill: "var(--ink-3)" }}>
            {fmt(min + t * span, spec.unit)}</text>
        </g>
      ))}
      {spec.rows.map((r, i) => (i % every === 0 || i === spec.rows.length - 1) && (
        <text key={r.label} x={x(i)} y={H - 8}
          textAnchor={i === spec.rows.length - 1 ? "end" : i === 0 ? "start" : "middle"}
          style={{ font: ".62rem var(--font-spline-mono)", fill: "var(--ink-3)" }}>{r.label}</text>
      ))}
      {Array.from({ length: nSeries }, (_, s) => {
        const pts = spec.rows.map((r, i) => [x(i), yOf(r.values[s] ?? r.values[0])]);
        return (
          <g key={s}>
            <polyline points={pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}
              fill="none" stroke={PALETTE[s % PALETTE.length]} strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3"
              fill={PALETTE[s % PALETTE.length]} />
          </g>
        );
      })}
    </svg>
  );
}

export default function ChartBlock({ source }: { source: string }) {
  const spec = parse(source);
  if (!spec) return <pre>{source}</pre>;
  return (
    <figure style={{ margin: "1.4rem 0", display: "flex", flexDirection: "column", gap: ".6rem" }}>
      {spec.title && (
        <figcaption style={{ fontSize: ".72rem", letterSpacing: ".08em", textTransform: "uppercase",
          fontFamily: "var(--font-spline-mono)", color: "var(--ink-2)" }}>{spec.title}</figcaption>
      )}
      <Legend series={spec.series} />
      {spec.type === "line" ? <Lines spec={spec} /> : <Bars spec={spec} />}
    </figure>
  );
}
