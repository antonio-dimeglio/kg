import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import katex from "katex";
import { isExternal, mediaKind, noteTitle, parseWikiLink, resolveRelative } from "../../src/notes";
import { renderMermaid } from "../mermaid";
import { highlightRanges } from "./hljsRanges";
import { pendingImages } from "./assets";

// What the decorations need to know about the note being edited.
export interface LiveContext {
  notePath: string;
  notes: () => Record<string, string>;
  resolveNote: (name: string) => string | undefined;
}

class MathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean) { super(); }
  eq(o: MathWidget) { return o.tex === this.tex && o.display === this.display; }
  toDOM() {
    const el = document.createElement(this.display ? "div" : "span");
    el.className = this.display ? "cm-math cm-math-display" : "cm-math";
    el.innerHTML = katex.renderToString(this.tex, { displayMode: this.display, throwOnError: false });
    return el;
  }
  ignoreEvent() { return false; }
}

class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) { super(); }
  eq(o: ImageWidget) { return o.src === this.src && o.alt === this.alt; }
  toDOM() {
    const kind = mediaKind(this.src);
    if (kind === "video" || kind === "audio") {
      const el = document.createElement(kind);
      el.src = this.src;
      el.controls = true;
      el.className = "cm-media";
      return el;
    }
    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.className = "cm-media";
    return img;
  }
  ignoreEvent() { return false; }
}

class MermaidWidget extends WidgetType {
  constructor(readonly code: string) { super(); }
  eq(o: MermaidWidget) { return o.code === this.code; }
  toDOM() {
    const el = document.createElement("div");
    el.className = "mermaid-box";
    void renderMermaid(el, this.code);
    return el;
  }
  ignoreEvent() { return false; }
}

class BulletWidget extends WidgetType {
  eq() { return true; }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-bullet";
    el.textContent = "•";
    return el;
  }
}

class WikiWidget extends WidgetType {
  constructor(readonly label: string, readonly missing: boolean) { super(); }
  eq(o: WikiWidget) { return o.label === this.label && o.missing === this.missing; }
  toDOM() {
    const el = document.createElement("span");
    el.className = this.missing ? "cm-wl missing" : "cm-wl";
    el.textContent = this.label;
    return el;
  }
  ignoreEvent() { return false; }
}

const hide = Decoration.replace({});
const mark = (cls: string) => Decoration.mark({ class: cls });
const lineDeco = (cls: string) => Decoration.line({ class: cls });

const MATH_OR_LINK = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([^\n]+?)\\\)|\$([^\s$](?:[^$\n]*?[^\s$])?)\$|\[\[([^\]\n]+)\]\]/g;

// The wiki link under document position `pos`, if any: its target name.
export function wikiLinkAt(lineText: string, offset: number): string | undefined {
  for (const m of lineText.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const from = m.index ?? 0;
    if (offset >= from && offset <= from + m[0].length) return parseWikiLink(m[1] ?? "").name;
  }
  return undefined;
}

export function build(state: EditorState, ctx: LiveContext): DecorationSet {
  const doc = state.doc;
  const out: Range<Decoration>[] = [];
  const touched = (from: number, to: number) => state.selection.ranges.some((r) => r.from <= to && r.to >= from);
  const lineTouched = (from: number, to: number) => touched(doc.lineAt(from).from, doc.lineAt(to).to);
  const codeRanges: [number, number][] = [];

  syntaxTree(state).iterate({
    enter: (ref) => {
      const { name, from, to } = ref;
      const node = ref.node;
      if (/^ATXHeading[1-6]$/.test(name)) {
        const level = name.slice(-1);
        out.push(lineDeco(`cm-h cm-h${level}`).range(doc.lineAt(from).from));
        const m = node.getChild("HeaderMark");
        if (m && !lineTouched(from, to)) out.push(hide.range(m.from, Math.min(m.to + 1, to)));
      } else if (name === "StrongEmphasis" || name === "Emphasis" || name === "Strikethrough" || name === "InlineCode") {
        const cls = name === "StrongEmphasis" ? "cm-strong" : name === "Emphasis" ? "cm-em" : name === "Strikethrough" ? "cm-strike" : "cm-code";
        if (name === "InlineCode") codeRanges.push([from, to]);
        out.push(mark(cls).range(from, to));
        if (!touched(from, to)) {
          for (const m of node.getChildren(name === "InlineCode" ? "CodeMark" : name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark")) {
            out.push(hide.range(m.from, m.to));
          }
        }
      } else if (name === "Link") {
        const marks = node.getChildren("LinkMark");
        const first = marks[0];
        const second = marks[1];
        if (first && second) {
          out.push(mark("cm-link").range(first.to, second.from));
          if (!touched(from, to) && node.getChild("URL")) {
            out.push(hide.range(first.from, first.to), hide.range(second.from, to));
          }
        }
      } else if (name === "Image") {
        const marks = node.getChildren("LinkMark");
        const url = node.getChild("URL");
        if (!touched(from, to) && marks[0] && marks[1] && url) {
          const raw = doc.sliceString(url.from, url.to);
          const path = isExternal(raw) ? raw : resolveRelative(ctx.notePath, raw);
          const src = pendingImages.get(path) ?? path;
          out.push(Decoration.replace({ widget: new ImageWidget(src, doc.sliceString(marks[0].to, marks[1].from)) }).range(from, to));
        }
        return false;
      } else if (name === "ListMark") {
        const parent = node.parent?.parent;
        if (parent?.name === "BulletList" && !lineTouched(from, to)) {
          out.push(Decoration.replace({ widget: new BulletWidget() }).range(from, to));
        } else if (parent?.name === "OrderedList") out.push(mark("cm-listnum").range(from, to));
      } else if (name === "Blockquote") {
        for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) out.push(lineDeco("cm-quote").range(doc.line(n).from));
      } else if (name === "QuoteMark") {
        if (!lineTouched(from, to)) out.push(hide.range(from, Math.min(to + 1, doc.lineAt(to).to)));
      } else if (name === "FencedCode" || name === "CodeBlock") {
        codeRanges.push([from, to]);
        const info = node.getChild("CodeInfo");
        const lang = info ? doc.sliceString(info.from, info.to).trim().split(/\s+/)[0] ?? "" : "";
        const startLine = doc.lineAt(from);
        const endLine = doc.lineAt(to);
        if (name === "FencedCode" && lang === "mermaid" && !touched(from, to)) {
          const code = node.getChild("CodeText");
          const text = code ? doc.sliceString(code.from, code.to) : "";
          out.push(Decoration.replace({ widget: new MermaidWidget(text), block: true }).range(startLine.from, endLine.to));
          return false;
        }
        for (let n = startLine.number; n <= endLine.number; n++) {
          const edge = name === "FencedCode" && (n === startLine.number || n === endLine.number);
          out.push(lineDeco(edge ? "cm-codeblock cm-fence" : "cm-codeblock").range(doc.line(n).from));
        }
        const text = node.getChild("CodeText");
        if (text && lang) {
          for (const r of highlightRanges(doc.sliceString(text.from, text.to), lang)) {
            out.push(mark(r.cls).range(text.from + r.from, text.from + r.to));
          }
        }
        return false;
      }
      return undefined;
    },
  });

  const text = doc.toString();
  for (const m of text.matchAll(MATH_OR_LINK)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    if (codeRanges.some(([a, b]) => from >= a && from < b)) continue;
    if (m[5] !== undefined) {
      const { name, alias } = parseWikiLink(m[5]);
      if (touched(from, to)) out.push(mark("cm-wl-src").range(from, to));
      else {
        const path = ctx.resolveNote(name);
        const label = alias ?? (path ? noteTitle(path, ctx.notes()[path] ?? "") : name);
        out.push(Decoration.replace({ widget: new WikiWidget(label, !path) }).range(from, to));
      }
      continue;
    }
    if (touched(from, to)) {
      out.push(mark("cm-math-src").range(from, to));
      continue;
    }
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
    const aligned = display && doc.lineAt(from).from === from && doc.lineAt(to).to === to;
    out.push(Decoration.replace({ widget: new MathWidget(tex, display), block: aligned }).range(from, to));
  }
  return Decoration.set(out, true);
}

// Live preview: markup is hidden and maths, images, wiki links and mermaid
// blocks are drawn, except where the cursor is.
export function livePreview(ctx: LiveContext): Extension {
  const field = StateField.define<DecorationSet>({
    create: (state) => build(state, ctx),
    update: (value, tr) =>
      tr.docChanged || tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState) ? build(tr.state, ctx) : value,
    provide: (f) => EditorView.decorations.from(f),
  });
  return field;
}
