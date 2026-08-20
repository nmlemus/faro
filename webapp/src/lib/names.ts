/* Human names for client-facing surfaces. Staff keeps the technical slugs;
   a client never reads "05-growth-audit.md". */

export const WORKFLOW_NAMES: Record<string, string> = {
  "website-audit": "Website audit",
  "growth-audit": "Growth audit",
  "media-plan": "Media plan",
  "campaign-build": "Campaign build",
  "optimization-loop": "Weekly optimization",
  "monthly-report": "Monthly report",
  "launch": "Launch",
  "content-engine": "Content engine",
};

export const workflowName = (id: string) =>
  WORKFLOW_NAMES[id] ?? id.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/* "05-growth-audit.md" -> "Growth audit" */
export const docName = (path: string) => {
  const base = path.replace(/^\d+[-_]/, "").replace(/\.[a-z]+$/i, "").replace(/[-_]/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/* First H1 of the deliverable, else the prettified filename */
export const docTitle = (path: string, content?: string | null) => {
  const h1 = content?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return h1 || docName(path);
};

export const isSpanish = (language?: string | null) =>
  /^(es|spanish|espa)/i.test((language ?? "").trim());
