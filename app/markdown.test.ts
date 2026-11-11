import { expect, it } from "vitest";
import { renderMarkdown } from "./markdown.ts";

const env = { notePath: "notes/a.md", notes: { "notes/types.md": "# Types" } };

it("renders maths, and keeps $ in code literal", () => {
  const html = renderMarkdown("Inline $x^2$ and\n\n$$y = 1$$\n\nCode `cost $5 and $6` here.\n\n```\n$a$\n```\n", env);
  expect(html.match(/class="katex"/g)?.length).toBe(2);
  expect(html).toContain("<code>cost $5 and $6</code>");
  expect(html).toContain("<code>$a$\n</code>");
});

it("turns [[links]] and note-relative images into resolved elements", () => {
  const html = renderMarkdown("[[types]] ![p](assets/p.png) ![v](assets/v.mp4)", env);
  expect(html).toContain('data-note="notes/types.md"');
  expect(html).toContain('<img src="notes/assets/p.png"');
  expect(html).toContain('<video controls src="notes/assets/v.mp4">');
});

it("renders \\( \\) and \\[ \\] maths", () => {
  const html = renderMarkdown("A \\(x^2\\) b\n\n\\[y = 1\\]\n", env);
  expect(html.match(/class="katex"/g)?.length).toBe(2);
});

it("highlights known languages and leaves others plain", () => {
  const py = renderMarkdown("```python\ndef f(): return 1\n```\n", env);
  expect(py).toContain("hljs-keyword");
  const mm = renderMarkdown("```mermaid\ngraph TD; A-->B\n```\n", env);
  expect(mm).not.toContain("hljs");
  expect(mm).toContain("A--&gt;B");
});

it("highlights C and C++ under their usual names", () => {
  for (const lang of ["c", "h", "cpp", "c++", "cxx", "hpp"]) {
    expect(renderMarkdown("```" + lang + "\nint main() { return 0; }\n```\n", env), lang).toContain("hljs-keyword");
  }
});
