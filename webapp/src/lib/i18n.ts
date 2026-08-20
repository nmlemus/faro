import { isSpanish } from "./names";

/* Chrome strings for the CLIENT portal. Staff always reads English; a client
   reads the portal in their own language. Deliverable content language is the
   client's own setting and never touched here. */

const es: Record<string, string> = {
  "the work": "el trabajo",
  "results": "resultados",
  "the pipeline": "el proceso",
  "read": "Leer:",
  "close document": "cerrar documento",
  "waiting for you": "esperando tu decisión",
  "working": "trabajando",
  "complete": "completo",
  "needs attention": "necesita atención",
  "queued": "en cola",
  "is waiting for a decision": "espera una decisión",
  "Approved by": "Aprobado por",
  "Changes requested by": "Cambios pedidos por",
  "export / PDF ↗": "Exportar PDF ↗",
  "sign out": "salir",
  "working for": "trabajando desde hace",
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
  "Approved — signed and recorded under your name.":
    "Aprobado — firmado y registrado a tu nombre.",
  "Changes requested — your feedback is folded into the redo, on the record.":
    "Cambios pedidos — tu feedback se incorpora a la nueva versión, y queda registrado.",
};

export function tFor(staffView: boolean, language?: string | null) {
  const dict = !staffView && isSpanish(language) ? es : null;
  return (s: string) => dict?.[s] ?? s;
}
