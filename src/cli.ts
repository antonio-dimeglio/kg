#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleProject } from "./api.ts";
import { buildSite } from "./build.ts";
import { initProject } from "./init.ts";
import { addRecent } from "./recent.ts";
import type { Session } from "./session.ts";

const PAGE_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
};

const USAGE = `Usage:
  kg serve [folder] [--port N]   serve the page and the project, with saving;
                                 without a folder, start at the start screen
  kg build [folder] [--out dir]  write a static read-only site (default: <folder>/_site)
  kg init [folder]               create an empty project
`;

function servePage(dist: string, pathname: string, res: http.ServerResponse): void {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1);
  const file = path.resolve(dist, rel);
  const ok = file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", PAGE_TYPES[path.extname(file)] ?? "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}

function serve(folder: string | undefined, port: number): void {
  const root = folder === undefined ? null : path.resolve(folder);
  if (root !== null && (!fs.existsSync(root) || !fs.statSync(root).isDirectory())) {
    console.error(`Not a folder: ${folder}`);
    process.exit(1);
  }
  if (root !== null) addRecent(root);
  const session: Session = { root };
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    console.error("The web app is not built. Run `npm run build` first.");
    process.exit(1);
  }
  const server = http.createServer((req, res) => {
    handleProject(session, req, res).then((done) => {
      if (!done) servePage(dist, new URL(req.url ?? "/", "http://localhost").pathname, res);
    }, (e: unknown) => {
      res.statusCode = 500;
      res.end(e instanceof Error ? e.message : String(e));
    });
  });
  server.on("error", (e) => {
    console.error(e.message);
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`kg serving ${root ?? "no project (start screen)"}\nhttp://localhost:${port}/`);
  });
}

function main(argv: string[]): void {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  let port = 5173;
  let out: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--port") {
      port = Number(rest[++i]);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        console.error("Bad --port");
        process.exit(1);
      }
    } else if (rest[i] === "--out") {
      out = rest[++i];
      if (!out) {
        console.error("Bad --out");
        process.exit(1);
      }
    } else positional.push(rest[i] as string);
  }
  const folder = positional[0] ?? ".";
  if (command === "serve") serve(positional[0], port);
  else if (command === "build") {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
    try {
      console.log(`Wrote ${buildSite(folder, dist, out)}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  } else if (command === "init") {
    const written = initProject(path.resolve(folder));
    console.log(written.length ? `Created ${written.join(", ")}` : "Nothing to create");
  } else {
    console.error(USAGE);
    process.exit(command ? 1 : 0);
  }
}

main(process.argv.slice(2));
