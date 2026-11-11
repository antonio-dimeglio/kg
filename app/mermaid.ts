// Mermaid diagrams. The library is large, so it is loaded only when a note
// has a mermaid block.

import { THEME_EVENT } from "./theme";

export function hasMermaid(md: string): boolean {
  return /^[ \t]*(`{3,}|~{3,})[ \t]*mermaid\b/m.test(md);
}

// Mermaid takes plain colour values, so they are read from the palette.
function themeVariables(): Record<string, string | boolean> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    darkMode: document.documentElement.dataset["mode"] === "dark",
    background: v("--panel"),
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Inter, sans-serif",
    primaryColor: v("--g1"),
    primaryBorderColor: v("--b1"),
    primaryTextColor: v("--text"),
    secondaryColor: v("--g2"),
    secondaryBorderColor: v("--b2"),
    secondaryTextColor: v("--text"),
    tertiaryColor: v("--g3"),
    tertiaryBorderColor: v("--b3"),
    tertiaryTextColor: v("--text"),
    textColor: v("--text"),
    lineColor: v("--edge"),
    noteBkgColor: v("--g5"),
    noteBorderColor: v("--b5"),
    noteTextColor: v("--text"),
    edgeLabelBackground: v("--panel"),
    clusterBkg: v("--g4"),
    clusterBorder: v("--b4"),
    titleColor: v("--text"),
    nodeBorder: v("--b1"),
    mainBkg: v("--g1"),
  };
}

let queue: Promise<unknown> = Promise.resolve();
let counter = 0;
const drawn = new Set<{ el: HTMLElement; code: string }>();

function draw(el: HTMLElement, code: string): Promise<void> {
  const job = queue.then(async () => {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: themeVariables() });
    const id = `kg-mermaid-${counter++}`;
    try {
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.classList.remove("mermaid-error");
    } catch (e) {
      document.getElementById(`d${id}`)?.remove();
      el.textContent = e instanceof Error ? (e.message.split("\n")[0] ?? "Diagram error") : "Diagram error";
      el.classList.add("mermaid-error");
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

// Draws `code` into `el`. Calls run one after another. The diagram is drawn
// again when the palette changes.
export function renderMermaid(el: HTMLElement, code: string): Promise<void> {
  redrawOnTheme();
  drawn.add({ el, code });
  return draw(el, code);
}

let listening = false;
function redrawOnTheme(): void {
  if (listening) return;
  listening = true;
  window.addEventListener(THEME_EVENT, () => {
    for (const item of drawn) {
      if (item.el.isConnected) void draw(item.el, item.code);
      else drawn.delete(item);
    }
  });
}

// Replaces the mermaid code blocks inside rendered Markdown by diagrams.
export function drawMermaidIn(root: HTMLElement): void {
  for (const code of root.querySelectorAll<HTMLElement>("pre > code.language-mermaid")) {
    const pre = code.parentElement;
    if (!pre) continue;
    const box = document.createElement("div");
    box.className = "mermaid-box";
    pre.replaceWith(box);
    void renderMermaid(box, code.textContent ?? "");
  }
}
