import type { Plugin } from "vite";
import { handleProject } from "./api.ts";
import type { Session } from "./session.ts";

// Dev server: serves kg.json (built on request), the project files and the
// write API.
export function kgProject(root: string): Plugin {
  const session: Session = { root };
  return {
    name: "kg-project",
    configureServer(server) {
      server.watcher.add(root);
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(root)) server.ws.send({ type: "full-reload" });
      });
      server.middlewares.use((req, res, next) => {
        handleProject(session, req, res).then((done) => {
          if (!done) next();
        }, next);
      });
    },
  };
}
