import { type Canvas, parseCanvas } from "../src/canvas";
import { History } from "./history";
import type { ProjectStore } from "./store";

// Applies canvas edits through the store and keeps one undo history per canvas.
export class Editor {
  private histories = new Map<string, History<Canvas>>();

  // New notes made together with a card and not saved yet, and the ones undo
  // took away (with their text, so redo can bring them back).
  private created = new Set<string>();
  private dropped = new Map<string, string>();

  constructor(private store: ProjectStore) {}

  private history(path: string): History<Canvas> {
    let h = this.histories.get(path);
    if (!h) this.histories.set(path, (h = new History<Canvas>()));
    return h;
  }

  private current(path: string): Canvas | undefined {
    return this.store.getState().project?.canvases[path];
  }

  // Runs one edit. A function that returns the same canvas changes nothing.
  edit(path: string, fn: (canvas: Canvas) => Canvas): void {
    const before = this.current(path);
    if (!before) return;
    const after = fn(before);
    if (after === before) return;
    this.history(path).record(before);
    this.store.setCanvas(path, after);
  }

  // Creates a new note file and runs the edit that adds its card, as one step.
  addNote(path: string, file: string, content: string, fn: (canvas: Canvas) => Canvas): void {
    this.store.setFile(file, content);
    this.created.add(file);
    this.dropped.delete(file);
    this.edit(path, fn);
  }

  // Creates a new empty canvas and runs the edit that adds its card, as one step.
  addSubMap(path: string, file: string, fn: (canvas: Canvas) => Canvas): void {
    this.store.setCanvas(file, { nodes: [], edges: [] });
    this.created.add(file);
    this.dropped.delete(file);
    this.edit(path, fn);
  }

  private used(file: string): boolean {
    const p = this.store.getState().project;
    return !!p && Object.values(p.canvases).some((c) => c.nodes.some((n) => n.file === file));
  }

  // After undo: a new note nothing points to and that was never saved goes away.
  private dropUnused(): void {
    const dirty = this.store.getState().dirty;
    for (const file of [...this.created]) {
      const text = dirty.get(file);
      if (typeof text !== "string") this.created.delete(file);
      else if (!this.used(file)) {
        this.dropped.set(file, text);
        this.created.delete(file);
        this.store.discardNew(file);
      }
    }
  }

  // After redo: bring back the note of a card that is back.
  private restoreDropped(): void {
    for (const [file, text] of [...this.dropped]) {
      if (!this.used(file)) continue;
      this.dropped.delete(file);
      if (file.endsWith(".canvas")) this.store.setCanvas(file, parseCanvas(text));
      else this.store.setFile(file, text);
      this.created.add(file);
    }
  }

  undo(path: string): void {
    const now = this.current(path);
    const prev = now && this.history(path).undo(now);
    if (!prev) return;
    this.store.setCanvas(path, prev);
    this.dropUnused();
  }

  redo(path: string): void {
    const now = this.current(path);
    const next = now && this.history(path).redo(now);
    if (!next) return;
    this.store.setCanvas(path, next);
    this.restoreDropped();
  }

  // Forget all history, for example after the files were loaded again.
  clear(): void {
    this.histories.clear();
    this.created.clear();
    this.dropped.clear();
  }
}
