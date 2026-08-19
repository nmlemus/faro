/* Deliverables arrive with soft line breaks that carry meaning: a new
   "**Label:** value" field on its own line. CommonMark collapses those into
   one paragraph, so we promote ONLY those breaks to hard breaks — prose that
   was merely hard-wrapped by the model still reflows normally. */
export function prepDoc(md: string): string {
  return md
    .split(/(```[\s\S]*?```)/)
    .map((seg, i) =>
      i % 2 === 1 ? seg : seg.replace(/(?<!\n)\n(?=\*\*[^*\n]+?:\*\*)/g, "  \n")
    )
    .join("");
}
