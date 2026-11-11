import { expect, it } from "vitest";
import { crumbLabel, fresh, goTo, push, readTrail, writeTrail } from "./trail";

it("pushes sub-maps, goes up, and starts fresh from the list", () => {
  const t = push(push(fresh("overview.canvas"), "page.canvas"), "editor.canvas");
  expect(t).toEqual(["overview.canvas", "page.canvas", "editor.canvas"]);
  expect(goTo(t, 1)).toEqual(["overview.canvas", "page.canvas"]);
  expect(fresh("editor.canvas")).toEqual(["editor.canvas"]);
  expect(crumbLabel("a/editor.canvas")).toBe("editor");
});

it("keeps the path in the hash and ignores a path that does not fit", () => {
  const p = new URLSearchParams("tab=links");
  writeTrail(p, ["a.canvas", "b.canvas"]);
  expect(p.get("tab")).toBe("links");
  const known = (c: string) => c === "a.canvas" || c === "b.canvas";
  expect(readTrail(p, known, "b.canvas")).toEqual(["a.canvas", "b.canvas"]);
  expect(readTrail(p, known, "a.canvas")).toEqual(["a.canvas"]);
  expect(readTrail(p, (c) => c === "b.canvas", "b.canvas")).toEqual(["b.canvas"]);
  writeTrail(p, ["b.canvas"]);
  expect(p.has("trail")).toBe(false);
});
