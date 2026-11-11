import { describe, expect, it } from "vitest";
import { FolderBackend, type DirH, type FileH, listFiles, skipName } from "./folder";
import { withRecent } from "./recentFolders";

// A folder tree in memory with the handle methods the code uses.
function fakeDir(name: string, tree: Record<string, string | object> = {}): DirH {
  const kids = new Map<string, FileH | DirH>();
  const dir: DirH = {
    kind: "directory",
    name,
    async *entries() {
      for (const e of kids) yield e;
    },
    async getDirectoryHandle(n, o) {
      const k = kids.get(n);
      if (k?.kind === "directory") return k;
      if (!o?.create) throw Object.assign(new Error(n), { name: "NotFoundError" });
      const d = fakeDir(n);
      kids.set(n, d);
      return d;
    },
    async getFileHandle(n, o) {
      let k = kids.get(n);
      if (!k) {
        if (!o?.create) throw Object.assign(new Error(n), { name: "NotFoundError" });
        let text = "";
        k = {
          kind: "file",
          name: n,
          getFile: async () => new File([text], n),
          createWritable: async () => ({ write: async (d: BlobPart) => { text = String(d); }, close: async () => {} }),
        };
        kids.set(n, k);
      }
      return k as FileH;
    },
    async removeEntry(n) {
      if (!kids.delete(n)) throw Object.assign(new Error(n), { name: "NotFoundError" });
    },
  };
  for (const [n, v] of Object.entries(tree)) {
    if (typeof v === "string") void dir.getFileHandle(n, { create: true }).then((f) => f.createWritable().then((w) => w.write(v)));
    else kids.set(n, fakeDir(n, v as Record<string, string>));
  }
  return dir;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("folder", () => {
  it("skips hidden files, node_modules and _site", () => {
    expect([".git", ".DS_Store", "node_modules", "_site"].every(skipName)).toBe(true);
    expect(skipName("notes")).toBe(false);
  });

  it("lists files below subfolders and leaves the skipped ones out", async () => {
    const dir = fakeDir("p", { "a.canvas": "{}", ".git": { x: "1" }, _site: { y: "1" }, notes: { "n.md": "hi", ".hidden": "x" } });
    await tick();
    expect([...(await listFiles(dir)).keys()]).toEqual(["a.canvas", "notes/n.md"]);
  });

  it("builds the project from the tree", async () => {
    const dir = fakeDir("map", {
      "overview.canvas": JSON.stringify({ nodes: [], edges: [] }),
      "template.md": "# {{title}}",
      notes: { "n.md": "hi", assets: {} },
      "pic.png": "x",
    });
    await tick();
    const p = await new FolderBackend(dir).load();
    expect(p.manifest).toMatchObject({ name: "map", canvases: ["overview.canvas"], notes: ["notes/n.md"], template: true, assets: ["pic.png"], writable: true });
    expect(p.notes["notes/n.md"]).toBe("hi");
    expect(p.templateText).toBe("# {{title}}");
  });

  it("writes into new subfolders and removes files", async () => {
    const dir = fakeDir("map", { "a.canvas": "{}", notes: { "n.md": "hi" } });
    await tick();
    const b = new FolderBackend(dir);
    await b.write("notes/assets/pic.png", "bytes");
    await b.write("notes/n.md", "changed");
    await b.remove("a.canvas");
    await b.remove("a.canvas");
    expect(await b.scan()).toEqual(["notes/assets/pic.png", "notes/n.md"]);
    expect(new TextDecoder().decode(await b.read("notes/n.md"))).toBe("changed");
    await expect(b.write("../x.md", "no")).rejects.toThrow();
  });
});

describe("recent folders", () => {
  const h = (n: string) => fakeDir(n);
  const same = async (a: DirH, b: DirH) => a.name === b.name;
  it("puts a folder first once and keeps at most 8", async () => {
    let list = await withRecent([], { name: "a", handle: h("a") }, same);
    for (const n of "bcdefghi") list = await withRecent(list, { name: n, handle: h(n) }, same);
    list = await withRecent(list, { name: "e", handle: h("e") }, same);
    expect(list.map((f) => f.name)).toEqual(["e", "i", "h", "g", "f", "d", "c", "b"]);
  });
});
