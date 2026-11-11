import path from "node:path";

// Resolves a project-relative path to an absolute one, or returns null when
// the path escapes the folder, is hidden (any part starting with a dot) or
// goes through node_modules.
export function safePath(root: string, rel: string): string | null {
  if (!rel || rel.includes("\0") || rel.includes("\\")) return null;
  const parts = rel.split("/");
  if (parts.some((p) => p === "" || p === "." || p === ".." || p.startsWith(".") || p === "node_modules")) return null;
  const abs = path.resolve(root, rel);
  return abs.startsWith(path.resolve(root) + path.sep) ? abs : null;
}
