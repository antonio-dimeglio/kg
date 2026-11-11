import { useEffect, useRef } from "react";
import { resolveLink } from "../../src/notes";
import "../live/live.css";
import { LiveEditor } from "../live/liveEditor";
import type { Project } from "../project";
import type { Target } from "../relations";
import { store } from "../useStore";

interface Props {
  notePath: string;
  text: string;
  project: Project;
  onOpen: (t: Target) => void;
}

// The note as live-preview Markdown: edited in place, saved through the store.
export function NoteEditor({ notePath, text, project, onOpen }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<LiveEditor | null>(null);
  const latest = useRef({ project, onOpen, text });
  latest.current = { project, onOpen, text };

  useEffect(() => {
    if (!host.current) return;
    const editor = new LiveEditor({
      parent: host.current,
      doc: latest.current.text,
      notePath,
      notes: () => latest.current.project.notes,
      resolveNote: (name) => resolveLink(name, Object.keys(latest.current.project.notes)),
      onChange: (md) => store.setFile(notePath, md),
      onOpenNote: (path) => latest.current.onOpen({ kind: "note", path }),
      isTaken: (p) => latest.current.project.manifest.assets.includes(p) || store.getState().dirty.has(p),
      saveAsset: (p, blob) => store.setFile(p, blob),
    });
    live.current = editor;
    const off = store.onBeforeSave(() => editor.flush());
    return () => {
      off();
      editor.destroy();
      live.current = null;
    };
  }, [notePath]);

  useEffect(() => {
    if (live.current && !live.current.pending) live.current.setText(text);
  }, [text]);

  // Clicking the empty space around the text puts the cursor at the end.
  return (
    <div className="note-editor" ref={host}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          live.current?.view.focus();
          live.current?.view.dispatch({ selection: { anchor: live.current.view.state.doc.length } });
        }
      }} />
  );
}
