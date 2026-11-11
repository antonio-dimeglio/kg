import { useEffect, useRef, useState } from "react";
import { addFiles, exportFile, exportZip } from "../transfer";

interface Props {
  canvasPath: string;
  notePath?: string;
  writable: boolean;
}

// One small menu for what leaves the project (downloads) and what is added.
export function FileMenu({ canvasPath, notePath, writable }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const run = (job: () => Promise<unknown>) => {
    setOpen(false);
    job().then(() => setMessage(""), (e: unknown) => setMessage(e instanceof Error ? e.message : String(e)));
  };
  return (
    <div className="pal file-menu" ref={box}>
      <button className="btn" title="Download and add files" aria-label="Files" onClick={() => setOpen(!open)}>&hellip;</button>
      {message && <div className="menu-note" onClick={() => setMessage("")}>{message}</div>}
      {open && (
        <div className="pal-pop">
          <button className="opt" onClick={() => run(exportZip)}>Download project (.zip)</button>
          <button className="opt" onClick={() => run(() => exportFile(canvasPath))}>Download this canvas</button>
          {notePath && <button className="opt" onClick={() => run(() => exportFile(notePath))}>Download this note</button>}
          {writable && <button className="opt" onClick={() => pick.current?.click()}>Add files</button>}
        </div>
      )}
      <input ref={pick} type="file" multiple hidden onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        run(async () => { const m = await addFiles(files); if (m) throw new Error(m); });
      }} />
    </div>
  );
}
