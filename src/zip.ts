import { strFromU8, unzipSync, zipSync } from "fflate";
import { parseCanvas } from "./canvas.ts";

export const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export type Files = Map<string, Uint8Array>;

export interface Unpacked {
  files: Files;
  // Name of the single top folder that was unwrapped, if any.
  folder: string | null;
  // Entries that were left out, with no detail needed beyond the path.
  skipped: string[];
}

// True for a path a project may hold: relative, no .. or empty parts, nothing
// hidden, no __MACOSX or node_modules.
export function safeEntry(path: string): boolean {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/")) return false;
  return !path.split("/").some((p) => p === "" || p === "." || p === ".." || p.startsWith(".") || p === "__MACOSX" || p === "node_modules");
}

function isText(data: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

// Reads a zip into project files. Unsafe, hidden and junk entries are skipped,
// .md and .canvas entries must be valid text (a canvas also valid JSON Canvas),
// and one top folder holding everything is unwrapped. Throws an Error with a
// short message when the zip is too big, unreadable or holds no canvas or note.
export function unpackZip(data: Uint8Array): Unpacked {
  if (data.length > MAX_ZIP_BYTES) throw new Error("The zip is larger than 200 MB");
  const skipped: string[] = [];
  let total = 0;
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(data, {
      filter: (f) => {
        if (f.name.endsWith("/")) return false;
        if (!safeEntry(f.name)) {
          skipped.push(f.name);
          return false;
        }
        total += f.originalSize;
        if (total > MAX_ZIP_BYTES) throw new Error("The zip is larger than 200 MB");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("The zip")) throw e;
    throw new Error("This is not a readable zip file");
  }
  let files: Files = new Map();
  for (const [name, bytes] of Object.entries(raw)) {
    let ok = true;
    if (name.endsWith(".md")) ok = isText(bytes);
    else if (name.endsWith(".canvas")) {
      try {
        parseCanvas(strFromU8(bytes));
      } catch {
        ok = false;
      }
    }
    if (ok) files.set(name, bytes);
    else skipped.push(name);
  }
  let folder: string | null = null;
  const tops = new Set([...files.keys()].map((n) => n.split("/")[0]));
  if (tops.size === 1 && [...files.keys()].every((n) => n.includes("/"))) {
    folder = [...tops][0] ?? null;
    const cut = (folder?.length ?? 0) + 1;
    files = new Map([...files].map(([n, b]) => [n.slice(cut), b]));
  }
  if (![...files.keys()].some((n) => n.endsWith(".canvas") || n.startsWith("notes/"))) {
    throw new Error("No canvas or note found in this zip");
  }
  return { files, folder, skipped };
}

// Packs project files into a zip.
export function packZip(files: Files): Uint8Array {
  return zipSync(Object.fromEntries(files));
}
