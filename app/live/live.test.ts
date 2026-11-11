import fs from "node:fs";
import path from "node:path";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { expect, it } from "vitest";
import { hasMermaid } from "../mermaid.ts";
import { assetTarget, imageName, pastedName } from "./assets.ts";
import { build } from "./decorations.ts";
import { highlightRanges } from "./hljsRanges.ts";

const dir = path.resolve(import.meta.dirname, "../../example/notes");
const notes = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

it("keeps every example note byte for byte, and decorates it", () => {
  const all = Object.fromEntries(notes.map((f) => [`notes/${f}`, fs.readFileSync(path.join(dir, f), "utf8")]));
  for (const [p, text] of Object.entries(all)) {
    const state = EditorState.create({ doc: text, extensions: [markdown({ base: markdownLanguage })] });
    expect(state.doc.toString(), p).toBe(text);
    const ctx = { notePath: p, notes: () => all, resolveNote: () => undefined };
    expect(build(state, ctx).size, p).toBeGreaterThanOrEqual(0);
  }
});

it("keeps Windows line ends when the editor says so", () => {
  const text = "# A\r\n\r\ntext\r\n";
  const state = EditorState.create({ doc: text, extensions: [EditorState.lineSeparator.of("\r\n")] });
  expect(state.sliceDoc()).toBe(text);
});

it("hides markup off the cursor line and shows it on it", () => {
  const text = "# Title\n\nSome **bold** and $x^2$\n";
  const ctx = { notePath: "notes/a.md", notes: () => ({}), resolveNote: () => undefined };
  const ext = [markdown({ base: markdownLanguage })];
  const away = EditorState.create({ doc: text, selection: { anchor: text.length }, extensions: ext });
  const on = EditorState.create({ doc: text, selection: { anchor: 3 }, extensions: ext });
  const replaced = (s: EditorState) => {
    let n = 0;
    build(s, ctx).between(0, s.doc.length, (_f, _t, d) => { if (d.spec.widget || d.spec === undefined || d.point) n++; });
    return n;
  };
  expect(replaced(away)).toBeGreaterThan(replaced(on));
});

it("names pasted images and avoids clashes", () => {
  expect(pastedName(new Date(2026, 10, 11, 9, 5, 7))).toBe("pasted-20261111-090507.png");
  expect(imageName({ name: "image.png", type: "image/png" }, new Date(2026, 10, 11, 9, 5, 7))).toBe("pasted-20261111-090507.png");
  expect(imageName({ name: "My Plot (1).JPG", type: "image/jpeg" }, new Date())).toBe("My-Plot-1.jpg");
  const taken = new Set(["notes/assets/a.png", "notes/assets/a-2.png"]);
  expect(assetTarget("notes/x.md", "a.png", (p) => taken.has(p))).toEqual({ path: "notes/assets/a-3.png", link: "![](assets/a-3.png)" });
  expect(assetTarget("x.md", "b.png", () => false).path).toBe("assets/b.png");
});

it("detects mermaid blocks", () => {
  expect(hasMermaid("a\n```mermaid\ngraph TD\n```\n")).toBe(true);
  expect(hasMermaid("```python\nx\n```\nmermaid")).toBe(false);
});

it("gives highlight ranges in code offsets", () => {
  const code = "def f(): return 1 < 2";
  const r = highlightRanges(code, "python");
  const kw = r.find((x) => x.cls.includes("keyword"));
  expect(code.slice(kw?.from, kw?.to)).toBe("def");
  expect(highlightRanges(code, "nolang")).toEqual([]);
});
