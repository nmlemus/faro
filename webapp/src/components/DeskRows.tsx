"use client";
import { useRouter } from "next/navigation";

/* Dense account rows where the WHOLE row navigates — the hover promised it. */

export type DeskRow = {
  slug: string; name: string; website: string; state: string; stateLabel: string;
  inFlight: string; cost: number; last: string; sched: string;
};

const STATE_COLOR: Record<string, string> = {
  gate: "var(--gate)", run: "var(--cobalt-ink)", fail: "var(--danger)", quiet: "var(--ink-3)",
};

export default function DeskRows({ rows }: { rows: DeskRow[] }) {
  const router = useRouter();
  return (
    <tbody>
      {rows.map((r) => (
        <tr key={r.slug} className="desk-row cursor-pointer" tabIndex={0}
          onClick={() => router.push(`/c/${r.slug}`)}
          onKeyDown={(e) => { if (e.key === "Enter") router.push(`/c/${r.slug}`); }}>
          <td>
            <span className="t-h2">{r.name}</span>
            <span className="t-mono text-ink-3 ml-2">{r.website}</span>
          </td>
          <td className="t-mono" style={{ color: STATE_COLOR[r.state] }}>{r.stateLabel}</td>
          <td className="t-mono text-ink-2">{r.inFlight}</td>
          <td className="t-mono tnum" style={{ textAlign: "right" }}>{r.cost ? `$${r.cost.toFixed(2)}` : "—"}</td>
          <td className="t-mono text-ink-3">{r.last}</td>
          <td className="t-mono text-ink-3">{r.sched}</td>
        </tr>
      ))}
    </tbody>
  );
}
