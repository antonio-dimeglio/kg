import { describe, expect, it } from "vitest";
import type { Canvas } from "../src/canvas";
import { addNode } from "./canvasEdit";
import { Editor } from "./editor";
import type { Project } from "./project";
import { type Backend, ProjectStore } from "./store";

async function setup() {
  const backend: Backend = {
    load: async () => ({
      manifest: { name: "p", canvases: ["c.canvas"], notes: [], template: false, assets: [], writable: true },
      canvases: { "c.canvas": { nodes: [], edges: [] } },
      notes: {},
      problems: [],
    }) as Project,
    read: async () => new Uint8Array(),
    write: async () => {},
    remove: async () => {},
    close: async () => {},
  };
  const store = new ProjectStore(backend);
  await store.load();
  return { store, editor: new Editor(store) };
}

const addNote = (editor: Editor, file: string) =>
  editor.addNote("c.canvas", file, "# New", (c: Canvas) => addNode(c, { type: "file", file }, 0, 0, true).canvas);

describe("undo of add note", () => {
  it("drops the unsaved new note, and redo brings it back", async () => {
    const { store, editor } = await setup();
    addNote(editor, "notes/new.md");
    expect([...store.getState().dirty.keys()]).toContain("notes/new.md");
    editor.undo("c.canvas");
    expect(store.getState().project?.canvases["c.canvas"]?.nodes).toHaveLength(0);
    expect(store.getState().dirty.has("notes/new.md")).toBe(false);
    expect(store.getState().project?.manifest.notes).toEqual([]);
    editor.redo("c.canvas");
    expect(store.getState().dirty.get("notes/new.md")).toBe("# New");
    expect(store.getState().project?.manifest.notes).toEqual(["notes/new.md"]);
  });

  it("keeps a note that was saved before the undo", async () => {
    const { store, editor } = await setup();
    addNote(editor, "notes/new.md");
    await store.save();
    editor.undo("c.canvas");
    expect(store.getState().project?.canvases["c.canvas"]?.nodes).toHaveLength(0);
    expect(store.getState().dirty.has("notes/new.md")).toBe(false);
  });
});

describe("undo of add sub-map", () => {
  const addMap = (editor: Editor, file: string) =>
    editor.addSubMap("c.canvas", file, (c: Canvas) => addNode(c, { type: "file", file }, 0, 0, true).canvas);

  it("lists the new canvas at once, drops it on undo and brings it back on redo", async () => {
    const { store, editor } = await setup();
    addMap(editor, "sub.canvas");
    const p = () => store.getState().project;
    expect(p()?.manifest.canvases).toEqual(["c.canvas", "sub.canvas"]);
    expect(p()?.canvases["sub.canvas"]).toEqual({ nodes: [], edges: [] });
    expect(store.getState().dirty.has("sub.canvas")).toBe(true);
    editor.undo("c.canvas");
    expect(p()?.manifest.canvases).toEqual(["c.canvas"]);
    expect(p()?.canvases["sub.canvas"]).toBeUndefined();
    expect(store.getState().dirty.has("sub.canvas")).toBe(false);
    editor.redo("c.canvas");
    expect(p()?.manifest.canvases).toEqual(["c.canvas", "sub.canvas"]);
    expect(store.getState().dirty.has("sub.canvas")).toBe(true);
  });
});
