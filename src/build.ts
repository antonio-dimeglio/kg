import fs from "node:fs";
import path from "node:path";
import { buildManifest } from "./manifest.ts";

function inside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Writes a static, read-only site: the built page (dist), the project's
// canvases, notes and assets, and a kg.json with writable false. Every URL in
// the page is relative, so the site works under any sub-path. Returns the
// output folder.
export function buildSite(project: string, dist: string, out?: string): string {
  const root = path.resolve(project);
  const target = path.resolve(out ?? path.join(root, "_site"));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a folder: ${project}`);
  if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("The web app is not built. Run `npm run build` first.");
  if (target === root || inside(target, root)) throw new Error("The output folder must not be the project folder or contain it");
  if (fs.existsSync(target)) {
    const entries = fs.readdirSync(target);
    const ours = fs.existsSync(path.join(target, "kg.json")) && fs.existsSync(path.join(target, "index.html"));
    if (entries.length > 0 && !ours) throw new Error(`${target} is not empty and not a kg site; choose another --out`);
    fs.rmSync(target, { recursive: true });
  }

  const manifest = buildManifest(root, inside(root, target) ? target : undefined);
  const files = [...manifest.canvases, ...manifest.notes, ...manifest.assets];
  // The page owns index.html, kg.json and the _kg/ folder; the rest is the project's.
  for (const f of files) {
    if (f === "index.html" || f === "kg.json" || f.startsWith("_kg/")) throw new Error(`${f} clashes with a file of the page`);
  }

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(dist, target, { recursive: true });
  for (const f of files) {
    const dest = path.join(target, f);
    if (!inside(target, dest)) throw new Error(`Bad path: ${f}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, f), dest);
  }
  fs.writeFileSync(path.join(target, "kg.json"), JSON.stringify({ ...manifest, template: false, writable: false }));
  return target;
}
