import fs from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "./files.ts";

// Creates an empty project. Files that exist already are left alone.
// Returns the files it wrote, relative to the folder.
export function initProject(folder: string): string[] {
  const written: string[] = [];
  const put = (rel: string, content: string) => {
    const file = path.join(folder, rel);
    if (fs.existsSync(file)) return;
    writeFileAtomic(file, content);
    written.push(rel);
  };
  put("overview.canvas", JSON.stringify({ nodes: [], edges: [] }, null, "\t") + "\n");
  fs.mkdirSync(path.join(folder, "notes"), { recursive: true });
  return written;
}
