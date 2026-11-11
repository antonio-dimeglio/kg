import { useState } from "react";
import type { Project } from "../project";
import { crumbLabel, type Trail } from "../trail";
import { FileMenu } from "./FileMenu";
import { PaletteMenu } from "./PaletteMenu";
import { editor, store, useStore } from "../useStore";

interface Props {
  project: Project;
  trail: Trail;
  onTrail: (index: number) => void;
  query: string;
  onQuery: (q: string) => void;
  canvasPath?: string;
  notePath?: string;
}

export function TopBar({ project, trail, onTrail, query, onQuery, canvasPath, notePath }: Props) {
  const { mode, dirty, saving, saveError, memory, folder } = useStore();
  const writable = project.manifest.writable === true;
  const [asking, setAsking] = useState(false);
  const home = () => {
    editor.clear();
    setAsking(false);
    void store.leave();
  };
  const saveAndLeave = () => { void store.save().then((ok) => { if (ok) home(); }); };
  return (
    <header>
      <button className="logo" title="Projects" onClick={() => (store.hasChanges ? setAsking(true) : home())}>k<span>g</span></button>
      <button className="btn projects" title="Projects" onClick={() => (store.hasChanges ? setAsking(true) : home())}>&#8962; Projects</button>
      {asking ? (
        <div className="leave">
          Save your changes first?
          <button className="btn primary" onClick={saveAndLeave}>Save</button>
          <button className="btn" onClick={home}>Discard</button>
          <button className="btn" onClick={() => setAsking(false)}>Cancel</button>
        </div>
      ) : (
        <div className="crumbs">
          {project.manifest.name}
          {trail.map((p, i) => (
            <span key={i}>
              {" > "}
              {i === trail.length - 1
                ? <b title={p}>{crumbLabel(p)}</b>
                : <a title={p} onClick={() => onTrail(i)}>{crumbLabel(p)}</a>}
            </span>
          ))}
        </div>
      )}
      <div className="spacer" />
      {memory && <span className="mem" title="This project is kept in this browser only. Download it to keep it.">In browser</span>}
      {folder && <span className="mem" title="Saved straight to the files of this folder">{folder}</span>}
      {writable && (
        <>
          {saveError && <span className="save-error" title={saveError}>Save failed</span>}
          <div className="switch">
            <button className={mode === "view" ? "on" : ""} onClick={() => store.setMode("view")}>View</button>
            <button className={mode === "edit" ? "on" : ""} onClick={() => store.setMode("edit")}>Edit</button>
          </div>
          <button className="btn" title="Load the files again" onClick={() => { editor.clear(); void store.reload(); }}>Reload</button>
          <button className="btn primary" disabled={saving || dirty.size === 0} onClick={() => void store.save()}>
            {saving ? "Saving" : dirty.size ? `Save (${dirty.size})` : "Save"}
          </button>
        </>
      )}
      {canvasPath && <FileMenu canvasPath={canvasPath} notePath={notePath} writable={writable} />}
      <input className="search" placeholder="Search notes" value={query} onChange={(e) => onQuery(e.target.value)} />
      <PaletteMenu />
    </header>
  );
}
