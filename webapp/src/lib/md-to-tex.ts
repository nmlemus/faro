/* Markdown → LaTeX for deliverable PDFs. Purpose-built for the subset our
   deliverables use: headings, emphasis, code, lists, blockquotes, links, and
   — the reason this exists — LONG TABLES, which break in html-print PDFs.
   Tables become tabularray longtblr: auto-width, multipage, repeated header. */

const ESC_MAP: Record<string, string> = {
  "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#",
  "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};
const esc = (s: string) => s.replace(/[\\&%$#_{}~^]/g, (m) => ESC_MAP[m]);
const escUrl = (u: string) => u.replace(/[\\%#&_{}]/g, (m) => "\\" + m);

function inline(md: string): string {
  // protect links and code spans before escaping
  const links: [string, string][] = [];
  const codes: string[] = [];
  let s = md
    .replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `${codes.length - 1}`; })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => { links.push([t, u]); return `${links.length - 1}`; });
  s = esc(s)
    .replace(/\*\*\*([^*]+)\*\*\*/g, "\\textbf{\\emph{$1}}")
    .replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1\\emph{$2}")
    .replace(/→/g, "$\\rightarrow$")
    .replace(/←/g, "$\\leftarrow$")
    .replace(/↓/g, "$\\downarrow$")
    .replace(/↑/g, "$\\uparrow$")
    .replace(/≥/g, "$\\geq$")
    .replace(/≤/g, "$\\leq$")
    .replace(/[✓✔]/g, "\\checkmark{}")
    .replace(/[✗✕❌]/g, "$\\times$")
    .replace(/⏸/g, "||");
  s = s.replace(/(\d+)/g, (_, i) => {
    const [t, u] = links[Number(i)];
    return `\\href{${escUrl(u)}}{${esc(t)}}`;
  });
  s = s.replace(/(\d+)/g, (_, i) => `\\texttt{${esc(codes[Number(i)]).replace(/([./-])/g, "$1\\allowbreak{}")}}`);
  return s;
}

function table(lines: string[]): string {
  const rows = lines.map((l) =>
    l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim()));
  const header = rows[0];
  const body = rows.slice(2); // row 1 is the separator
  const n = header.length;
  const cols = Array.from({ length: n }, () => "X[l,t]").join("");
  const fmt = (cells: string[]) =>
    Array.from({ length: n }, (_, i) => inline(cells[i] ?? "")).join(" & ") + " \\\\";
  return [
    `\\begin{longtblr}[label=none]{colspec={${cols}}, width=\\linewidth,`,
    `  row{1}={font=\\sffamily\\bfseries\\footnotesize, bg=paper2}, rowhead=1,`,
    `  hlines={0.4pt, rule}, vlines={0pt}, rows={rowsep=4pt}, font=\\footnotesize}`,
    fmt(header),
    ...body.map(fmt),
    `\\end{longtblr}`,
  ].join("\n");
}

function chartAsTable(src: string): string {
  const rows: string[][] = [];
  let title = "", series: string[] = [];
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const kv = line.match(/^(type|title|unit|series)\s*:\s*(.+)$/i);
    if (kv && !rows.length) {
      if (kv[1].toLowerCase() === "title") title = kv[2].trim();
      if (kv[1].toLowerCase() === "series") series = kv[2].split(",").map((s) => s.trim());
      continue;
    }
    const parts = line.split(",").map((s) => s.trim());
    if (parts.length >= 2) rows.push(parts);
  }
  if (!rows.length) return "";
  const header = ["", ...(series.length ? series : ["value"])];
  const md = [
    "| " + header.join(" | ") + " |",
    "|" + header.map(() => "---").join("|") + "|",
    ...rows.map((r) => "| " + r.join(" | ") + " |"),
  ];
  return (title ? `\\paragraph*{${inline(title)}}\n` : "") + table(md);
}

export function mdToTex(md: string): string {
  const out: string[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let i = 0;
  let firstH1 = true;

  while (i < lines.length) {
    const line = lines[i];

    // fenced blocks
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const langName = fence[1].toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      if (langName === "metrics") continue;           // data plumbing, not prose
      if (langName === "chart") { out.push(chartAsTable(buf.join("\n"))); continue; }
      out.push("\\begin{verbatim}", ...buf, "\\end{verbatim}");
      continue;
    }

    // headings
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2].replace(/\s*#+\s*$/, ""));
      if (level === 1) {
        out.push(firstH1 ? `\\docutitle{${text}}` : `\\section*{${text}}`);
        firstH1 = false;
      } else if (level === 2) out.push(`\\section*{${text}}`);
      else if (level === 3) out.push(`\\subsection*{${text}}`);
      else out.push(`\\paragraph*{${text}}`);
      i++; continue;
    }

    // table
    if (/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? "")) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) buf.push(lines[i++]);
      out.push(table(buf));
      continue;
    }

    // lists (one nesting level)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      out.push(ordered ? "\\begin{enumerate}" : "\\begin{itemize}");
      let sub = false;
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        const l = lines[i];
        const nested = /^\s{2,}([-*]|\d+\.)\s+/.test(l);
        const item = l.replace(/^\s*([-*]|\d+\.)\s+/, "");
        if (nested && !sub) { out.push("\\begin{itemize}"); sub = true; }
        if (!nested && sub) { out.push("\\end{itemize}"); sub = false; }
        if (/^\s{2,}\S/.test(l) && !nested) out[out.length - 1] += " " + inline(l.trim());
        else out.push(`\\item ${inline(item)}`);
        i++;
      }
      if (sub) out.push("\\end{itemize}");
      out.push(ordered ? "\\end{enumerate}" : "\\end{itemize}");
      continue;
    }

    // blockquote
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push("\\begin{quote}", inline(buf.join(" ")), "\\end{quote}");
      continue;
    }

    // rule
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push("\\medskip\\noindent{\\color{rule}\\hrule height 0.4pt}\\medskip");
      i++; continue;
    }

    if (line.trim() === "") { out.push(""); i++; continue; }

    // paragraph: gather until blank/structural line; promote "**Label:** …" lines
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" &&
           !/^(#{1,4}\s|```|\s*\||\s*([-*]|\d+\.)\s|\s*>)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    const para = buf.map((l, k) =>
      k > 0 && /^\*\*[^*\n]+?:\*\*/.test(l) ? "\\newline " + inline(l) : inline(l)
    ).join("\n");
    out.push(para, "");
  }
  return out.join("\n");
}

export function texDocument(opts: {
  body: string; clientName: string; approvalLine: string; originLine: string; date: string;
}): string {
  return `\\documentclass[11pt]{article}
\\usepackage{fontspec}
\\usepackage[a4paper, margin=2.6cm, top=3.4cm, bottom=3cm]{geometry}
\\usepackage{xcolor, graphicx, array, ragged2e}
\\usepackage{tabularray}
\\usepackage{fancyhdr, titlesec, parskip}
\\usepackage[hidelinks]{hyperref}
\\definecolor{cobalt}{HTML}{2743E3}
\\definecolor{ink}{HTML}{131518}
\\definecolor{ink2}{HTML}{46494E}
\\definecolor{ink3}{HTML}{5C6066}
\\definecolor{rule}{HTML}{C9C5B9}
\\definecolor{paper2}{HTML}{F2F0E9}
\\setmainfont{Charter}
\\setsansfont{Helvetica Neue}
\\setmonofont{Menlo}[Scale=0.82]
\\hypersetup{colorlinks=true, urlcolor=cobalt, linkcolor=cobalt}
\\titleformat{\\section}{\\Large\\bfseries\\color{ink}}{}{0pt}{}
\\titlespacing{\\section}{0pt}{1.6em}{0.5em}
\\titleformat{\\subsection}{\\large\\bfseries\\color{ink}}{}{0pt}{}
\\titlespacing{\\subsection}{0pt}{1.2em}{0.4em}
\\newcommand{\\docutitle}[1]{{\\huge\\bfseries #1}\\par\\vspace{0.9em}}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\headrule}{\\color{rule}\\hrule width\\headwidth height 0.4pt}
\\fancyhead[L]{{\\normalsize\\bfseries faro}{\\normalsize\\bfseries\\color{cobalt}.}}
\\fancyhead[R]{\\sffamily\\footnotesize\\color{ink3} ${esc(opts.date)} \\quad·\\quad prepared for ${esc(opts.clientName)}}
\\fancyfoot[L]{\\sffamily\\footnotesize\\color{ink3} ${esc(opts.approvalLine)}}
\\fancyfoot[R]{\\sffamily\\footnotesize\\color{ink3} \\thepage}
\\setlength{\\emergencystretch}{3em}
\\begin{document}
\\color{ink}
\\RaggedRight
${opts.body}

\\vspace{2em}
\\noindent{\\color{rule}\\hrule height 0.4pt}
\\vspace{0.6em}
\\noindent{\\sffamily\\footnotesize\\color{ink3} ${esc(opts.originLine)}}
\\end{document}
`;
}
