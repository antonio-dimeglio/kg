import { describe, expect, it } from "vitest";
import { safePath } from "./paths.ts";

describe("safePath", () => {
  it("accepts normal project paths", () => {
    expect(safePath("/p", "notes/a.md")).toBe("/p/notes/a.md");
  });
  it("rejects escapes, hidden parts and node_modules", () => {
    for (const bad of ["../x.md", "notes/../../x", "/etc/passwd", ".git/config", "notes/.hidden.md", "node_modules/a.md", "a/node_modules/b", "", "a//b", "a\\b"]) {
      expect(safePath("/p", bad), bad).toBeNull();
    }
  });
});
