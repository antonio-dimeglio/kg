import { describe, expect, it } from "vitest";
import { CanvasError, parseCanvas } from "./canvas.ts";

const base = {
  nodes: [
    { id: "a", type: "file", file: "notes/a.md", x: 0, y: 0, width: 200, height: 60, extra: { k: 1 } },
    { id: "g", type: "group", label: "G", x: 0, y: 0, width: 400, height: 200 },
  ],
  edges: [{ id: "e", fromNode: "a", toNode: "g", label: "x", style: "dashed" }],
  meta: "kept",
};

describe("parseCanvas", () => {
  it("keeps unknown fields on canvas, nodes and edges", () => {
    const c = parseCanvas(JSON.stringify(base));
    expect(c["meta"]).toBe("kept");
    expect(c.nodes[0]?.["extra"]).toEqual({ k: 1 });
    expect(c.edges[0]?.["style"]).toBe("dashed");
  });

  it("allows an edge to point at a group", () => {
    expect(parseCanvas(JSON.stringify(base)).edges[0]?.toNode).toBe("g");
  });

  it("rejects an edge to a missing node", () => {
    const bad = { ...base, edges: [{ id: "e", fromNode: "a", toNode: "zzz" }] };
    expect(() => parseCanvas(JSON.stringify(bad))).toThrow(CanvasError);
  });

  it("rejects a file node without a file", () => {
    const bad = { nodes: [{ id: "a", type: "file", x: 0, y: 0, width: 1, height: 1 }] };
    expect(() => parseCanvas(JSON.stringify(bad))).toThrow(/file/);
  });

  it("rejects duplicate node ids", () => {
    const n = { id: "a", type: "text", text: "t", x: 0, y: 0, width: 1, height: 1 };
    expect(() => parseCanvas(JSON.stringify({ nodes: [n, n] }))).toThrow(/duplicate/);
  });

  it("accepts a canvas with no edges", () => {
    expect(parseCanvas('{"nodes": []}').edges).toEqual([]);
  });
});
