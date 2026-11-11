import { parseCanvas } from "../src/canvas";
import { classify, typeOf } from "../src/classify";
import { safeEntry } from "../src/zip";
import { pendingImages } from "./live/assets";
import type { Project } from "./project";
import type { Backend } from "./store";

// The few parts of the File System Access API that are used, so the code can
// be tried with a plain object tree.
export interface FileH {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: BlobPart): Promise<void>; close(): Promise<void> }>;
}
export interface DirH {
  kind: "directory";
  name: string;
  entries(): AsyncIterable<[string, FileH | DirH]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirH>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileH>;
  removeEntry(name: string): Promise<void>;
}

export const MAX_FOLDER_FILES = 5000;

// Chrome and Edge only.
export const foldersSupported = (): boolean => typeof window !== "undefined" && "showDirectoryPicker" in window;

export async function pickFolder(): Promise<DirH> {
  const pick = (window as unknown as { showDirectoryPicker(o: { mode: string }): Promise<DirH> }).showDirectoryPicker;
  return pick.call(window, { mode: "readwrite" });
}

// Names left out of a project folder: hidden files, node_modules, and the
// _site folder that `kg build` writes.
export function skipName(name: string): boolean {
  return name.startsWith(".") || name === "node_modules" || name === "_site";
}

// All file paths under a folder, relative and sorted. Throws when there are
// too many files for a project.
export async function listFiles(dir: DirH): Promise<Map<string, FileH>> {
  const out = new Map<string, FileH>();
  const walk = async (d: DirH, prefix: string): Promise<void> => {
    for await (const [name, h] of d.entries()) {
      if (skipName(name)) continue;
      if (h.kind === "directory") await walk(h, `${prefix}${name}/`);
      else {
        out.set(`${prefix}${name}`, h);
        if (out.size > MAX_FOLDER_FILES) throw new Error("This folder has too many files to be a project");
      }
    }
  };
  await walk(dir, "");
  return new Map([...out].sort(([a], [b]) => (a < b ? -1 : 1)));
}

export const emptyCanvas = (): string => JSON.stringify({ nodes: [], edges: [] }, null, "\t") + "\n";

// A project that lives in a folder on disk. Reads and writes go through the
// folder handle; media get object URLs so the page can show them.
export class FolderBackend implements Backend {
  private urls = new Map<string, string>();

  constructor(readonly dir: DirH) {}

  get name(): string {
    return this.dir.name;
  }

  // The paths in the folder, for deciding whether it already is a project.
  async scan(): Promise<string[]> {
    return [...(await listFiles(this.dir)).keys()];
  }

  private async fileAt(path: string, create = false): Promise<FileH> {
    if (!safeEntry(path)) throw new Error(`${path}: not a valid path`);
    const parts = path.split("/");
    let d = this.dir;
    for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part, { create });
    return d.getFileHandle(parts[parts.length - 1]!, { create });
  }

  private link(path: string, file: File): void {
    this.unlink(path);
    const url = URL.createObjectURL(file.type ? file : new File([file], file.name, { type: typeOf(path) }));
    this.urls.set(path, url);
    pendingImages.set(path, url);
  }

  private unlink(path: string): void {
    const url = this.urls.get(path);
    if (url === undefined) return;
    URL.revokeObjectURL(url);
    this.urls.delete(path);
    pendingImages.delete(path);
  }

  dispose(): void {
    for (const path of [...this.urls.keys()]) this.unlink(path);
  }

  async load(): Promise<Project> {
    const files = await listFiles(this.dir);
    const manifest = { ...classify(this.name, [...files.keys()]), writable: true };
    const project: Project = { manifest, canvases: {}, notes: {}, problems: [] };
    const gone = new Set(this.urls.keys());
    for (const path of manifest.assets) {
      gone.delete(path);
      this.link(path, await files.get(path)!.getFile());
    }
    for (const path of gone) this.unlink(path);
    const text = async (path: string) => (await files.get(path)!.getFile()).text();
    for (const path of manifest.canvases) {
      try {
        project.canvases[path] = parseCanvas(await text(path));
      } catch (e) {
        project.problems.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (const path of manifest.notes) project.notes[path] = await text(path);
    if (manifest.template) project.templateText = await text("template.md");
    return project;
  }

  async close(): Promise<void> {}

  async write(path: string, body: string | Blob): Promise<void> {
    const w = await (await this.fileAt(path, true)).createWritable();
    await w.write(body);
    await w.close();
  }

  async remove(path: string): Promise<void> {
    const parts = path.split("/");
    if (!safeEntry(path)) throw new Error(`${path}: not a valid path`);
    let d = this.dir;
    try {
      for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part);
      await d.removeEntry(parts[parts.length - 1]!);
    } catch (e) {
      if (e instanceof Error && e.name === "NotFoundError") return;
      throw e;
    }
  }

  async read(path: string): Promise<Uint8Array> {
    return new Uint8Array(await (await (await this.fileAt(path)).getFile()).arrayBuffer());
  }
}
