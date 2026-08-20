import type { Lang } from "./i18n";

/* Human names for client-facing surfaces, per language. Staff surfaces keep
   the technical slugs alongside; a client never reads "05-growth-audit.md". */

const WORKFLOWS: Record<string, { en: string; es: string }> = {
  "website-audit":     { en: "Website audit",       es: "Auditoría del sitio" },
  "growth-audit":      { en: "Growth audit",        es: "Auditoría de crecimiento" },
  "media-plan":        { en: "Media plan",          es: "Plan de medios" },
  "campaign-build":    { en: "Campaign build",      es: "Construcción de campaña" },
  "optimization-loop": { en: "Weekly optimization", es: "Optimización semanal" },
  "monthly-report":    { en: "Monthly report",      es: "Informe mensual" },
  "launch":            { en: "Launch",              es: "Lanzamiento" },
  "content-engine":    { en: "Content engine",      es: "Motor de contenido" },
};

/* document/phase base names (from filenames like 04-diagnosis.md and phase ids) */
const DOCS: Record<string, { en: string; es: string }> = {
  "intake":               { en: "Intake",               es: "Brief" },
  "measurement":          { en: "Measurement",          es: "Medición" },
  "measurements":         { en: "Measurements",         es: "Mediciones" },
  "measurement contract": { en: "Measurement contract", es: "Contrato de medición" },
  "landscape":            { en: "Landscape",            es: "Panorama competitivo" },
  "diagnosis":            { en: "Diagnosis",            es: "Diagnóstico" },
  "recommendations":      { en: "Recommendations",      es: "Recomendaciones" },
  "growth audit":         { en: "Growth audit",         es: "Auditoría de crecimiento" },
  "website audit":        { en: "Website audit",        es: "Auditoría del sitio" },
  "objectives":           { en: "Objectives",           es: "Objetivos" },
  "plan":                 { en: "Plan",                 es: "Plan" },
  "media plan":           { en: "Media plan",           es: "Plan de medios" },
  "compilation":          { en: "Compilation",          es: "Compilación" },
  "monthly report":       { en: "Monthly report",       es: "Informe mensual" },
  "performance":          { en: "Performance",          es: "Desempeño" },
  "execution":            { en: "Execution",            es: "Ejecución" },
  "positioning":          { en: "Positioning",          es: "Posicionamiento" },
  "conversion":           { en: "Conversion",           es: "Conversión" },
  "discoverability":      { en: "Discoverability",      es: "Descubribilidad" },
  "capture":              { en: "Capture",              es: "Captura" },
  "report":               { en: "Report",               es: "Informe" },
  "offer":                { en: "Offer",                es: "Oferta" },
  "assets":               { en: "Assets",               es: "Piezas" },
  "review":               { en: "Review",               es: "Revisión" },
  "structure":            { en: "Structure",            es: "Estructura" },
  "ads":                  { en: "Ads",                  es: "Anuncios" },
  "landing":              { en: "Landing",              es: "Landing" },
  "tracking":             { en: "Tracking",             es: "Tracking" },
  "launch pack":          { en: "Launch pack",          es: "Paquete de lanzamiento" },
  "calendar":             { en: "Calendar",             es: "Calendario" },
  "scorecard":            { en: "Scorecard",            es: "Tablero de resultados" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const workflowName = (id: string, lang: Lang = "en") =>
  WORKFLOWS[id]?.[lang] ?? cap(id.replace(/-/g, " "));

/* "05-growth-audit.md" -> "Auditoría de crecimiento" */
export const docName = (path: string, lang: Lang = "en") => {
  const base = path.replace(/^\d+[-_]/, "").replace(/\.[a-z]+$/i, "")
    .replace(/[-_]/g, " ").toLowerCase().trim();
  return DOCS[base]?.[lang] ?? cap(base);
};

/* phase ids ("diagnosis", "measurement") share the same vocabulary */
export const phaseName = (id: string, lang: Lang = "en") => {
  const base = id.replace(/[-_]/g, " ").toLowerCase().trim();
  return DOCS[base]?.[lang] ?? cap(base);
};

/* First H1 of the deliverable, else the prettified filename */
export const docTitle = (path: string, content?: string | null, lang: Lang = "en") => {
  const h1 = content?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return h1 || docName(path, lang);
};

export const isSpanish = (language?: string | null) =>
  /^(es|spanish|espa)/i.test((language ?? "").trim());
