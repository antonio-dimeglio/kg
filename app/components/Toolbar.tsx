import { useEffect, useRef, useState } from "react";
import { Panel } from "@xyflow/react";
import type { Canvas } from "../../src/canvas";
import { addNode, newNoteText, notePath, subMapPath } from "../canvasEdit";
import type { Project } from "../project";
import { editor } from "../useStore";

// The project's template.md, or null when it has none or cannot be read.
async function loadTemplate(project: Project): Promise<string | null> {
  if (!project.manifest.template) return null;
  if (project.templateText !== undefined) return project.templateText;
  try {
    const res = await fetch("template.md");
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

interface Props {
  project: Project;
  canvasPath: string;
  canvas: Canvas;
  selNodes: ReadonlySet<string>;
  selEdges: ReadonlySet<string>;
  center: () => { x: number; y: number };
  onAdded: (id: string) => void;
  onDelete: () => void;
  onColor: (id: string, color: string) => void;
}

export function EditToolbar({ project, canvasPath, canvas, selNodes, selEdges, center, onAdded, onDelete, onColor }: Props) {
  const [asking, setAsking] = useState<"note" | "map" | null>(null);
  const [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (asking) input.current?.focus(); }, [asking]);

  const close = () => { setAsking(null); setTitle(""); };

  const add = (spec: Parameters<typeof addNode>[1], created?: { file: string; content?: string }) => {
    const c = center();
    let id = "";
    const fn = (cv: Canvas) => {
      const r = addNode(cv, spec, c.x, c.y, true);
      id = r.id;
      return r.canvas;
    };
    if (created?.content !== undefined) editor.addNote(canvasPath, created.file, created.content, fn);
    else if (created) editor.addSubMap(canvasPath, created.file, fn);
    else editor.edit(canvasPath, fn);
    onAdded(id);
  };

  const create = async () => {
    const t = title.trim();
    const kind = asking;
    if (!kind || !t) return;
    close();
    if (kind === "note") {
      const file = notePath(t, [...project.manifest.notes, ...Object.keys(project.notes)]);
      add({ type: "file", file }, { file, content: newNoteText(t, await loadTemplate(project)) });
    } else {
      const file = subMapPath(t, canvasPath, [...project.manifest.canvases, ...Object.keys(project.canvases)]);
      add({ type: "file", file }, { file });
    }
  };

  const only = selNodes.size === 1 ? canvas.nodes.find((n) => selNodes.has(n.id)) : undefined;
  const group = only?.type === "group" ? only : undefined;
  const toggle = (k: "note" | "map") => (asking === k ? close() : (setTitle(""), setAsking(k)));

  return (
    <Panel position="top-center" className="toolbar">
      <div className="bar">
        <button onClick={() => toggle("note")}>+ Note</button>
        <button onClick={() => toggle("map")}>+ Sub-map</button>
        <button onClick={() => add({ type: "text", text: "Text" })}>+ Text</button>
        <button onClick={() => add({ type: "group", label: "Group", color: "1" })}>+ Group</button>
        <button disabled={selNodes.size + selEdges.size === 0} onClick={onDelete}>Delete</button>
        {group && (
          <span className="swatches">
            {["1", "2", "3", "4", "5", "6"].map((c) => (
              <button key={c} title={`Colour ${c}`} className={"sw" + (group.color === c || (!group.color && c === "1") ? " on" : "")}
                style={{ background: `var(--b${c})` }} onClick={() => onColor(group.id, c)} />
            ))}
          </span>
        )}
      </div>
      {asking && (
        <div className="pop">
          <input ref={input} value={title} placeholder={asking === "note" ? "Title" : "Name"} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void create(); if (e.key === "Escape") close(); }} />
        </div>
      )}
    </Panel>
  );
}
