"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabaseBrowser } from "@/lib/supabase/client";

/* n8n-style connectors: pick a tool from the method's catalog, the "?" opens
   the vendor's setup doc, credentials go straight to Vault via set_connector
   and the tool flips on. Values are write-only — nothing here reads them back. */

export type Connector = { id: string; envs: string[]; envs_hint: string; doc: string | null };

const humanTool = (id: string) =>
  id.split("-").map((w) => w === "ga4" ? "GA4" : w === "ads" ? "Ads" : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const humanEnv = (env: string) => {
  const tail = env.replace(/^[A-Z0-9]+_/, "");
  const map: Record<string, string> = {
    API_KEY: "API key", API_TOKEN: "API token", ACCESS_TOKEN: "Access token",
    API_SECRET: "API secret", SECRET_KEY: "Secret key", CUSTOMER_ID: "Customer ID",
    AD_ACCOUNT_ID: "Ad account ID", ADVERTISER_ID: "Advertiser ID",
    DEVELOPER_TOKEN: "Developer token", CLIENT_ID: "Client ID",
    CLIENT_SECRET: "Client secret", APP_ID: "App ID", SITE_ID: "Site ID",
    WRITE_KEY: "Write key", LOGIN: "Login", PASSWORD: "Password", API_URL: "API URL",
  };
  return map[tail] ?? tail.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

export default function Connectors({ clientId, catalog, tools }: {
  clientId: string; catalog: Connector[]; tools: Record<string, boolean>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Connector | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const connected = useMemo(
    () => new Set(Object.entries(tools ?? {}).filter(([, v]) => v).map(([k]) => k)), [tools]);
  const list = useMemo(() => {
    const f = catalog.filter((c) => c.id.includes(q.toLowerCase()));
    return [...f].sort((a, b) =>
      Number(connected.has(b.id)) - Number(connected.has(a.id)) || a.id.localeCompare(b.id));
  }, [catalog, q, connected]);

  function pick(c: Connector) {
    setActive(c); setShowDoc(false); setErr("");
    setVals(Object.fromEntries(c.envs.map((e) => [e, ""])));
  }

  async function save() {
    if (!active) return;
    const secrets = Object.fromEntries(
      Object.entries(vals).filter(([, v]) => v.trim() !== ""));
    if (!Object.keys(secrets).length) { setErr("fill at least one credential"); return; }
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().rpc("set_connector",
      { p_client: clientId, p_tool: active.id, p_secrets: secrets });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setActive(null); router.refresh();
  }

  async function disconnect() {
    if (!active) return;
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().rpc("unset_connector",
      { p_client: clientId, p_tool: active.id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setActive(null); router.refresh();
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="btn btn-soft t-mono !py-1.5 !px-3.5"
      style={{ border: "1px solid var(--rule)" }}>
      ⌁ connectors{connected.size
        ? ` · ${connected.size} connected`
        : " · none connected"}
    </button>
  );

  return (
    <div className="card p-6 flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <span className="t-eyebrow">connectors</span>
        <button onClick={() => { setOpen(false); setActive(null); }}
          className="t-mono text-ink-3 hover:text-ink">close ✕</button>
      </div>

      {!active && (
        <>
          <input className="field" placeholder="search the catalog…" value={q}
            onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {list.map((c) => (
              <button key={c.id} onClick={() => pick(c)}
                className={`chip ${connected.has(c.id) ? "done" : "idle"} !cursor-pointer hover:!border-[color:var(--cobalt)]`}>
                {connected.has(c.id) ? "● " : ""}{humanTool(c.id)}
              </button>
            ))}
          </div>
          <p className="t-mono text-ink-3" style={{ fontSize: ".65rem" }}>
            A tool the engine may use only exists once it is connected here — an
            unconnected tool is declared as a data hole, never guessed around.
          </p>
        </>
      )}

      {active && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="t-h2 font-[family-name:var(--font-spline-mono)]">
              {humanTool(active.id)}{connected.has(active.id) && <span className="chip done ml-3">connected</span>}
            </span>
            <div className="flex items-center gap-3">
              {active.doc && (
                <button onClick={() => setShowDoc(!showDoc)} title="setup guide"
                  className="t-mono text-cobalt-ink hover:underline underline-offset-2">
                  {showDoc ? "hide guide" : "? setup guide"}
                </button>
              )}
              <button onClick={() => setActive(null)} className="t-mono text-ink-3 hover:text-ink">← back</button>
            </div>
          </div>

          {showDoc && active.doc && (
            <div className="doc card-flat p-5 max-h-[50vh] overflow-y-auto" style={{ maxWidth: "none" }}>
              <Markdown remarkPlugins={[remarkGfm]}>{active.doc}</Markdown>
            </div>
          )}

          {active.envs.map((e) => (
            <label key={e} className="flex flex-col gap-1.5">
              <span className="t-body font-semibold">{humanEnv(e)}
                <span className="t-mono text-ink-3 ml-2 font-normal">{e}</span></span>
              <input type="password" autoComplete="off" className="field" value={vals[e] ?? ""}
                placeholder={connected.has(active.id) ? "unchanged — enter to replace" : ""}
                onChange={(ev) => setVals({ ...vals, [e]: ev.target.value })} />
            </label>
          ))}
          <p className="t-mono text-ink-3" style={{ fontSize: ".65rem" }}>{active.envs_hint.replace(/`/g, "")}</p>

          <div className="flex items-center gap-4">
            <button onClick={save} disabled={busy} className="btn btn-ink">
              {busy ? "saving…" : connected.has(active.id) ? "update credentials" : "connect"}
            </button>
            {connected.has(active.id) && (
              <button onClick={disconnect} disabled={busy} className="btn btn-danger">disconnect</button>
            )}
            {err && <span className="t-mono" style={{ color: "var(--danger)" }}>{err}</span>}
          </div>
          <p className="t-mono text-ink-3" style={{ fontSize: ".65rem" }}>
            Credentials go straight to the vault. They are never shown back, logged, or
            written into any document.
          </p>
        </div>
      )}
    </div>
  );
}
