// The path of canvases you went through, as a list of canvas files; the last
// one is open. Kept in the URL hash so a reload keeps it.

export type Trail = readonly string[];

export const fresh = (path: string): Trail => [path];

// Opens a sub-map: it goes on the end of the path.
export const push = (trail: Trail, path: string): Trail => [...trail, path];

// Goes back up to the part at this index, dropping what came after.
export const goTo = (trail: Trail, index: number): Trail =>
  index < 0 || index >= trail.length ? trail : trail.slice(0, index + 1);

export const current = (trail: Trail): string => trail[trail.length - 1] ?? "";

export function writeTrail(params: URLSearchParams, trail: Trail): void {
  if (trail.length === 0) return;
  params.set("canvas", current(trail));
  if (trail.length > 1) params.set("trail", trail.join("|"));
  else params.delete("trail");
}

// The path from the hash when every part is a known canvas and it ends at the
// wanted canvas; otherwise just that canvas.
export function readTrail(params: URLSearchParams, known: (path: string) => boolean, wanted: string): Trail {
  const parts = (params.get("trail") ?? "").split("|").filter(Boolean);
  if (parts.length > 1 && parts.every(known) && parts[parts.length - 1] === wanted) return parts;
  return fresh(wanted);
}

export const crumbLabel = (path: string): string => (path.split("/").pop() ?? path).replace(/\.canvas$/, "");
