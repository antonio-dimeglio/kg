import { strToU8, zipSync } from "fflate";
import { expect, it } from "vitest";
import { packZip, unpackZip } from "./zip.ts";

const canvas = strToU8(JSON.stringify({ nodes: [], edges: [] }));
const png = new Uint8Array([137, 80, 78, 71, 0, 255, 128, 1, 2, 3]);

it("gives the same files back after export and import, binary included", () => {
  const files = new Map([
    ["overview.canvas", canvas],
    ["notes/a.md", strToU8("# A\n")],
    ["assets/p.png", png],
  ]);
  const back = unpackZip(packZip(files));
  expect([...back.files.keys()].sort()).toEqual([...files.keys()].sort());
  expect(back.files.get("assets/p.png")).toEqual(png);
  expect(back.folder).toBeNull();
});

it("unwraps a single top folder", () => {
  const zip = zipSync({ "proj/overview.canvas": canvas, "proj/notes/a.md": strToU8("x") });
  const out = unpackZip(zip);
  expect([...out.files.keys()].sort()).toEqual(["notes/a.md", "overview.canvas"]);
  expect(out.folder).toBe("proj");
});

it("skips unsafe, hidden and __MACOSX entries and bad text", () => {
  const zip = zipSync({
    "overview.canvas": canvas,
    "../evil.md": strToU8("x"),
    "/abs.md": strToU8("x"),
    ".hidden/a.md": strToU8("x"),
    "notes/.DS_Store": strToU8("x"),
    "__MACOSX/._overview.canvas": strToU8("x"),
    "notes/bad.md": new Uint8Array([0xff, 0xfe, 0xfd]),
    "bad.canvas": strToU8("not json"),
    "notes/ok.md": strToU8("ok"),
  });
  const out = unpackZip(zip);
  expect([...out.files.keys()].sort()).toEqual(["notes/ok.md", "overview.canvas"]);
  expect(out.skipped.length).toBe(7);
});

it("refuses a zip with no canvas or note, and a non-zip", () => {
  expect(() => unpackZip(zipSync({ "a.txt": strToU8("x") }))).toThrow(/No canvas/);
  expect(() => unpackZip(strToU8("hello"))).toThrow(/not a readable zip/);
});
