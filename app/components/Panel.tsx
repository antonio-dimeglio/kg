import { useEffect, useMemo, useRef } from "react";
import { NoteEditor } from "./NoteEditor";
import { drawMermaidIn } from "../mermaid";
import type { Canvas, CanvasNode } from "../../src/canvas";
import { mediaKind } from "../../src/notes";
import { cardInfo } from "../flow";
import { mediaSrc } from "../live/assets";
import { renderMarkdown } from "../markdown";
import type { Project } from "../project";
import { relations, type Relation, type Target } from "../relations";

export type Tab = "note" | "links" | "json";

interface Props {
  project: Project;
  canvas: Canvas;
  canvasPath: string;
  node: CanvasNode | undefined;
  notePath: string | undefined;
  tab: Tab;
  onTab: (t: Tab) => void;
  focused: boolean;
  onFocus: () => void;
  onOpen: (t: Target) => void;
}

function Markdown({ text, notePath, project, onOpen }: { text: string; notePath: string; project: Project; onOpen: (t: Target) => void }) {
  const html = useMemo(() => renderMarkdown(text, { notePath, notes: project.notes }), [text, notePath, project.notes]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) drawMermaidIn(ref.current); }, [html]);
  return (
    <div className="doc" ref={ref} dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest<HTMLElement>("a.wl");
        if (!a) return;
        e.preventDefault();
        const path = a.dataset["note"];
        if (path) onOpen({ kind: "note", path });
      }} />
  );
}

function Media({ path }: { path: string }) {
  const file = mediaSrc(path);
  const kind = mediaKind(path);
  if (kind === "image") return <img className="media" src={file} alt="" />;
  if (kind === "video") return <video className="media" src={file} controls />;
  if (kind === "audio") return <audio src={file} controls />;
  return <a className="link" href={file} target="_blank" rel="noopener noreferrer">{path.split("/").pop()}</a>;
}

function NoteTab({ project, node, notePath, onOpen }: Pick<Props, "project" | "node" | "notePath" | "onOpen">) {
  const editing = project.manifest.writable === true;
  if (node?.type === "text") {
    return <><div className="path">text card</div><Markdown text={node.text ?? ""} notePath="" project={project} onOpen={onOpen} /></>;
  }
  if (node?.type === "link") {
    return <><div className="path">link</div><p><a className="link" href={node.url} target="_blank" rel="noopener noreferrer">{node.url}</a></p></>;
  }
  const file = node?.file ?? notePath ?? "";
  const md = project.notes[file];
  if (md !== undefined && editing) {
    return <><div className="path">{file}</div><NoteEditor notePath={file} text={md} project={project} onOpen={onOpen} /></>;
  }
  if (md !== undefined) {
    return <><div className="path">{file}</div><Markdown text={md} notePath={file} project={project} onOpen={onOpen} /></>;
  }
  if (node?.file) {
    const info = cardInfo(node, project);
    return <><div className="path">{file}</div>{info.kind === "missing" ? <p>Not found</p> : <Media path={file} />}</>;
  }
  return <p className="muted">Select a card or a note.</p>;
}

function Rows({ title, rows, onOpen }: { title: string; rows: Relation[]; onOpen: (t: Target) => void }) {
  return (
    <>
      <h3>{title}</h3>
      {rows.length === 0 && <p className="muted">None</p>}
      {rows.map((r, i) => (
        <div className="rel" key={i}>
          <span className="link" onClick={() => onOpen(r.target)}>{r.name}</span>
          <span>{r.label}</span>
        </div>
      ))}
    </>
  );
}

function LinksTab({ project, canvas, node, notePath, onOpen }: Pick<Props, "project" | "canvas" | "node" | "notePath" | "onOpen">) {
  const note = node?.file && node.file in project.notes ? node.file : notePath;
  const { out, into } = relations(project, canvas, node?.id ?? null, note ?? null);
  return <><Rows title="Points to" rows={out} onOpen={onOpen} /><Rows title="Pointed to by" rows={into} onOpen={onOpen} /></>;
}

function JsonTab({ canvas, canvasPath, node }: Pick<Props, "canvas" | "canvasPath" | "node">) {
  if (!node) return <p className="muted">Not on this canvas.</p>;
  const edges = canvas.edges.filter((e) => e.fromNode === node.id || e.toNode === node.id);
  return (
    <>
      <div className="path">{canvasPath}</div>
      <h3>Node</h3><pre>{JSON.stringify(node, null, 2)}</pre>
      <h3>Its edges</h3><pre>{JSON.stringify(edges, null, 2)}</pre>
    </>
  );
}

export function Panel(props: Props) {
  const { tab, onTab, focused, onFocus } = props;
  return (
    <section id="panel">
      <div className="tabs">
        {(["note", "links", "json"] as const).map((t) => (
          <button key={t} className={t === tab ? "on" : ""} onClick={() => onTab(t)}>
            {t === "note" ? "Note" : t === "links" ? "Links" : "JSON"}
          </button>
        ))}
        <button className="focusbtn" title={focused ? "Show the graph" : "Hide the graph"} onClick={onFocus}>
          {focused ? "⇥ Graph" : "⇤ Focus"}
        </button>
      </div>
      <div className="pbody">
        {tab === "note" && <NoteTab {...props} />}
        {tab === "links" && <LinksTab {...props} />}
        {tab === "json" && <JsonTab {...props} />}
      </div>
    </section>
  );
}
