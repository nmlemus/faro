/* App-wide internationalization.
   UI language resolution: explicit choice (faro_lang cookie, set by the
   topbar switcher) > browser Accept-Language > the client's own language
   (for client viewers) > English.
   Deliverable CONTENT language stays the client's setting — untouched here. */

export type Lang = "en" | "es";

export const resolveLang = (cookie?: string | null, accept?: string | null, clientLang?: string | null): Lang => {
  if (cookie === "es" || cookie === "en") return cookie;
  const first = (accept ?? "").split(",")[0]?.trim().toLowerCase();
  if (first.startsWith("es")) return "es";
  if (first.startsWith("en")) return "en";
  if (/^(es|spanish|espa)/i.test((clientLang ?? "").trim())) return "es";
  return "en";
};

const es: Record<string, string> = {
  // shell
  "sign out": "salir",
  // desk
  "The agency is working.": "La agencia está trabajando.",
  "All quiet on every account.": "Todo tranquilo en todas las cuentas.",
  "{n} decisions need a human.": "{n} decisiones necesitan a una persona.",
  "1 decision needs a human.": "1 decisión necesita a una persona.",
  "open gates": "aprobaciones abiertas",
  "open gates · oldest {age}": "aprobaciones abiertas · la más vieja {age}",
  "running now": "en ejecución",
  "ai cost · month to date": "costo AI · mes en curso",
  "needs a human": "necesita una persona",
  "money first, oldest first": "dinero primero, más viejas primero",
  "review →": "revisar →",
  "accounts": "cuentas",
  "needs-attention first": "urgentes primero",
  "account": "cuenta", "state": "estado", "in flight": "en curso",
  "ai cost mtd": "costo AI mes", "last deliverable": "último entregable",
  "scheduled": "programado",
  "⏸ {n} waiting on you": "⏸ {n} esperándote",
  "● working": "● trabajando",
  "✕ needs attention": "✕ necesita atención",
  "quiet": "sin actividad",
  "ai cost counts every phase finished this month. spend & margin columns arrive with recorded retainers and connected ad accounts — no number shows up here before its origin does.":
    "el costo AI cuenta cada fase terminada este mes. las columnas de inversión y margen llegarán con los retainers registrados y las cuentas de ads conectadas — aquí ningún número aparece antes que su origen.",
  "+ New client": "+ Nuevo cliente",
  // client page
  "the work": "el trabajo",
  "results": "resultados",
  "start work": "iniciar trabajo",
  "waiting for you": "esperando tu decisión",
  "working": "trabajando",
  "complete": "completo",
  "needs attention": "necesita atención",
  "queued": "en cola",
  "is waiting for a decision": "espera una decisión",
  "← all accounts": "← todas las cuentas",
  "deliverables in": "entregables en",
  "Nothing yet — start below.": "Nada todavía — empieza abajo.",
  // run page
  "the pipeline": "el proceso",
  "read": "Leer:",
  "read {file}": "leer {file}",
  "close document": "cerrar documento",
  "live activity": "actividad en vivo",
  "activity log": "registro de actividad",
  "This needs a human. That is you.": "Esto necesita a una persona. Esa persona eres tú.",
  "Approve": "Aprobar",
  "Request changes": "Pedir cambios",
  "Read": "Leer",
  "gate": "aprobación",
  "To request changes: what, concretely. Your words are folded into the redo.":
    "Para pedir cambios: qué, en concreto. Tus palabras se incorporan a la nueva versión.",
  "✓ Approved": "✓ Aprobado",
  "↺ Changes requested": "↺ Cambios pedidos",
  "by": "por",
  "Approved — signed and recorded under your name.": "Aprobado — firmado y registrado a tu nombre.",
  "Changes requested — your feedback is folded into the redo, on the record.":
    "Cambios pedidos — tu feedback se incorpora a la nueva versión, y queda registrado.",
  "export / PDF ↗": "Exportar PDF ↗",
  "Export PDF ↗": "Exportar PDF ↗",
  "run cost": "costo del run",
  "working since": "trabajando desde",
  "working for": "trabajando desde hace",
  "delete this run": "eliminar este run",
  // login
  "sign in": "iniciar sesión",
  "Your account is waiting.": "Tu cuenta te espera.",
  "Email": "Email",
  "Password": "Contraseña",
  "Sign in": "Entrar",
  "Signing in…": "Entrando…",
  "Nothing ships": "Nada se publica",
  "without your yes.": "sin tu visto bueno.",
  "What ran this week, what it cost, what came back, and what's waiting on your decision — that's what's inside.":
    "Qué corrió esta semana, qué costó, qué resultados trajo y qué espera tu decisión — eso es lo que hay adentro.",
  "your marketing, operated week by week": "tu marketing, operado semana a semana",
  "Trouble signing in? Write to your account director — they reset access.":
    "¿Problemas para entrar? Escríbele a tu director de cuenta — ellos restablecen el acceso.",
  "That email and password don't match. Check both and try again.":
    "Ese email y esa contraseña no coinciden. Revisa ambos e intenta de nuevo.",
  "Both fields are needed.": "Los dos campos son necesarios.",
  // 404
  "This page isn't here.": "Esta página no está aquí.",
  "The link may be old, or it points to something your account can't see.":
    "El enlace puede ser viejo, o apunta a algo que tu cuenta no puede ver.",
  "← Back to your account": "← Volver a tu cuenta",
  // export
  "prepared for": "preparado para",
  "Approved by": "Aprobado por",
  "Working draft — not yet approved": "Borrador de trabajo — aún sin aprobar",
  "Every number in this document carries its origin.": "Cada número de este documento lleva su origen.",
  "Print / save as PDF": "Imprimir / guardar PDF",
};

export function tFor(lang: Lang) {
  const dict = lang === "es" ? es : null;
  return (s: string, vars?: Record<string, string | number>) => {
    let out = dict?.[s] ?? s;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
    return out;
  };
}
