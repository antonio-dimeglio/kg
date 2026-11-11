export interface DirList {
  path: string;
  parent: string | null;
  dirs: string[];
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.text()) || `${res.status}`);
  return (await res.json()) as T;
}

export const listDirs = (path?: string) => call<DirList>(`api/dirs${path ? `?path=${encodeURIComponent(path)}` : ""}`);
export const listRecent = () => call<string[]>("api/recent");
export const openProject = (path: string) => call<{ path: string }>("api/open", { path });
export const newProject = (path: string, name: string) => call<{ path: string }>("api/new", { path, name });

// Creates a project folder and writes the files of an imported zip into it,
// through the same file API that saving uses.
export async function importFiles(path: string, name: string, files: Map<string, Uint8Array>): Promise<void> {
  await newProject(path, name);
  for (const [file, bytes] of files) {
    const res = await fetch(`api/file?path=${encodeURIComponent(file)}`, { method: "PUT", body: bytes as BodyInit });
    if (!res.ok) throw new Error(`${file}: ${res.status} ${await res.text()}`);
  }
}
