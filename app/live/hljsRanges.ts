import { highlightHtml } from "../markdown";

export interface CodeRange {
  from: number;
  to: number;
  cls: string;
}

const ENTITY: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'" };

// Syntax-highlight ranges (offsets into `code`) with highlight.js class names.
export function highlightRanges(code: string, lang: string): CodeRange[] {
  const html = highlightHtml(code, lang);
  if (html === null) return [];
  const out: CodeRange[] = [];
  const open: { from: number; cls: string }[] = [];
  let pos = 0;
  for (const m of html.matchAll(/<span class="([^"]+)">|<\/span>|&(?:amp|lt|gt|quot|#x27);|[^<&]+/g)) {
    const tok = m[0];
    if (m[1] !== undefined) open.push({ from: pos, cls: m[1] });
    else if (tok === "</span>") {
      const o = open.pop();
      if (o && pos > o.from) out.push({ from: o.from, to: pos, cls: o.cls });
    } else pos += (ENTITY[tok] ?? tok).length;
  }
  return out;
}
