import { describe, expect, it } from "vitest";
import type { Project } from "./project";
import { type Backend, ProjectStore } from "./store";

function setup(writable: boolean) {
  const writes: Record<string, string | Blob> = {};
  const removed: string[] = [];
  let loads = 0;
  const backend: Backend = {
    load: async () => {
      loads++;
      return { manifest: { name: "p", canvases: [], notes: ["notes/a.md"], template: false, assets: [], writable }, canvases: {}, notes: { "notes/a.md": "old" }, problems: [] } as Project;
    },
    write: async (p, b) => { writes[p] = b; },
    remove: async (p) => { removed.push(p); },
    close: async () => {},
    read: async () => new Uint8Array(),
  };
  return { store: new ProjectStore(backend), writes, removed, loads: () => loads };
}

describe("ProjectStore", () => {
  it("ignores edits and edit mode when the project is not writable", async () => {
    const { store } = setup(false);
    await store.load();
    store.setMode("edit");
    store.setFile("notes/a.md", "new");
    expect(store.getState().mode).toBe("view");
    expect(store.hasChanges).toBe(false);
  });

  it("tracks dirty files, saves them all, then reloads", async () => {
    const { store, writes, removed, loads } = setup(true);
    await store.load();
    store.setFile("notes/a.md", "v1");
    store.setFile("notes/a.md", "v2");
    store.setFile("notes/b.md", "b");
    store.removeFile("notes/c.md");
    expect(store.getState().dirty.size).toBe(2);
    expect(store.getState().project?.notes["notes/a.md"]).toBe("v2");
    expect(await store.save()).toBe(true);
    expect(writes).toEqual({ "notes/a.md": "v2", "notes/b.md": "b" });
    expect(removed).toEqual(["notes/c.md"]);
    expect(store.hasChanges).toBe(false);
    expect(loads()).toBe(2);
  });

  it("keeps unwritten files dirty when a write fails", async () => {
    const { store } = setup(true);
    await store.load();
    store.setFile("notes/a.md", "x");
    store.setFile("notes/b.md", "y");
    let n = 0;
    (store as unknown as { backend: Backend }).backend.write = async () => { if (n++ === 1) throw new Error("boom"); };
    expect(await store.save()).toBe(false);
    expect([...store.getState().dirty.keys()]).toEqual(["notes/b.md"]);
    expect(store.getState().saveError).toBe("boom");
  });

  it("reload drops unsaved changes", async () => {
    const { store } = setup(true);
    await store.load();
    store.setFile("notes/a.md", "x");
    await store.reload();
    expect(store.hasChanges).toBe(false);
    expect(store.getState().project?.notes["notes/a.md"]).toBe("old");
  });

  it("lists a new note in the manifest at once", async () => {
    const { store } = setup(true);
    await store.load();
    store.setFile("notes/b.md", "# B");
    store.setFile("notes/b.md", "# B2");
    expect(store.getState().project?.manifest.notes).toEqual(["notes/a.md", "notes/b.md"]);
  });

  it("leaves to the start screen and forgets unsaved changes", async () => {
    const { store } = setup(true);
    await store.load();
    store.setFile("notes/a.md", "x");
    await store.leave();
    expect(store.getState()).toMatchObject({ project: null, home: true, mode: "view" });
    expect(store.hasChanges).toBe(false);
  });
});
