import { useEffect, useState } from "react";
import { PaletteMenu } from "./PaletteMenu";
import { type DirList, importFiles, listDirs, listRecent, newProject, openProject } from "../startApi";
import { store, useStore } from "../useStore";
import { importZipInBrowser, newInBrowser, readZipFile } from "../transfer";

type Action = "new" | "open" | "import";

// A list of the folders under a path, to pick one without typing it.
function FolderPicker({ start, onPick, onCancel }: { start?: string; onPick: (path: string) => void; onCancel: () => void }) {
  const [list, setList] = useState<DirList | null>(null);
  const [error, setError] = useState("");
  const go = (path?: string) => {
    listDirs(path).then((l) => { setList(l); setError(""); }, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => go(start || undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="picker">
      <div className="picker-top">
        <span className="path">{list?.path ?? ""}</span>
        <button className="btn" onClick={() => list && onPick(list.path)} disabled={!list}>Use this folder</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {error && <div className="start-error">{error}</div>}
      <div className="picker-list">
        {list?.parent && <button onClick={() => go(list.parent ?? undefined)}>..</button>}
        {list?.dirs.map((d) => <button key={d} onClick={() => go(`${list.path}/${d}`)}>{d}</button>)}
        {list && list.dirs.length === 0 && <span className="muted">No folders here</span>}
      </div>
    </div>
  );
}

function PathField({ value, onChange, placeholder, onEnter }: { value: string; onChange: (v: string) => void; placeholder: string; onEnter: () => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <div className="row">
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }} />
        <button className="btn" onClick={() => setPicking(!picking)}>Browse</button>
      </div>
      {picking && <FolderPicker start={value} onCancel={() => setPicking(false)} onPick={(p) => { onChange(p); setPicking(false); }} />}
    </>
  );
}

function NewProject({ onDone, run }: Panel) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const create = () => run(() => newProject(parent, name), onDone);
  return (
    <div className="panel-body">
      <label>Name</label>
      <input value={name} placeholder="my-project" autoFocus onChange={(e) => setName(e.target.value)} />
      <label>In folder</label>
      <PathField value={parent} onChange={setParent} placeholder="/full/path/to/folder" onEnter={create} />
      <div className="row end"><button className="btn primary" disabled={!name.trim() || !parent.trim()} onClick={create}>Create</button></div>
    </div>
  );
}

function ImportProject({ onDone, run }: Panel) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const go = () => run(async () => {
    if (!file) return;
    const zip = await readZipFile(file);
    await importFiles(parent, name.trim() || "New project", zip.files);
  }, onDone);
  return (
    <div className="panel-body">
      <label>Zip file</label>
      <input type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <label>Name</label>
      <input value={name} placeholder="New project" onChange={(e) => setName(e.target.value)} />
      <label>In folder</label>
      <PathField value={parent} onChange={setParent} placeholder="/full/path/to/folder" onEnter={go} />
      <div className="row end"><button className="btn primary" disabled={!file || !parent.trim()} onClick={go}>Import</button></div>
    </div>
  );
}

function OpenProject({ onDone, run }: Panel) {
  const [path, setPath] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { listRecent().then(setRecent, () => setRecent([])); }, []);
  const open = (p: string) => run(() => openProject(p), onDone);
  return (
    <div className="panel-body">
      <label>Project folder</label>
      <PathField value={path} onChange={setPath} placeholder="/full/path/to/project" onEnter={() => open(path)} />
      <div className="row end"><button className="btn primary" disabled={!path.trim()} onClick={() => open(path)}>Open</button></div>
      <label>Recent</label>
      <div className="recent">
        {recent.map((p) => (
          <button key={p} onClick={() => open(p)} title={p}>
            <b>{p.split("/").filter(Boolean).pop() ?? p}</b>
            <span>{p}</span>
          </button>
        ))}
        {recent.length === 0 && <span className="muted">No recent projects</span>}
      </div>
    </div>
  );
}

interface Panel {
  onDone: () => void;
  run: (call: () => Promise<unknown>, onDone: () => void) => void;
}

// The screen shown when no project is open. This is the local set of actions;
// a static build will list a different set.
export function Start({ published, onOpened }: { published: boolean; onOpened: () => void }) {
  const [action, setAction] = useState<Action>("open");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run: Panel["run"] = (call, onDone) => {
    setBusy(true);
    call().then(onDone, (e: unknown) => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusy(false));
  };
  const { left } = useStore();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { if (!published) listRecent().then(setRecent, () => setRecent([])); }, [published]);
  const again = () => run(async () => {
    if (store.parked) await store.resume();
    else if (!published && recent[0]) await openProject(recent[0]);
  }, onOpened);
  const canContinue = left !== "" && (published || store.parked || recent.length > 0);
  const cont = canContinue && <button className="btn primary continue" onClick={again}>Continue {left}</button>;
  const pick = (a: Action) => { setAction(a); setError(""); };
  if (published) {
    return (
      <div className="start">
        <PaletteMenu className="pal-top" />
        <div className="logo big">k<span>g</span></div>
        <div className="actions">
          {cont || <button className="btn primary" onClick={onOpened}>Open published project</button>}
          {cont && <button className="btn" onClick={onOpened}>Open published project</button>}
          <label className="btn">
            Import .zip
            <input type="file" accept=".zip,application/zip" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) run(() => importZipInBrowser(file), onOpened);
            }} />
          </label>
          <button className="btn" onClick={() => run(newInBrowser, onOpened)}>New project</button>
        </div>
        {error && <div className="start-error">{error}</div>}
      </div>
    );
  }
  return (
    <div className="start">
      <PaletteMenu className="pal-top" />
      <div className="logo big">k<span>g</span></div>
      {cont && <div className="actions">{cont}</div>}
      <div className="actions">
        <button className={"btn" + (action === "new" ? " on" : "")} onClick={() => pick("new")}>New project</button>
        <button className={"btn" + (action === "open" ? " on" : "")} onClick={() => pick("open")}>Open project</button>
        <button className={"btn" + (action === "import" ? " on" : "")} onClick={() => pick("import")}>Import .zip</button>
      </div>
      {error && <div className="start-error">{error}</div>}
      <div className={"start-panel" + (busy ? " busy" : "")}>
        {action === "new" ? <NewProject onDone={onOpened} run={run} /> : action === "import" ? <ImportProject onDone={onOpened} run={run} /> : <OpenProject onDone={onOpened} run={run} />}
      </div>
    </div>
  );
}
