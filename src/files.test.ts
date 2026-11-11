import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { writeFileAtomic } from "./files.ts";
import { initProject } from "./init.ts";
import { buildManifest } from "./manifest.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "kg-test-"));

it("writes a file, replaces it and leaves no temp file", () => {
  const dir = tmp();
  const file = path.join(dir, "notes", "a.md");
  writeFileAtomic(file, "one");
  writeFileAtomic(file, new Uint8Array([50, 51]));
  expect(fs.readFileSync(file, "utf8")).toBe("23");
  expect(fs.readdirSync(path.join(dir, "notes"))).toEqual(["a.md"]);
});

it("kg init creates the canvas and notes folder, and keeps existing files", () => {
  const dir = tmp();
  initProject(dir);
  expect(fs.existsSync(path.join(dir, "notes"))).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(dir, "overview.canvas"), "utf8"))).toEqual({ nodes: [], edges: [] });
  expect(buildManifest(dir).template).toBe(false);
  fs.writeFileSync(path.join(dir, "overview.canvas"), "mine");
  expect(initProject(dir)).toEqual([]);
  expect(fs.readFileSync(path.join(dir, "overview.canvas"), "utf8")).toBe("mine");
});
