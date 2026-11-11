import { parseCanvas } from "../src/canvas";
import { MAX_ZIP_BYTES, packZip, unpackZip } from "../src/zip";
import { pendingImages } from "./live/assets";
import { store } from "./useStore";

function save(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const fileName = (name: string): string => name.replace(/[^A-Za-z0-9._ -]+/g, "-") || "project";

// Downloads the whole project, with unsaved edits, as a zip.
export async function exportZip(): Promise<void> {
  const name = store.getState().project?.manifest.name ?? "project";
  save(`${fileName(name)}.zip`, packZip(await store.allFiles()) as BlobPart, "application/zip");
  store.markExported();
}

// Downloads one file of the project as it is now.
export async function exportFile(path: string): Promise<void> {
  const bytes = await store.readFile(path);
  save(path.split("/").pop() ?? path, bytes as BlobPart, "application/octet-stream");
  store.markExported();
}

export async function readZipFile(file: File): Promise<{ name: string; files: Map<string, Uint8Array> }> {
  if (file.size > MAX_ZIP_BYTES) throw new Error("The zip is larger than 200 MB");
  const { files, folder } = unpackZip(new Uint8Array(await file.arrayBuffer()));
  return { name: folder ?? (file.name.replace(/\.zip$/i, "") || "Imported project"), files };
}

export async function importZipInBrowser(file: File): Promise<void> {
  const { name, files } = await readZipFile(file);
  await store.openMemory(name, files);
}

export async function newInBrowser(): Promise<void> {
  const canvas = new TextEncoder().encode(JSON.stringify({ nodes: [], edges: [] }, null, "\t") + "\n");
  await store.openMemory("New project", new Map([["overview.canvas", canvas]]));
}

// Where a single added file goes, or null when it is not accepted.
function target(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? "";
  if (!base || base.startsWith(".")) return null;
  const safe = base.replace(/[^A-Za-z0-9._ -]+/g, "-");
  if (/\.md$/i.test(safe)) return `notes/${safe}`;
  if (/\.canvas$/i.test(safe)) return safe;
  if (/\.(zip|html?|js|exe)$/i.test(safe)) return null;
  return `assets/${safe}`;
}

// Adds single .md, .canvas or media files to the open project, through the
// store. Returns a short message for what was skipped, or "".
export async function addFiles(files: File[]): Promise<string> {
  const project = store.getState().project;
  if (!project || !store.writable) return "";
  const skipped: string[] = [];
  let total = 0;
  const taken = (p: string) => store.getState().dirty.has(p) || [...project.manifest.canvases, ...project.manifest.notes, ...project.manifest.assets].includes(p);
  for (const file of files) {
    let path = target(file.name);
    total += file.size;
    if (!path || total > MAX_ZIP_BYTES) {
      skipped.push(file.name);
      continue;
    }
    const dot = path.lastIndexOf(".");
    const first = path;
    for (let i = 2; taken(path); i++) path = `${first.slice(0, dot)}-${i}${first.slice(dot)}`;
    if (path.endsWith(".md") || path.endsWith(".canvas")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (path.endsWith(".canvas")) parseCanvas(text);
      } catch {
        skipped.push(file.name);
        continue;
      }
      if (path.endsWith(".canvas")) store.setCanvas(path, parseCanvas(text));
      else store.setFile(path, text);
    } else {
      pendingImages.set(path, URL.createObjectURL(file));
      store.setFile(path, file);
    }
  }
  // A project kept in the browser has no Save step to wait for.
  if (store.getState().memory) await store.save();
  return skipped.length ? `Not added: ${skipped.join(", ")}` : "";
}
