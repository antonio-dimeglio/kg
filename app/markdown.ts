import { katex } from "@mdit/plugin-katex";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import MarkdownIt from "markdown-it";
import { mediaSrc } from "./live/assets";
import { isExternal, mediaKind, parseWikiLink, resolveLink, resolveRelative, noteTitle } from "../src/notes";

export interface RenderEnv extends Record<string, unknown> {
  notePath: string;
  notes: Record<string, string>;
}

const languages = { bash, c, cpp, javascript, json, python, typescript, yaml };
for (const [name, def] of Object.entries(languages)) hljs.registerLanguage(name, def);

// Unknown languages (and mermaid) stay plain; markdown-it escapes them.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight: (code, lang) => {
    if (!lang || !hljs.getLanguage(lang)) return "";
    return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
  },
});

// $..$, $$..$$, \(..\) and \[..\]; code stays literal.
md.use(katex, { delimiters: "all", throwOnError: false });

// [[name]] and [[name|alias]]
md.inline.ruler.before("link", "wikilink", (state, silent) => {
  const { src, pos } = state;
  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false;
  const end = src.indexOf("]]", pos + 2);
  if (end < 0) return false;
  const inner = src.slice(pos + 2, end);
  if (!inner || inner.includes("\n")) return false;
  if (!silent) state.push("wikilink", "", 0).content = inner;
  state.pos = end + 2;
  return true;
});

md.renderer.rules["wikilink"] = (tokens, i, _options, rawEnv) => {
  const env = rawEnv as unknown as RenderEnv;
  const { name, alias } = parseWikiLink(tokens[i]?.content ?? "");
  const path = resolveLink(name, Object.keys(env.notes));
  const label = alias ?? (path ? noteTitle(path, env.notes[path] ?? "") : name);
  const cls = path ? "wl" : "wl missing";
  return `<a class="${cls}" href="#" data-note="${md.utils.escapeHtml(path ?? "")}">${md.utils.escapeHtml(label)}</a>`;
};

// ![alt](path): images, and video or audio files written as images.
md.renderer.rules["image"] = (tokens, i, _options, rawEnv) => {
  const env = rawEnv as unknown as RenderEnv;
  const token = tokens[i];
  if (!token) return "";
  const raw = String(token.attrGet("src") ?? "");
  const src = md.utils.escapeHtml(isExternal(raw) ? raw : mediaSrc(resolveRelative(env.notePath, raw)));
  const alt = md.utils.escapeHtml(token.content);
  const kind = mediaKind(raw);
  if (kind === "video") return `<video controls src="${src}"></video>`;
  if (kind === "audio") return `<audio controls src="${src}"></audio>`;
  return `<img src="${src}" alt="${alt}">`;
};

// Highlighted HTML for a code block, or null when the language is unknown.
export function highlightHtml(code: string, lang: string): string | null {
  if (!lang || !hljs.getLanguage(lang)) return null;
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}

export function renderMarkdown(text: string, env: RenderEnv): string {
  return md.render(text, env as unknown as Record<string, unknown>);
}
