import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { buildSite } from "./build.ts";

function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "kg-build-"));
  const put = (f: string, text = "x") => {
    fs.mkdirSync(path.dirname(path.join(base, f)), { recursive: true });
    fs.writeFileSync(path.join(base, f), text);
  };
  put("dist/index.html", "<html>");
  put("dist/_kg/app.js");
  put("proj/a.canvas", JSON.stringify({ nodes: [{ id: "1", type: "file", file: "../secret.md", x: 0, y: 0, width: 1, height: 1 }], edges: [] }));
  put("proj/notes/n.md");
  put("proj/notes/assets/p.png");
  put("secret.md", "secret");
  return { base, proj: path.join(base, "proj"), dist: path.join(base, "dist") };
}

it("writes the page, the project files and a read-only kg.json", () => {
  const { base, proj, dist } = setup();
  const out = path.join(base, "out");
  buildSite(proj, dist, out);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "kg.json"), "utf8"));
  expect(manifest.writable).toBe(false);
  expect(manifest.notes).toEqual(["notes/n.md"]);
  for (const f of ["index.html", "_kg/app.js", "a.canvas", "notes/n.md", "notes/assets/p.png"]) {
    expect(fs.existsSync(path.join(out, f))).toBe(true);
  }
  expect(fs.existsSync(path.join(out, "secret.md"))).toBe(false);
  expect(fs.existsSync(path.join(base, "secret.md"))).toBe(true);
});

it("refuses the project folder or a folder holding it as output", () => {
  const { base, proj, dist } = setup();
  expect(() => buildSite(proj, dist, proj)).toThrow();
  expect(() => buildSite(proj, dist, base)).toThrow();
});

it("defaults to _site inside the project and leaves it out of the next build", () => {
  const { proj, dist } = setup();
  const out = buildSite(proj, dist);
  expect(out).toBe(path.join(proj, "_site"));
  buildSite(proj, dist);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "kg.json"), "utf8"));
  expect(manifest.assets).toEqual(["notes/assets/p.png"]);
  expect(fs.existsSync(path.join(out, "_site"))).toBe(false);
});

it("will not wipe an unrelated non-empty folder", () => {
  const { base, proj, dist } = setup();
  const out = path.join(base, "other");
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, "mine.txt"), "x");
  expect(() => buildSite(proj, dist, out)).toThrow();
  expect(fs.existsSync(path.join(out, "mine.txt"))).toBe(true);
});

it("builds a project with a root assets/ folder next to the page's own files", () => {
  const { base, proj, dist } = setup();
  const put = (f: string) => {
    fs.mkdirSync(path.dirname(path.join(base, f)), { recursive: true });
    fs.writeFileSync(path.join(base, f), "x");
  };
  put("proj/assets/a.png");
  const out = buildSite(proj, dist, path.join(base, "out"));
  expect(fs.existsSync(path.join(out, "assets/a.png"))).toBe(true);
  expect(fs.existsSync(path.join(out, "_kg/app.js"))).toBe(true);
  put("proj/_kg/x.png");
  expect(() => buildSite(proj, dist, path.join(base, "out2"))).toThrow(/clashes/);
});
