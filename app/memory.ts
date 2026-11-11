import { strFromU8, strToU8 } from "fflate";
import { parseCanvas } from "../src/canvas";
import { classify, typeOf } from "../src/classify";
import { pendingImages } from "./live/assets";
import type { Project } from "./project";
import type { Backend } from "./store";

type Content = Uint8Array;

// A project kept in the page only. Files are bytes; media get object URLs so
// the page can show them.
export class MemoryBackend implements Backend {
  private urls = new Map<string, string>();
  // Counts writes and removals, so the page can tell whether the project
  // changed since it was last exported.
  rev = 0;

  constructor(private name: string, private files: Map<string, Content>) {
    for (const [path, bytes] of files) this.link(path, bytes);
  }

  private link(path: string, bytes: Content): void {
    this.unlink(path);
    if (/\.(md|canvas)$/.test(path)) return;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: typeOf(path) }));
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

  // Frees the object URLs when the project is left.
  dispose(): void {
    for (const path of [...this.urls.keys()]) this.unlink(path);
  }

  async load(): Promise<Project> {
    const manifest = { ...classify(this.name, [...this.files.keys()]), writable: true };
    const project: Project = { manifest, canvases: {}, notes: {}, problems: [] };
    for (const path of manifest.canvases) {
      try {
        project.canvases[path] = parseCanvas(strFromU8(this.files.get(path)!));
      } catch (e) {
        project.problems.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (const path of manifest.notes) project.notes[path] = strFromU8(this.files.get(path)!);
    const template = this.files.get("template.md");
    if (template) project.templateText = strFromU8(template);
    return project;
  }

  async close(): Promise<void> {}

  async write(path: string, body: string | Blob): Promise<void> {
    const bytes = typeof body === "string" ? strToU8(body) : new Uint8Array(await body.arrayBuffer());
    this.files.set(path, bytes);
    this.link(path, bytes);
    this.rev++;
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.unlink(path);
    this.rev++;
  }

  async read(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(path);
    if (!bytes) throw new Error(`${path}: not found`);
    return bytes;
  }
}
