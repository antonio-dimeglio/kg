import { describe, expect, it } from "vitest";
import { extractLinks, firstLine, mediaKind, resolveLink, resolveRelative } from "./notes.ts";

const paths = ["notes/graph.md", "notes/types.md"];

describe("[[link]] resolution", () => {
  it("finds a note by file name without .md, ignoring case", () => {
    expect(resolveLink("Types", paths)).toBe("notes/types.md");
  });

  it("returns undefined when no note has that name", () => {
    expect(resolveLink("nope", paths)).toBeUndefined();
  });

  it("reads name, heading and alias forms", () => {
    expect(extractLinks("a [[types]] b [[core#Inside|the core]] c [[types]]")).toEqual(["types", "core"]);
  });
});

describe("note text", () => {
  it("takes the first line after the title", () => {
    expect(firstLine("# T\n\nBuilds `x` from [[types]].\n")).toBe("Builds x from types.");
  });

  it("resolves image paths against the note folder", () => {
    expect(resolveRelative("notes/a.md", "assets/x.png")).toBe("notes/assets/x.png");
    expect(resolveRelative("notes/a.md", "../pics/x.png")).toBe("pics/x.png");
  });

  it("tells media kinds apart", () => {
    expect([mediaKind("a.PNG"), mediaKind("b.webm"), mediaKind("c.mp3"), mediaKind("d.pdf"), mediaKind("e.md")])
      .toEqual(["image", "video", "audio", "pdf", "other"]);
  });
});
