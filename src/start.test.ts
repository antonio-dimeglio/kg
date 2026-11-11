import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleProject } from "./api.ts";
import { checkOpen, createProject, listDirs } from "./projects.ts";
import { addRecent, loadRecent, MAX_RECENT } from "./recent.ts";
import type { Session } from "./session.ts";

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "kg-start-")));
const config = path.join(tmp, "config");
process.env["KG_CONFIG_DIR"] = config;
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const mk = (...parts: string[]) => {
  const p = path.join(tmp, ...parts);
  fs.mkdirSync(p, { recursive: true });
  return p;
};

describe("recent projects", () => {
  it("puts the newest first, drops duplicates, caps at 10 and drops missing folders", () => {
    const dirs = Array.from({ length: 12 }, (_, i) => mk("r", `p${i}`));
    dirs.forEach(addRecent);
    addRecent(dirs[5] as string);
    const list = loadRecent();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toBe(dirs[5]);
    expect(list.filter((p) => p === dirs[5])).toHaveLength(1);
    fs.rmSync(dirs[11] as string, { recursive: true });
    expect(loadRecent()).not.toContain(dirs[11]);
    expect(fs.existsSync(path.join(config, "recent.json"))).toBe(true);
  });
});

describe("open and new", () => {
  it("rejects missing, relative, hidden and non-folder paths", () => {
    const file = path.join(mk("o"), "f.txt");
    fs.writeFileSync(file, "x");
    for (const bad of [path.join(tmp, "nope"), "relative/dir", file, path.join(mk("o", ".hid"), "x"), ""]) {
      expect(() => checkOpen(bad), bad).toThrow();
    }
    expect(checkOpen(mk("o", "ok"))).toBe(path.join(tmp, "o", "ok"));
  });

  it("creates a project in a new or empty folder and refuses a non-empty one", () => {
    const parent = mk("n");
    const made = createProject(parent, "fresh");
    expect(fs.existsSync(path.join(made, "overview.canvas"))).toBe(true);
    expect(fs.existsSync(path.join(made, "templates"))).toBe(false);
    mk("n", "empty");
    expect(createProject(parent, "empty")).toBe(path.join(parent, "empty"));
    expect(() => createProject(parent, "fresh")).toThrow(/not empty/);
    for (const bad of ["", "a/b", "..", ".hidden"]) expect(() => createProject(parent, bad), bad).toThrow();
    expect(() => createProject(path.join(tmp, "missing"), "x")).toThrow();
  });

  it("lists non-hidden subfolders only", () => {
    const d = mk("l");
    mk("l", "b"); mk("l", "a"); mk("l", ".git");
    fs.writeFileSync(path.join(d, "file"), "x");
    expect(listDirs(d)).toEqual({ path: d, parent: tmp, dirs: ["a", "b"] });
    expect(() => listDirs(path.join(d, ".git"))).toThrow();
  });
});

describe("server without a project", () => {
  const session: Session = { root: null };
  let server: http.Server;
  let base = "";
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      void handleProject(session, req, res).then((done) => { if (!done) { res.statusCode = 404; res.end("page"); } });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => { server.close(); });

  const post = (url: string, body: unknown) =>
    fetch(base + url, { method: "POST", body: JSON.stringify(body) });

  it("reports no project, creates one, writes to it, then closes", async () => {
    expect(await (await fetch(`${base}/kg.json`)).json()).toEqual({ project: null, writable: true });
    expect((await fetch(`${base}/api/file?path=notes/a.md`, { method: "PUT", body: "x" })).status).toBe(409);
    const parent = mk("s");
    const res = await post("/api/new", { path: parent, name: "proj" });
    expect(res.status).toBe(200);
    expect(session.root).toBe(path.join(parent, "proj"));
    const manifest = await (await fetch(`${base}/kg.json`)).json() as { name: string; canvases: string[] };
    expect(manifest.name).toBe("proj");
    expect(manifest.canvases).toEqual(["overview.canvas"]);
    expect(loadRecent()[0]).toBe(session.root);
    await post("/api/close", {});
    expect(session.root).toBeNull();
  });

  it("answers 400 with a message for a bad open and keeps the session", async () => {
    const res = await post("/api/open", { path: path.join(tmp, "missing") });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/not found/i);
    expect(session.root).toBeNull();
    expect((await post("/api/open", { path: mk("s", "proj2") })).status).toBe(200);
    expect(session.root).toBe(path.join(tmp, "s", "proj2"));
  });
});
