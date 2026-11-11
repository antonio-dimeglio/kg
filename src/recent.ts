import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeFileAtomic } from "./files.ts";

export const MAX_RECENT = 10;

// The folder for kg's own settings. KG_CONFIG_DIR overrides it (tests use that).
export function configDir(): string {
  if (process.env["KG_CONFIG_DIR"]) return path.resolve(process.env["KG_CONFIG_DIR"]);
  if (process.platform === "win32" && process.env["APPDATA"]) return path.join(process.env["APPDATA"], "kg");
  return path.join(process.env["XDG_CONFIG_HOME"] || path.join(os.homedir(), ".config"), "kg");
}

const isFolder = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

function readList(file: string): string[] {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) ? data.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

// Recently opened project folders, newest first. Folders that are gone are left out.
export function loadRecent(): string[] {
  return readList(path.join(configDir(), "recent.json")).filter(isFolder).slice(0, MAX_RECENT);
}

// Puts a folder at the front of the list, keeps the last MAX_RECENT.
export function addRecent(folder: string): void {
  const file = path.join(configDir(), "recent.json");
  const abs = path.resolve(folder);
  const list = [abs, ...readList(file).filter((p) => p !== abs && isFolder(p))].slice(0, MAX_RECENT);
  writeFileAtomic(file, JSON.stringify(list, null, "\t") + "\n");
}
