import { describe, expect, it } from "vitest";
import type { Canvas } from "../src/canvas";
import {
  addNode, connect, containedIn, dragSet, fillTemplate, freeSpot, moveNodes, newNoteText, notePath, subMapPath, removeItems, setBox, setEdgeLabel, slugify,
} from "./canvasEdit";
import { History } from "./history";

const node = (id: string, x: number, y: number, w = 100, h = 60, type: "file" | "group" = "file") =>
  ({ id, type, x, y, width: w, height: h, ...(type === "file" ? { file: `notes/${id}.md` } : {}) }) as Canvas["nodes"][number];

const base = (): Canvas => ({
  extra: 1,
  nodes: [node("g", 0, 0, 500, 300, "group"), node("a", 20, 20), node("b", 400, 20), node("out", 600, 20)],
  edges: [{ id: "e1", fromNode: "a", toNode: "b", label: "x", custom: true }, { id: "e2", fromNode: "b", toNode: "out" }],
});

describe("canvas edits", () => {
  it("moves a group together with the nodes whose box lies inside it", () => {
    const c = base();
    expect(containedIn(c, "g").sort()).toEqual(["a", "b"]);
    const moved = moveNodes(c, dragSet(c, "g"), 30, 10);
    expect(moved.nodes.map((n) => [n.id, n.x, n.y])).toEqual([["g", 30, 10], ["a", 50, 30], ["b", 430, 30], ["out", 600, 20]]);
    expect(c.nodes[0]?.x).toBe(0);
  });

  it("snaps a resized box to the grid and keeps a minimum size", () => {
    const c = setBox(base(), "a", { x: 23, y: 18, width: 12, height: 400 });
    expect(c.nodes[1]).toMatchObject({ x: 20, y: 20, width: 120, height: 400 });
    expect(setBox(base(), "g", { x: 0, y: 0, width: 10, height: 10 }).nodes[0]).toMatchObject({ width: 160, height: 100 });
  });

  it("removes edges attached to removed nodes, and keeps unknown fields", () => {
    const c = removeItems(base(), ["b"], []);
    expect(c.edges).toEqual([]);
    expect(c.extra).toBe(1);
    expect(removeItems(base(), [], ["e1"]).edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("connects with the sides of the handles and refuses a loop", () => {
    const r = connect(base(), { source: "a", target: "out", sourceHandle: "right", targetHandle: "left" });
    expect(r?.canvas.edges.at(-1)).toMatchObject({ fromNode: "a", toNode: "out", fromSide: "right", toSide: "left" });
    expect(connect(base(), { source: "a", target: "a" })).toBeNull();
  });

  it("removes the label field when the label is emptied, other fields stay", () => {
    const c = setEdgeLabel(base(), "e1", "  ");
    expect(c.edges[0]).toEqual({ id: "e1", fromNode: "a", toNode: "b", custom: true });
    expect(setEdgeLabel(base(), "e1", "uses").edges[0]?.label).toBe("uses");
  });

  it("adds a node centred on the point, on the grid, with a fresh id", () => {
    const { canvas, id } = addNode(base(), { type: "text", text: "Text" }, 505, 505);
    const n = canvas.nodes.find((x) => x.id === id);
    expect(n).toMatchObject({ x: 400, y: 460, width: 220, height: 90, text: "Text" });
    expect(new Set(canvas.nodes.map((x) => x.id)).size).toBe(canvas.nodes.length);
  });
});

describe("note names", () => {
  it("makes a slug, avoids taken paths and fills the title", () => {
    expect(slugify("  Tract Density: v2! ")).toBe("tract-density-v2");
    expect(slugify("???")).toBe("note");
    expect(notePath("Tract", ["notes/tract.md", "notes/tract-2.md"])).toBe("notes/tract-3.md");
    expect(fillTemplate("# {{title}}\n{{title}}", "A")).toBe("# A\nA");
  });

  it("starts a note with its title, or from the template", () => {
    expect(newNoteText("Tract", null)).toBe("# Tract\n");
    expect(newNoteText("Tract", "# {{title}}\n\n## Why\n")).toBe("# Tract\n\n## Why\n");
  });

  it("puts a sub-map next to the canvas it is added to", () => {
    expect(subMapPath("Tracking", "overview.canvas", [])).toBe("tracking.canvas");
    expect(subMapPath("Tracking", "a/b.canvas", ["a/tracking.canvas"])).toBe("a/tracking-2.canvas");
  });
});

describe("History", () => {
  it("undoes and redoes, and a new edit drops the redo stack", () => {
    const h = new History<number>();
    h.record(1);
    h.record(2);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeUndefined();
    expect(h.redo(1)).toBe(2);
    h.record(2);
    expect(h.redo(5)).toBeUndefined();
  });
});

describe("free placement", () => {
  const size = { width: 100, height: 60 };
  const hit = (a: { x: number; y: number }, n: { x: number; y: number; width: number; height: number }) =>
    a.x < n.x + n.width && n.x < a.x + size.width && a.y < n.y + n.height && n.y < a.y + size.height;

  it("keeps the centred spot when it is free", () => {
    expect(freeSpot({ nodes: [], edges: [] }, size, 500, 300)).toEqual({ x: 450, y: 270 });
  });

  it("moves to the nearest free spot on the grid, clear of cards", () => {
    const c: Canvas = { nodes: [node("a", 450, 270), node("b", 560, 270)], edges: [] };
    const at = freeSpot(c, size, 500, 300);
    expect(at.x % 10).toBe(0);
    expect(at.y % 10).toBe(0);
    expect(c.nodes.some((n) => hit(at, n))).toBe(false);
    expect(Math.hypot(at.x - 450, at.y - 270)).toBeLessThan(110);
  });

  it("lets a card sit inside a group but keeps a new group clear of everything", () => {
    const c: Canvas = { nodes: [node("g", 0, 0, 1000, 800, "group")], edges: [] };
    expect(freeSpot(c, size, 500, 400)).toEqual({ x: 450, y: 370 });
    const g = addNode(c, { type: "group", label: "G", color: "1" }, 500, 400, true).canvas.nodes[1] as Canvas["nodes"][number];
    expect(hit({ x: g.x, y: g.y }, { x: 0, y: 0, width: 1000, height: 800 })).toBe(false);
  });
});
