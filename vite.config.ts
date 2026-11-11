import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { kgProject } from "./src/vite-plugin.ts";

const project = path.resolve(process.env.KG_PROJECT ?? "example");

// Relative URLs, so a built site works under any sub-path.
export default defineConfig({
  base: "./",
  // The page keeps its own files in _kg/, so a project may have an assets/ folder.
  build: { assetsDir: "_kg" },
  plugins: [react(), kgProject(project)],
});
