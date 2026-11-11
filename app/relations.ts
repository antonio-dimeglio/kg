import type { Canvas } from "../src/canvas";
import { extractLinks, noteTitle, resolveLink } from "../src/notes";
import { nodeLabel } from "./flow";
import type { Project } from "./project";

export type Target = { kind: "node"; id: string } | { kind: "note"; path: string };

export interface Relation {
  target: Target;
  name: string;
  label: string;
}

function noteName(path: string, project: Project): string {
  return noteTitle(path, project.notes[path] ?? "");
}

// What a card (or a note) points to, and what points to it.
export function relations(project: Project, canvas: Canvas, nodeId: string | null, notePath: string | null) {
  const out: Relation[] = [];
  const into: Relation[] = [];
  const paths = Object.keys(project.notes);
  const seenNotes = new Set<string>();
  const nodeOf = (id: string) => canvas.nodes.find((n) => n.id === id);

  for (const e of canvas.edges) {
    if (nodeId !== null && e.fromNode === nodeId) {
      const n = nodeOf(e.toNode);
      if (n) out.push({ target: { kind: "node", id: n.id }, name: nodeLabel(n, project), label: e.label ?? "" });
      if (n?.file) seenNotes.add(n.file);
    }
    if (nodeId !== null && e.toNode === nodeId) {
      const n = nodeOf(e.fromNode);
      if (n) into.push({ target: { kind: "node", id: n.id }, name: nodeLabel(n, project), label: e.label ?? "" });
      if (n?.file) seenNotes.add(n.file);
    }
  }

  if (notePath !== null) {
    for (const name of extractLinks(project.notes[notePath] ?? "")) {
      const p = resolveLink(name, paths);
      if (p && !seenNotes.has(p)) out.push({ target: { kind: "note", path: p }, name: noteName(p, project), label: "link" });
    }
    for (const [p, md] of Object.entries(project.notes)) {
      if (p === notePath || seenNotes.has(p)) continue;
      if (extractLinks(md).some((name) => resolveLink(name, paths) === notePath)) {
        into.push({ target: { kind: "note", path: p }, name: noteName(p, project), label: "link" });
      }
    }
  }
  return { out, into };
}
