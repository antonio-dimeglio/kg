import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initProject } from "./init.ts";

// What the start screen asks of the server: list folders, check a folder to
// open, create a new project. Each function throws an Error with a message
// that is fine to show to the user.

function absolute(p: string): string {
  let s = p.trim();
  if (s === "~" || s.startsWith("~/")) s = path.join(os.homedir(), s.slice(1));
  if (!s || s.includes("\0") || !path.isAbsolute(s)) throw new Error("Give a full folder path");
  const abs = path.resolve(s);
  if (abs.split(path.sep).some((part) => part.startsWith("."))) throw new Error("Hidden folders are not allowed");
  return abs;
}

function requireFolder(abs: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new Error(`Folder not found: ${abs}`);
  }
  if (!stat.isDirectory()) throw new Error(`Not a folder: ${abs}`);
}

export interface DirList {
  path: string;
  parent: string | null;
  dirs: string[];
}

// The non-hidden subfolders of a folder, for the folder picker. Starts at the
// home folder when no path is given.
export function listDirs(p: string | null): DirList {
  const abs = p ? absolute(p) : os.homedir();
  requireFolder(abs);
  const dirs = fs.readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules" && fs.statSync(path.join(abs, e.name), { throwIfNoEntry: false })?.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  const parent = path.dirname(abs);
  return { path: abs, parent: parent === abs ? null : parent, dirs };
}

// Checks that a folder can be opened and returns its absolute path.
export function checkOpen(p: string): string {
  const abs = absolute(p);
  requireFolder(abs);
  return abs;
}

// Creates <parent>/<name> as an empty project and returns its path. The folder
// must not exist yet, or be empty.
export function createProject(parent: string, name: string): string {
  const base = absolute(parent);
  const n = name.trim();
  if (!n || n.includes("/") || n.includes("\\") || n.includes("\0") || n.startsWith(".") || n === "node_modules") {
    throw new Error("Give a plain project name, without slashes or a leading dot");
  }
  requireFolder(base);
  const target = path.join(base, n);
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) throw new Error(`Not a folder: ${target}`);
    if (fs.readdirSync(target).length > 0) throw new Error(`The folder is not empty: ${target}`);
  }
  fs.mkdirSync(target, { recursive: true });
  initProject(target);
  return target;
}
