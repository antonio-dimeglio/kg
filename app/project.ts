import { type Canvas, parseCanvas } from "../src/canvas";
import type { Manifest } from "../src/manifest";

export interface Project {
  manifest: Manifest;
  canvases: Record<string, Canvas>;
  notes: Record<string, string>;
  problems: string[];
  // template.md, for a project kept in the browser (otherwise it is fetched).
  templateText?: string;
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.text();
}

// Loads kg.json, then every canvas and note it lists, relative to the page.
// Returns null when the server has no project open (the start screen shows).
export async function loadProject(): Promise<Project | null> {
  const manifest = JSON.parse(await fetchText("kg.json")) as Manifest & { project?: null };
  if (manifest.project === null) return null;
  const project: Project = { manifest, canvases: {}, notes: {}, problems: [] };
  await Promise.all([
    ...manifest.canvases.map(async (path) => {
      try {
        project.canvases[path] = parseCanvas(await fetchText(path));
      } catch (e) {
        project.problems.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
    ...manifest.notes.map(async (path) => {
      try {
        project.notes[path] = await fetchText(path);
      } catch (e) {
        project.problems.push(e instanceof Error ? e.message : String(e));
      }
    }),
  ]);
  return project;
}
