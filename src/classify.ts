import type { Manifest } from "./manifest.ts";

// Media types by extension, for serving files and for in-browser blobs.
export const TYPES: Record<string, string> = {
  ".canvas": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
};

export function typeOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return (dot < 0 ? undefined : TYPES[path.slice(dot).toLowerCase()]) ?? "application/octet-stream";
}

// Sorts project-relative file paths into a manifest. Canvases anywhere, notes
// under notes/, template.md at the root, every other non-Markdown file as an
// asset. No file system needed, so the page can use it too.
export function classify(name: string, files: string[]): Manifest {
  const manifest: Manifest = { name, canvases: [], notes: [], template: false, assets: [] };
  for (const file of [...files].sort()) {
    if (file === "kg.json") continue;
    if (file.endsWith(".canvas")) manifest.canvases.push(file);
    else if (file.endsWith(".md") && file.startsWith("notes/")) manifest.notes.push(file);
    else if (file === "template.md") manifest.template = true;
    else if (!file.endsWith(".md")) manifest.assets.push(file);
  }
  return manifest;
}
