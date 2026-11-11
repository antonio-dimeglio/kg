// Note helpers: names, titles, first lines and [[links]].

export function stem(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

// Resolve a path written inside a note against the note's folder.
export function resolveRelative(notePath: string, target: string): string {
  const parts = dirname(notePath).split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

export function isExternal(target: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

export function noteTitle(path: string, md: string): string {
  const m = /^#\s+(.+?)\s*$/m.exec(md);
  return m?.[1] ?? stem(path);
}

export function firstLine(md: string): string {
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;
    return line
      .replace(/^[-*]\s+/, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, name: string, alias?: string) => alias ?? name)
      .replace(/`([^`]*)`/g, "$1")
      .trim();
  }
  return "";
}

export interface WikiLink {
  name: string;
  alias?: string;
}

// "name", "name#heading" and "name|alias" all point at the note "name".
export function parseWikiLink(inner: string): WikiLink {
  const [target = "", alias] = inner.split("|");
  const name = (target.split("#")[0] ?? "").trim();
  return alias === undefined ? { name } : { name, alias: alias.trim() };
}

export function extractLinks(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const name = parseWikiLink(m[1] ?? "").name;
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

// The note path that a [[name]] points at, or undefined.
export function resolveLink(name: string, notePaths: string[]): string | undefined {
  const wanted = name.trim().toLowerCase().replace(/\.md$/, "");
  return notePaths.find((p) => stem(p).toLowerCase() === wanted);
}

export type MediaKind = "image" | "video" | "audio" | "pdf" | "other";

const MEDIA: Record<string, MediaKind> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image", webp: "image",
  mp4: "video", webm: "video",
  mp3: "audio", wav: "audio", ogg: "audio",
  pdf: "pdf",
};

export function mediaKind(path: string): MediaKind {
  const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(path)?.[1]?.toLowerCase() ?? "";
  return MEDIA[ext] ?? "other";
}
