import type { Edge, Node } from "@xyflow/react";
import type { Canvas, CanvasEdge, CanvasNode, Side } from "../src/canvas";
import { isCanvasFile } from "./canvasEdit";
import { firstLine, mediaKind, noteTitle, stem } from "../src/notes";
import type { Project } from "./project";

export type CardKind = "note" | "text" | "image" | "video" | "pdf" | "link" | "map" | "missing";

export interface CardInfo {
  kind: CardKind;
  title: string;
  mod: string;
  desc: string;
}

export function cardInfo(node: CanvasNode, project: Project): CardInfo {
  if (node.type === "text") return { kind: "text", title: "", mod: "", desc: node.text ?? "" };
  if (node.type === "link") return { kind: "link", title: node.url ?? "", mod: "", desc: "" };
  const file = node.file ?? "";
  const name = file.split("/").pop() ?? file;
  if (isCanvasFile(file)) {
    return project.canvases[file] === undefined
      ? { kind: "missing", title: name, mod: "", desc: "Not found" }
      : { kind: "map", title: name.replace(/\.canvas$/, ""), mod: "map", desc: "" };
  }
  const media = mediaKind(file);
  if (media === "image" || media === "video" || media === "pdf") {
    return { kind: media, title: name, mod: "", desc: "" };
  }
  const md = project.notes[file];
  if (md === undefined) return { kind: "missing", title: name, mod: "", desc: "Not found" };
  return { kind: "note", title: noteTitle(file, md), mod: stem(file), desc: firstLine(md) };
}

export function nodeLabel(node: CanvasNode, project: Project): string {
  if (node.type === "group") return node.label ?? "Group";
  const info = cardInfo(node, project);
  return info.title || info.desc || node.id;
}

export interface CardData extends Record<string, unknown> {
  node: CanvasNode;
  info: CardInfo;
  hit: boolean;
  dim: boolean;
  color: string;
}

function box(n: CanvasNode) {
  return { x: n.x, y: n.y, w: n.width, h: n.height };
}

// Sides facing each other when the edge names none.
export function pickSides(a: CanvasNode, b: CanvasNode): [Side, Side] {
  const p = box(a), q = box(b);
  const dx = q.x + q.w / 2 - (p.x + p.w / 2);
  const dy = q.y + q.h / 2 - (p.y + p.h / 2);
  if (Math.abs(dx) / (p.w + q.w) > Math.abs(dy) / (p.h + q.h)) return dx > 0 ? ["right", "left"] : ["left", "right"];
  return dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
}

export function matches(node: CanvasNode, project: Project, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const info = cardInfo(node, project);
  const body = node.file ? (project.notes[node.file] ?? "") : (node.text ?? "");
  return [info.title, info.mod, info.desc, node.file ?? "", node.label ?? "", body]
    .some((s) => s.toLowerCase().includes(q));
}

export function toFlow(canvas: Canvas, project: Project, selected: string | null, query: string) {
  const searching = query.trim() !== "";
  const ordered = [...canvas.nodes.filter((n) => n.type === "group"), ...canvas.nodes.filter((n) => n.type !== "group")];
  const nodes: Node[] = ordered.map((n) => {
    const hit = searching && n.type !== "group" && matches(n, project, query);
    const data: CardData = { node: n, info: cardInfo(n, project), hit, dim: searching && n.type !== "group" && !hit, color: n.color ?? "1" };
    return {
      id: n.id,
      type: n.type === "group" ? "group" : "card",
      position: { x: n.x, y: n.y },
      width: n.width,
      height: n.height,
      data,
      selected: n.id === selected,
      selectable: n.type !== "group",
      draggable: false,
      connectable: false,
      zIndex: n.type === "group" ? -1 : 0,
    };
  });
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  const edges: Edge[] = canvas.edges.map((e: CanvasEdge) => {
    const a = byId.get(e.fromNode), b = byId.get(e.toNode);
    const [fs, ts] = a && b ? pickSides(a, b) : (["right", "left"] as const);
    const hot = selected !== null && (e.fromNode === selected || e.toNode === selected);
    return {
      id: e.id,
      source: e.fromNode,
      target: e.toNode,
      sourceHandle: e.fromSide ?? fs,
      targetHandle: e.toSide ?? ts,
      type: "kg",
      selectable: false,
      data: { hot, label: e.label ?? "", arrow: e["toEnd"] !== "none" },
    };
  });
  return { nodes, edges };
}
