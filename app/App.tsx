import { useEffect, useMemo, useState } from "react";
import { Graph } from "./components/Graph";
import { Panel, type Tab } from "./components/Panel";
import { Sidebar } from "./components/Sidebar";
import { Start } from "./components/Start";
import { TopBar } from "./components/TopBar";
import { matches } from "./flow";
import { current, fresh, goTo, push, readTrail, writeTrail, type Trail } from "./trail";
import { store, useStore } from "./useStore";
import type { Target } from "./relations";

export type Selection = { kind: "node"; id: string } | { kind: "note"; path: string } | null;

function readHash(): URLSearchParams {
  return new URLSearchParams(location.hash.slice(1));
}

export function App() {
  const { project, home, published, error } = useStore();
  const [trail, setTrail] = useState<Trail>([]);
  const canvasPath = current(trail);
  const [sel, setSel] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("note");
  const [focused, setFocused] = useState(readHash().has("focus"));
  const [query, setQuery] = useState("");

  // Loads the project the server has open and picks the first canvas.
  const init = () => store.load().then(() => {
      const p = store.getState().project;
      if (!p) return;
      const hash = readHash();
      const wanted = hash.get("canvas");
      const first = (wanted && p.canvases[wanted] ? wanted : Object.keys(p.canvases).sort()[0]) ?? "";
      setTrail(readTrail(hash, (c) => c in p.canvases, first));
      const nodes = p.canvases[first]?.nodes ?? [];
      const start = nodes.find((n) => n.id === hash.get("node")) ?? nodes.find((n) => n.type === "file");
      if (start) setSel({ kind: "node", id: start.id });
      const t = hash.get("tab");
      if (t === "links" || t === "json") setTab(t);
    });

  useEffect(() => { void init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canvas = project?.canvases[canvasPath];

  // A project kept in the browser is lost on closing the page unless exported.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (store.unexported) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (trail.length === 0) return;
    const params = readHash();
    writeTrail(params, trail);
    history.replaceState(null, "", "#" + params.toString());
  }, [trail]);

  const show = (next: Trail) => {
    setTrail(next);
    const first = project?.canvases[current(next)]?.nodes.find((n) => n.type === "file");
    setSel(first ? { kind: "node", id: first.id } : null);
  };
  // From the list: a fresh path. From a sub-map card: one level down.
  const openCanvas = (path: string) => show(fresh(path));
  const openSubMap = (path: string) => show(push(trail, path));

  const open = (target: Target) => {
    if (target.kind === "node") return setSel({ kind: "node", id: target.id });
    const card = canvas?.nodes.find((n) => n.file === target.path);
    setSel(card ? { kind: "node", id: card.id } : { kind: "note", path: target.path });
  };

  const hits = useMemo(() => {
    if (!project || !query.trim()) return null;
    return Object.keys(project.notes).filter((p) =>
      matches({ id: "", type: "file", file: p, x: 0, y: 0, width: 0, height: 0 }, project, query));
  }, [project, query]);

  if (error) return <div className="state">Could not load kg.json: {error}</div>;
  if (home) return <Start published={published} onOpened={() => { setSel(null); setTrail([]); setQuery(""); void init(); }} />;
  if (project && !canvas) {
    return (
      <>
        <TopBar project={project} trail={[]} onTrail={() => {}} query={query} onQuery={setQuery} />
        <div className="state">No canvas found in this project.</div>
      </>
    );
  }
  if (!project || !canvas) return <div className="state">Loading</div>;

  const selectedNode = sel?.kind === "node" ? canvas.nodes.find((n) => n.id === sel.id) : undefined;

  return (
    <>
      <TopBar project={project} trail={trail} onTrail={(i) => show(goTo(trail, i))} query={query} onQuery={setQuery}
        canvasPath={canvasPath} notePath={selectedNode?.file?.endsWith(".md") ? selectedNode.file : sel?.kind === "note" ? sel.path : undefined} />
      <main className={focused ? "focused" : ""}>
        <Sidebar
          project={project}
          canvasPath={canvasPath}
          hits={hits}
          activeNote={selectedNode?.file ?? (sel?.kind === "note" ? sel.path : "")}
          onCanvas={openCanvas}
          onNote={(path) => open({ kind: "note", path })}
        />
        <Graph
          key={canvasPath}
          project={project}
          canvas={canvas}
          canvasPath={canvasPath}
          selected={selectedNode?.id ?? null}
          query={query}
          focused={focused}
          onSelect={(id) => setSel({ kind: "node", id })}
          onOpenCanvas={openSubMap}
        />
        <Panel
          project={project}
          canvas={canvas}
          canvasPath={canvasPath}
          node={selectedNode}
          notePath={sel?.kind === "note" ? sel.path : undefined}
          tab={tab}
          onTab={setTab}
          focused={focused}
          onFocus={() => setFocused(!focused)}
          onOpen={open}
        />
      </main>
    </>
  );
}

