import fs from "node:fs";
import path from "node:path";
import { classify } from "./classify.ts";

export interface Manifest {
  // Set by a server that accepts writes; a static build leaves it out.
  writable?: boolean;
  name: string;
  canvases: string[];
  notes: string[];
  // True when the project root has a template.md for new notes.
  template: boolean;
  assets: string[];
}

function walk(root: string, skip: string | undefined, dir = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (skip !== undefined && path.resolve(root, rel) === skip) continue;
    if (entry.isDirectory()) out.push(...walk(root, skip, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

// Lists the files of a kg project folder. Canvases anywhere, notes under
// notes/, template.md at the root, every other file as an asset. A folder
// given as skip (absolute) is left out.
export function buildManifest(root: string, skip?: string): Manifest {
  return classify(path.basename(path.resolve(root)), walk(root, skip));
}
