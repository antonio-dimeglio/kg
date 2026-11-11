// JSON Canvas model (jsoncanvas.org). Unknown fields are kept on every object.

export type NodeType = "file" | "text" | "link" | "group";
export type Side = "top" | "right" | "bottom" | "left";

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  file?: string;
  text?: string;
  url?: string;
  label?: string;
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: Side;
  toSide?: Side;
  label?: string;
  color?: string;
  [key: string]: unknown;
}

export interface Canvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  [key: string]: unknown;
}

const NODE_TYPES = ["file", "text", "link", "group"];
const SIDES = ["top", "right", "bottom", "left"];

export class CanvasError extends Error {}

function fail(message: string): never {
  throw new CanvasError(message);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkString(o: Record<string, unknown>, key: string, where: string): void {
  if (typeof o[key] !== "string") fail(`${where}: "${key}" must be a string`);
}

function checkOptionalString(o: Record<string, unknown>, key: string, where: string): void {
  if (o[key] !== undefined && typeof o[key] !== "string") fail(`${where}: "${key}" must be a string`);
}

function checkNumber(o: Record<string, unknown>, key: string, where: string): void {
  if (typeof o[key] !== "number" || !Number.isFinite(o[key])) fail(`${where}: "${key}" must be a number`);
}

export function parseCanvas(text: string): Canvas {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    fail("not valid JSON");
  }
  if (!isObject(raw)) fail("a canvas must be a JSON object");
  const nodes = raw["nodes"] ?? [];
  const edges = raw["edges"] ?? [];
  if (!Array.isArray(nodes)) fail('"nodes" must be a list');
  if (!Array.isArray(edges)) fail('"edges" must be a list');

  const ids = new Set<string>();
  nodes.forEach((n: unknown, i: number) => {
    const where = `node ${i}`;
    if (!isObject(n)) fail(`${where} must be an object`);
    checkString(n, "id", where);
    checkString(n, "type", where);
    if (!NODE_TYPES.includes(n["type"] as string)) fail(`${where}: unknown type "${String(n["type"])}"`);
    for (const k of ["x", "y", "width", "height"]) checkNumber(n, k, where);
    for (const k of ["color", "label"]) checkOptionalString(n, k, where);
    const type = n["type"];
    if (type === "file") checkString(n, "file", where);
    if (type === "text") checkString(n, "text", where);
    if (type === "link") checkString(n, "url", where);
    const id = n["id"] as string;
    if (ids.has(id)) fail(`duplicate node id "${id}"`);
    ids.add(id);
  });

  const edgeIds = new Set<string>();
  edges.forEach((e: unknown, i: number) => {
    const where = `edge ${i}`;
    if (!isObject(e)) fail(`${where} must be an object`);
    for (const k of ["id", "fromNode", "toNode"]) checkString(e, k, where);
    for (const k of ["label", "color"]) checkOptionalString(e, k, where);
    for (const k of ["fromSide", "toSide"]) {
      if (e[k] !== undefined && !SIDES.includes(e[k] as string)) fail(`${where}: bad "${k}"`);
    }
    for (const k of ["fromNode", "toNode"]) {
      if (!ids.has(e[k] as string)) fail(`${where}: "${k}" points at missing node "${String(e[k])}"`);
    }
    const id = e["id"] as string;
    if (edgeIds.has(id)) fail(`duplicate edge id "${id}"`);
    edgeIds.add(id);
  });

  return { ...raw, nodes: nodes as CanvasNode[], edges: edges as CanvasEdge[] };
}

export function serializeCanvas(canvas: Canvas): string {
  return JSON.stringify(canvas, null, "\t") + "\n";
}
