import { noteTitle, stem } from "../../src/notes";
import type { Project } from "../project";
import { useState } from "react";
import { addFiles } from "../transfer";
import { useStore } from "../useStore";

interface Props {
  project: Project;
  canvasPath: string;
  hits: string[] | null;
  activeNote: string;
  onCanvas: (path: string) => void;
  onNote: (path: string) => void;
}

export function Sidebar({ project, canvasPath, hits, activeNote, onCanvas, onNote }: Props) {
  const { mode } = useStore();
  const editing = mode === "edit" && project.manifest.writable === true;
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState("");
  const writable = project.manifest.writable === true;
  const files = (e: React.DragEvent) => writable && e.dataTransfer.types.includes("Files");
  const notes = (hits ?? project.manifest.notes).filter((p) => p in project.notes);
  return (
    <aside className={over ? "drop" : ""}
      onDragOver={(e) => { if (files(e)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!files(e)) return;
        e.preventDefault();
        setOver(false);
        addFiles([...e.dataTransfer.files]).then(setMessage, (err: unknown) => setMessage(err instanceof Error ? err.message : String(err)));
      }}>
      <h4>Canvases</h4>
      {project.manifest.canvases.map((path) => (
        <div key={path} className={"item" + (path === canvasPath ? " on" : "")} onClick={() => onCanvas(path)}>
          <span className="ico">&#9638;</span>{path}
        </div>
      ))}
      <h4>Notes</h4>
      {notes.map((path) => (
        <div key={path} className={"item" + (path === activeNote ? " on" : "")} onClick={() => onNote(path)}
          draggable={editing} onDragStart={(e) => e.dataTransfer.setData("application/kg-note", path)}
          title={noteTitle(path, project.notes[path] ?? "")}>
          <span className="ico">&#9643;</span>{stem(path)}.md
        </div>
      ))}
      {notes.length === 0 && <div className="none">No notes</div>}
      {message && <div className="problem" onClick={() => setMessage("")}>{message}</div>}
      {project.problems.map((p) => <div key={p} className="problem">{p}</div>)}
    </aside>
  );
}
