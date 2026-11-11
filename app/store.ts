import { serializeCanvas } from "../src/canvas";
import { FolderBackend } from "./folder";
import { MemoryBackend } from "./memory";
import { ensureAccess } from "./recentFolders";
import { loadProject, type Project } from "./project";

export type Mode = "view" | "edit";

export interface StoreState {
  project: Project | null;
  // True when the server has no project open: the start screen shows.
  home: boolean;
  // Name of the project just left, for the start screen's Continue; empty when none.
  left: string;
  // True when the open project lives in the browser only (imported or new).
  memory: boolean;
  // Name of the folder on disk the open project is saved to; empty when none.
  folder: string;
  // True when the project is a static published site: nothing can be saved,
  // and there is no server to ask.
  published: boolean;
  error: string;
  mode: Mode;
  // Files changed in memory and not yet written: path -> new content.
  dirty: ReadonlyMap<string, string | Blob>;
  saving: boolean;
  saveError: string;
}

export interface Backend {
  load(): Promise<Project | null>;
  close(): Promise<void>;
  write(path: string, body: string | Blob): Promise<void>;
  remove(path: string): Promise<void>;
  // The saved bytes of a file.
  read(path: string): Promise<Uint8Array>;
}

export const httpBackend: Backend = {
  load: loadProject,
  async close() {
    const res = await fetch("api/close", { method: "POST" });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  },
  async write(path, body) {
    const res = await fetch(`api/file?path=${encodeURIComponent(path)}`, { method: "PUT", body });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  },
  async remove(path) {
    const res = await fetch(`api/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  },
  async read(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },
};

// Holds the loaded project and the unsaved changes. Steps that edit call
// setFile / setCanvas / removeFile; save() writes them all; reload() refetches.
export class ProjectStore {
  private state: StoreState = { project: null, home: false, published: false, memory: false, folder: "", left: "", error: "", mode: "view", dirty: new Map(), saving: false, saveError: "" };
  private removed = new Set<string>();
  private listeners = new Set<() => void>();

  private memoryBackend: MemoryBackend | null = null;
  private folderBackend: FolderBackend | null = null;
  private exportedRev = 0;

  constructor(private backend: Backend = httpBackend) {}

  getState = (): StoreState => this.state;

  // Editors with typing not yet handed over register here; save() asks them first.
  private flushers = new Set<() => void>();

  onBeforeSave = (fn: () => void): (() => void) => {
    this.flushers.add(fn);
    return () => this.flushers.delete(fn);
  };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<StoreState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  get writable(): boolean {
    return this.state.project?.manifest.writable === true;
  }

  get hasChanges(): boolean {
    return this.state.dirty.size > 0 || this.removed.size > 0;
  }

  async load(): Promise<void> {
    try {
      const project = await this.backend.load();
      const published = this.state.memory || this.state.folder ? this.state.published : project !== null && project.manifest.writable === false;
      this.set({ project, home: project === null, published, left: project ? "" : this.state.left, error: "" });
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Drops unsaved changes and fetches the project again.
  async reload(): Promise<void> {
    this.removed.clear();
    this.set({ dirty: new Map(), saveError: "" });
    await this.load();
  }

  // Opens files as a project kept in the browser. Nothing is written to a
  // server; the project leaves by export.
  async openMemory(name: string, files: Map<string, Uint8Array>): Promise<void> {
    this.dropMemory();
    this.memoryBackend = new MemoryBackend(name, new Map(files));
    this.backend = this.memoryBackend;
    this.exportedRev = 0;
    this.removed.clear();
    this.set({ memory: true, dirty: new Map(), mode: "view", saveError: "" });
    await this.load();
  }

  // Opens a folder on disk as the project. Saving writes to its files.
  async openFolder(folder: FolderBackend): Promise<void> {
    this.dropMemory();
    this.folderBackend = folder;
    this.backend = folder;
    this.removed.clear();
    this.set({ memory: false, folder: folder.name, dirty: new Map(), mode: "view", saveError: "" });
    await this.load();
  }

  // Shows the start screen without opening anything, for the published site.
  showStart(): void {
    this.set({ project: null, home: true, left: "", error: "" });
  }

  private dropMemory(): void {
    this.memoryBackend?.dispose();
    this.memoryBackend = null;
    this.folderBackend?.dispose();
    this.folderBackend = null;
    this.backend = httpBackend;
  }

  // True when closing the page would lose work: a browser-only project with
  // changes that were not exported, or a folder with changes not saved.
  get unexported(): boolean {
    if (this.state.folder) return this.hasChanges;
    return this.memoryBackend !== null && (this.hasChanges || (this.memoryBackend?.rev ?? 0) !== this.exportedRev);
  }

  // The current bytes of a file: unsaved edits first, then the saved file.
  async readFile(path: string): Promise<Uint8Array> {
    this.flushers.forEach((fn) => fn());
    const edit = this.state.dirty.get(path);
    if (typeof edit === "string") return new TextEncoder().encode(edit);
    if (edit) return new Uint8Array(await edit.arrayBuffer());
    return this.backend.read(path);
  }

  // Every file of the project with unsaved edits applied, for a zip.
  async allFiles(): Promise<Map<string, Uint8Array>> {
    const project = this.state.project;
    const out = new Map<string, Uint8Array>();
    if (!project) return out;
    const m = project.manifest;
    const paths = new Set([...m.canvases, ...m.notes, ...m.assets, ...(m.template ? ["template.md"] : []), ...this.state.dirty.keys()]);
    for (const path of [...paths].sort()) {
      if (this.removed.has(path)) continue;
      out.set(path, await this.readFile(path));
    }
    return out;
  }

  // Called after a download, so a browser-only project counts as exported.
  markExported(): void {
    this.exportedRev = this.memoryBackend?.rev ?? 0;
    this.set({ dirty: this.state.dirty });
  }

  // Closes the project and shows the start screen. Unsaved changes are lost,
  // so the caller asks first. A browser-only project is kept for Continue.
  async leave(): Promise<void> {
    const name = this.state.project?.manifest.name ?? "";
    if (this.state.memory || this.state.folder) this.backend = httpBackend;
    else if (!this.state.published) {
      try {
        await this.backend.close();
      } catch (e) {
        this.set({ error: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
    this.removed.clear();
    this.set({ project: null, home: true, memory: false, folder: "", left: name, mode: "view", dirty: new Map(), saveError: "", error: "" });
  }

  // True when a browser-only project or a folder was left and can be opened again.
  get parked(): boolean {
    return (this.memoryBackend !== null || this.folderBackend !== null) && !this.state.memory && !this.state.folder;
  }

  // Opens the project that was left: the browser-only one or the folder.
  async resume(): Promise<void> {
    if (this.memoryBackend) {
      this.backend = this.memoryBackend;
      this.set({ memory: true });
    } else if (this.folderBackend) {
      if (!(await ensureAccess(this.folderBackend.dir))) throw new Error("Permission to the folder was denied");
      this.backend = this.folderBackend;
      this.set({ folder: this.folderBackend.name });
    } else return;
    await this.load();
  }

  setMode(mode: Mode): void {
    if (mode === "edit" && !this.writable) return;
    this.set({ mode });
  }

  // Records new content for a file, also in the in-memory project so the
  // page shows it at once.
  setFile(path: string, content: string | Blob): void {
    const project = this.state.project;
    if (!project || !this.writable) return;
    this.removed.delete(path);
    const dirty = new Map(this.state.dirty).set(path, content);
    if (typeof content === "string" && path.endsWith(".md")) {
      // A new note under notes/ joins the manifest so the note list shows it at once.
      const listed = project.manifest.notes;
      const notes = path.startsWith("notes/") && !listed.includes(path) ? [...listed, path].sort() : listed;
      this.set({
        dirty,
        project: { ...project, manifest: { ...project.manifest, notes }, notes: { ...project.notes, [path]: content } },
      });
    } else this.set({ dirty });
  }

  setCanvas(path: string, canvas: Project["canvases"][string]): void {
    const project = this.state.project;
    if (!project || !this.writable) return;
    this.removed.delete(path);
    const dirty = new Map(this.state.dirty).set(path, serializeCanvas(canvas));
    // A new canvas joins the manifest so the canvas list shows it at once.
    const listed = project.manifest.canvases;
    const canvases = listed.includes(path) ? listed : [...listed, path].sort();
    this.set({ dirty, project: { ...project, manifest: { ...project.manifest, canvases }, canvases: { ...project.canvases, [path]: canvas } } });
  }

  // Forgets a new file that was never saved, as if it had not been made.
  discardNew(path: string): void {
    const project = this.state.project;
    if (!project || !this.state.dirty.has(path)) return;
    const dirty = new Map(this.state.dirty);
    dirty.delete(path);
    const { [path]: _gone, ...notes } = project.notes;
    const { [path]: _gone2, ...canvases } = project.canvases;
    const manifest = {
      ...project.manifest,
      notes: project.manifest.notes.filter((p) => p !== path),
      canvases: project.manifest.canvases.filter((p) => p !== path),
    };
    this.set({ dirty, project: { ...project, manifest, notes, canvases } });
  }

  removeFile(path: string): void {
    if (!this.writable) return;
    const dirty = new Map(this.state.dirty);
    dirty.delete(path);
    this.removed.add(path);
    this.set({ dirty });
  }

  // Writes every changed file, then reloads. On a failure the files not yet
  // written stay dirty and nothing is reloaded.
  async save(): Promise<boolean> {
    this.flushers.forEach((fn) => fn());
    if (this.state.saving || !this.hasChanges) return true;
    this.set({ saving: true, saveError: "" });
    try {
      for (const [path, body] of [...this.state.dirty]) {
        await this.backend.write(path, body);
        const dirty = new Map(this.state.dirty);
        dirty.delete(path);
        this.state = { ...this.state, dirty };
      }
      for (const path of [...this.removed]) {
        await this.backend.remove(path);
        this.removed.delete(path);
      }
    } catch (e) {
      this.set({ saving: false, saveError: e instanceof Error ? e.message : String(e) });
      return false;
    }
    this.set({ saving: false });
    await this.load();
    return true;
  }
}
