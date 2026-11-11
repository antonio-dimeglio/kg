import type { DirH } from "./folder";

export interface RecentFolder {
  name: string;
  handle: DirH;
}

export const MAX_RECENT = 8;

type Same = (a: DirH, b: DirH) => Promise<boolean>;

// Puts a folder first in the list, once, and keeps the newest few.
export async function withRecent(list: RecentFolder[], entry: RecentFolder, same: Same): Promise<RecentFolder[]> {
  const rest: RecentFolder[] = [];
  for (const item of list) if (!(await same(item.handle, entry.handle))) rest.push(item);
  return [entry, ...rest].slice(0, MAX_RECENT);
}

export const sameHandle: Same = async (a, b) => {
  const is = (a as unknown as { isSameEntry?(o: unknown): Promise<boolean> }).isSameEntry;
  return is ? is.call(a, b) : false;
};

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("kg", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("folders");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, job: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const req = job(d.transaction("folders", mode).objectStore("folders"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => d.close());
}

export async function loadRecent(): Promise<RecentFolder[]> {
  try {
    return ((await run("readonly", (s) => s.get("list"))) as RecentFolder[] | undefined) ?? [];
  } catch {
    return [];
  }
}

async function saveRecent(list: RecentFolder[]): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(list, "list"));
  } catch {
    // The list is a convenience; a browser without storage goes without it.
  }
}

export async function rememberFolder(handle: DirH): Promise<void> {
  await saveRecent(await withRecent(await loadRecent(), { name: handle.name, handle }, sameHandle));
}

export async function forgetFolder(handle: DirH): Promise<RecentFolder[]> {
  const list = await loadRecent();
  const keep: RecentFolder[] = [];
  for (const item of list) if (!(await sameHandle(item.handle, handle))) keep.push(item);
  await saveRecent(keep);
  return keep;
}

// Asks for write access to a remembered folder. Returns false when refused.
export async function ensureAccess(handle: DirH): Promise<boolean> {
  const h = handle as unknown as { queryPermission(o: object): Promise<string>; requestPermission(o: object): Promise<string> };
  const opts = { mode: "readwrite" };
  if ((await h.queryPermission(opts)) === "granted") return true;
  return (await h.requestPermission(opts)) === "granted";
}
