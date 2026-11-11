import { dirname } from "../../src/notes";

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
};

const pad = (n: number) => String(n).padStart(2, "0");

// Name for a pasted screenshot: pasted-20261111-142530.png
export function pastedName(date: Date, ext = "png"): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `pasted-${day}-${time}.${ext}`;
}

// A file name for a pasted or dropped image. Generic names (image.png, or none)
// become pasted-<time>.<ext>; other names are kept but made safe.
export function imageName(file: { name: string; type: string }, now: Date): string {
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? EXT[file.type] ?? "png").toLowerCase();
  const base = file.name.replace(/\.[^.]*$/, "");
  if (!base || /^image$/i.test(base)) return pastedName(now, ext);
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "");
  return `${safe || "image"}.${ext}`;
}

// Where an image goes: assets/ next to the note, with -2, -3 ... added when
// the name is taken. Returns the project path and the link written in the note.
export function assetTarget(notePath: string, name: string, taken: (path: string) => boolean): { path: string; link: string } {
  const dot = name.lastIndexOf(".");
  const stem = dot < 0 ? name : name.slice(0, dot);
  const ext = dot < 0 ? "" : name.slice(dot);
  const dir = dirname(notePath);
  const at = (file: string) => (dir ? `${dir}/assets/${file}` : `assets/${file}`);
  let file = name;
  for (let i = 2; taken(at(file)); i++) file = `${stem}-${i}${ext}`;
  return { path: at(file), link: `![](assets/${file})` };
}

// Images added in the editor and not saved yet: project path -> object URL.
export const pendingImages = new Map<string, string>();

// The address to show a project file at: its object URL when the file is not
// on the server (added in the editor, or in a project kept in the browser).
export const mediaSrc = (path: string): string => pendingImages.get(path) ?? path;
