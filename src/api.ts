import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { TYPES } from "./classify.ts";
import { writeFileAtomic } from "./files.ts";
import { buildManifest } from "./manifest.ts";
import { safePath } from "./paths.ts";
import { checkOpen, createProject, listDirs } from "./projects.ts";
import { addRecent, loadRecent } from "./recent.ts";
import type { Session } from "./session.ts";

const MAX_BODY = 200 * 1024 * 1024;

function send(res: ServerResponse, status: number, text: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}

function sendJson(res: ServerResponse, value: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const text = (await readBody(req)).toString("utf8");
  const data: unknown = text ? JSON.parse(text) : {};
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// The start screen's calls: folder list, recent projects, open, new, close.
async function handleStart(session: Session, pathname: string, method: string, params: URLSearchParams, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (pathname === "/api/dirs" && method === "GET") sendJson(res, listDirs(params.get("path")));
    else if (pathname === "/api/recent" && method === "GET") sendJson(res, loadRecent());
    else if (pathname === "/api/open" && method === "POST") {
      session.root = checkOpen(str((await readJson(req))["path"]));
      addRecent(session.root);
      sendJson(res, { path: session.root });
    } else if (pathname === "/api/new" && method === "POST") {
      const body = await readJson(req);
      session.root = createProject(str(body["path"]), str(body["name"]));
      addRecent(session.root);
      sendJson(res, { path: session.root });
    } else if (pathname === "/api/close" && method === "POST") {
      session.root = null;
      sendJson(res, {});
    } else return send(res, 405, "Method not allowed"), true;
  } catch (e) {
    send(res, 400, e instanceof Error ? e.message : String(e));
  }
  return true;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Handles the project part of the server: kg.json, the project files and the
// write API. Returns false when the request is not for the project, so the
// caller can serve something else (the page).
export async function handleProject(session: Session, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const parsed = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const root = session.root;

  if (parsed.pathname.startsWith("/api/") && parsed.pathname !== "/api/file") {
    return handleStart(session, parsed.pathname, method, parsed.searchParams, req, res);
  }

  if (parsed.pathname === "/kg.json" && root === null) {
    sendJson(res, { project: null, writable: true });
    return true;
  }
  if (root === null) return parsed.pathname === "/api/file" ? (send(res, 409, "No project open"), true) : false;

  if (parsed.pathname === "/api/file") {
    if (method !== "PUT" && method !== "DELETE") return send(res, 405, "Method not allowed"), true;
    const file = safePath(root, parsed.searchParams.get("path") ?? "");
    if (!file) return send(res, 400, "Bad path"), true;
    try {
      if (method === "PUT") {
        writeFileAtomic(file, await readBody(req));
      } else if (fs.existsSync(file)) {
        if (!fs.statSync(file).isFile()) return send(res, 400, "Not a file"), true;
        fs.unlinkSync(file);
      }
      send(res, 200, "ok");
    } catch (e) {
      send(res, 500, e instanceof Error ? e.message : String(e));
    }
    return true;
  }

  if (method !== "GET" && method !== "HEAD") return false;

  if (parsed.pathname === "/kg.json") {
    sendJson(res, { ...buildManifest(root), writable: true });
    return true;
  }

  const file = safePath(root, decodeURIComponent(parsed.pathname).slice(1));
  const type = file ? TYPES[path.extname(file).toLowerCase()] : undefined;
  if (file && type && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
    return true;
  }
  return false;
}
