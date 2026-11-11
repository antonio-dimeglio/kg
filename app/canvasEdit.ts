import type { Canvas, CanvasEdge, CanvasNode, Side } from "../src/canvas";

// Canvas edits as plain functions. Each returns a new canvas and leaves the
// old one alone; fields it does not know about are kept.

export const GRID = 10;
export const MIN_CARD = { width: 120, height: 50 };
export const MIN_GROUP = { width: 160, height: 100 };

export const snap = (v: number): number => Math.round(v / GRID) * GRID;

export interface Box { x: number; y: number; width: number; height: number }

const SIDES: readonly string[] = ["top", "right", "bottom", "left"];

export function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "note";
}

// notes/<slug>.md, with -2, -3 ... added when the name is taken.
export function notePath(title: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  const base = slugify(title);
  let path = `notes/${base}.md`;
  for (let i = 2; taken.has(path); i++) path = `notes/${base}-${i}.md`;
  return path;
}

export const fillTemplate = (template: string, title: string): string => template.split("{{title}}").join(title);

// The text of a new note: its title, or the project's template.md with the title filled in.
export const newNoteText = (title: string, template: string | null): string =>
  template === null ? `# ${title}\n` : fillTemplate(template, title);

export const isCanvasFile = (file: string): boolean => file.endsWith(".canvas");

// <slug>.canvas in the folder of the canvas it is added to, with -2, -3 ... when taken.
export function subMapPath(name: string, from: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  const i = from.lastIndexOf("/");
  const dir = i < 0 ? "" : from.slice(0, i + 1);
  const base = slugify(name);
  let path = `${dir}${base}.canvas`;
  for (let n = 2; taken.has(path); n++) path = `${dir}${base}-${n}.canvas`;
  return path;
}

export function newId(canvas: Canvas): string {
  const used = new Set([...canvas.nodes, ...canvas.edges].map((o) => o.id));
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    if (!used.has(id)) return id;
  }
}

export type NewNode =
  | { type: "file"; file: string }
  | { type: "text"; text: string }
  | { type: "group"; label: string; color: string };

const DEFAULT_SIZE = {
  file: { width: 260, height: 90 },
  text: { width: 220, height: 90 },
  group: { width: 400, height: 260 },
};

const GAP = GRID;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP;

// The grid position nearest to (cx, cy) where a box of this size touches no
// other node, so a new card does not hide an old one. A new group keeps clear
// of groups too; a card may sit inside a group. Returns the top-left corner of
// the box, or the centred position when nothing is free nearby.
export function freeSpot(canvas: Canvas, size: { width: number; height: number }, cx: number, cy: number, isGroup = false): { x: number; y: number } {
  const x0 = snap(cx - size.width / 2), y0 = snap(cy - size.height / 2);
  const others = canvas.nodes.filter((n) => isGroup || n.type !== "group");
  const free = (x: number, y: number) => !others.some((n) => overlaps({ x, y, ...size }, n));
  const RINGS = 80;
  for (let r = 0; r <= RINGS; r++) {
    let best: { x: number; y: number } | null = null, bestD = Infinity;
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const d = i * i + j * j;
        if (d >= bestD) continue;
        const x = x0 + i * GRID, y = y0 + j * GRID;
        if (free(x, y)) { best = { x, y }; bestD = d; }
      }
    }
    if (best) return best;
  }
  return { x: x0, y: y0 };
}

// Adds a node centred on (cx, cy), on the grid. With free set, the node goes
// to the nearest free spot instead. Returns the canvas and the new id.
export function addNode(canvas: Canvas, spec: NewNode, cx: number, cy: number, free = false): { canvas: Canvas; id: string } {
  const size = DEFAULT_SIZE[spec.type];
  const at = free ? freeSpot(canvas, size, cx, cy, spec.type === "group") : { x: snap(cx - size.width / 2), y: snap(cy - size.height / 2) };
  const node: CanvasNode = { id: newId(canvas), ...spec, ...at, ...size };
  return { canvas: { ...canvas, nodes: [...canvas.nodes, node] }, id: node.id };
}

const inside = (n: Box, g: Box) =>
  n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height;

// Ids of the nodes whose box lies inside the group's box.
export function containedIn(canvas: Canvas, groupId: string): string[] {
  const g = canvas.nodes.find((n) => n.id === groupId);
  if (!g || g.type !== "group") return [];
  return canvas.nodes.filter((n) => n.id !== groupId && inside(n, g)).map((n) => n.id);
}

// The ids that move together when one node is dragged: a group takes the
// nodes inside it along.
export function dragSet(canvas: Canvas, id: string): string[] {
  return [id, ...containedIn(canvas, id)];
}

export function moveNodes(canvas: Canvas, ids: readonly string[], dx: number, dy: number): Canvas {
  if (dx === 0 && dy === 0) return canvas;
  const set = new Set(ids);
  return { ...canvas, nodes: canvas.nodes.map((n) => (set.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
}

// Sets a node's box, on the grid and not below the minimum for its kind.
export function setBox(canvas: Canvas, id: string, box: Box): Canvas {
  return updateNode(canvas, id, (n) => {
    const min = n.type === "group" ? MIN_GROUP : MIN_CARD;
    return {
      ...n, x: snap(box.x), y: snap(box.y),
      width: Math.max(min.width, snap(box.width)), height: Math.max(min.height, snap(box.height)),
    };
  });
}

function updateNode(canvas: Canvas, id: string, fn: (n: CanvasNode) => CanvasNode): Canvas {
  return { ...canvas, nodes: canvas.nodes.map((n) => (n.id === id ? fn(n) : n)) };
}

// Removes nodes and edges, and every edge that touches a removed node.
export function removeItems(canvas: Canvas, nodeIds: readonly string[], edgeIds: readonly string[]): Canvas {
  const nodes = new Set(nodeIds), edges = new Set(edgeIds);
  return {
    ...canvas,
    nodes: canvas.nodes.filter((n) => !nodes.has(n.id)),
    edges: canvas.edges.filter((e) => !edges.has(e.id) && !nodes.has(e.fromNode) && !nodes.has(e.toNode)),
  };
}

export interface Link {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function connect(canvas: Canvas, link: Link): { canvas: Canvas; id: string } | null {
  const has = (id: string) => canvas.nodes.some((n) => n.id === id);
  if (link.source === link.target || !has(link.source) || !has(link.target)) return null;
  const edge: CanvasEdge = { id: newId(canvas), fromNode: link.source, toNode: link.target };
  if (link.sourceHandle && SIDES.includes(link.sourceHandle)) edge.fromSide = link.sourceHandle as Side;
  if (link.targetHandle && SIDES.includes(link.targetHandle)) edge.toSide = link.targetHandle as Side;
  return { canvas: { ...canvas, edges: [...canvas.edges, edge] }, id: edge.id };
}

// An empty label takes the label field away.
export function setEdgeLabel(canvas: Canvas, id: string, label: string): Canvas {
  const text = label.trim();
  return {
    ...canvas,
    edges: canvas.edges.map((e) => {
      if (e.id !== id) return e;
      if (text) return { ...e, label: text };
      const { label: _gone, ...rest } = e;
      return rest as CanvasEdge;
    }),
  };
}

export const setText = (canvas: Canvas, id: string, text: string): Canvas => updateNode(canvas, id, (n) => ({ ...n, text }));
export const setGroupLabel = (canvas: Canvas, id: string, label: string): Canvas => updateNode(canvas, id, (n) => ({ ...n, label }));
export const setColor = (canvas: Canvas, id: string, color: string): Canvas => updateNode(canvas, id, (n) => ({ ...n, color }));
