import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { buildManifest } from "./manifest.ts";

it("lists canvases, notes, template and assets, skipping hidden files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kg-"));
  const put = (f: string) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), "x");
  };
  ["b.canvas", "a.canvas", "notes/n.md", "notes/assets/p.png", "template.md", ".hidden", "node_modules/x/y.js"].forEach(put);
  const m = buildManifest(root);
  expect(m.canvases).toEqual(["a.canvas", "b.canvas"]);
  expect(m.notes).toEqual(["notes/n.md"]);
  expect(m.template).toBe(true);
  expect(m.assets).toEqual(["notes/assets/p.png"]);
  expect(m.name).toBe(path.basename(root));
});
