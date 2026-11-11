import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BaseEdge, ConnectionMode, EdgeLabelRenderer, getBezierPath, Handle, MiniMap, NodeResizer, Panel, Position, ReactFlow,
  ReactFlowProvider, useReactFlow, type Connection, type EdgeChange, type EdgeProps, type NodeChange, type NodeProps,
} from "@xyflow/react";
import type { Canvas } from "../../src/canvas";
import {
  addNode, connect, dragSet, MIN_CARD, MIN_GROUP, moveNodes, removeItems, setBox, setColor, setEdgeLabel, setGroupLabel,
  setText, snap, type Box,
} from "../canvasEdit";
import { mediaSrc } from "../live/assets";
import { toFlow, type CardData } from "../flow";
import type { Project } from "../project";
import { editor, store, useStore } from "../useStore";
import { EditContext } from "./editContext";
import { EditToolbar } from "./Toolbar";

const SIDES = [
  ["top", Position.Top], ["right", Position.Right], ["bottom", Position.Bottom], ["left", Position.Left],
] as const;

function Handles() {
  const { editing } = useContext(EditContext);
  return SIDES.map(([id, pos]) => <Handle key={id} id={id} type="source" position={pos} isConnectable={editing} />);
}

function Resizer({ id, selected, min }: { id: string; selected: boolean; min: { width: number; height: number } }) {
  const ctx = useContext(EditContext);
  if (!ctx.editing) return null;
  return (
    <NodeResizer isVisible={selected} minWidth={min.width} minHeight={min.height}
      onResizeEnd={(_e, p) => ctx.resizeEnd(id, { x: p.x, y: p.y, width: p.width, height: p.height })} />
  );
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function GroupNode({ id, data, selected }: NodeProps) {
  const d = data as CardData;
  const ctx = useContext(EditContext);
  const [edit, setEdit] = useState(false);
  const cancel = useRef(false);
  const border = { borderColor: `var(--b${d.color})` };
  const done = (v: string) => { setEdit(false); if (!cancel.current) ctx.setLabel(id, v); cancel.current = false; };
  return (
    <div className="group" style={{ background: `var(--g${d.color})`, ...border }}>
      <div className="gl" style={border} onDoubleClick={() => ctx.editing && setEdit(true)}>
        {edit ? (
          <input className="nodrag" autoFocus defaultValue={d.node.label ?? ""} onBlur={(e) => done(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancel.current = true; e.currentTarget.blur(); } }} />
        ) : d.node.label}
      </div>
      <Resizer id={id} selected={selected} min={MIN_GROUP} />
      <Handles />
    </div>
  );
}

function CardNode({ id, data, selected }: NodeProps) {
  const d = data as CardData;
  const ctx = useContext(EditContext);
  const [edit, setEdit] = useState(false);
  const cancel = useRef(false);
  const { kind, title, mod, desc } = d.info;
  const cls = ["node", kind, selected ? "sel" : "", d.hit ? "hit" : "", d.dim ? "dim" : ""].join(" ");
  const file = d.node.file ?? "";
  let body;
  if (kind === "text" && edit) {
    body = (
      <textarea className="nodrag nowheel" autoFocus defaultValue={desc}
        onBlur={(e) => { setEdit(false); if (!cancel.current) ctx.setText(id, e.target.value); cancel.current = false; }}
        onKeyDown={(e) => { if (e.key === "Escape") { cancel.current = true; e.currentTarget.blur(); } }} />
    );
  } else if (kind === "text") body = <div onDoubleClick={() => ctx.editing && setEdit(true)}>{desc}</div>;
  else if (kind === "image") body = <img src={mediaSrc(file)} alt={title} draggable={false} />;
  else if (kind === "video") body = <video src={mediaSrc(file)} controls onPointerDown={stop} />;
  else if (kind === "pdf") body = <a href={mediaSrc(file)} target="_blank" rel="noopener noreferrer" onPointerDown={stop}>{title}</a>;
  else if (kind === "link") body = <a href={d.node.url} target="_blank" rel="noopener noreferrer" onPointerDown={stop}>{title}</a>;
  else if (kind === "map") body = <div className="t"><span className="tt" title={title}>{title}</span><small className="mapmark">map</small></div>;
  else body = (<><div className="t"><span className="tt" title={title}>{title}</span><small title={mod}>{mod}</small></div><div className="d">{desc}</div></>);
  return <div className={cls}><Resizer id={id} selected={selected} min={MIN_CARD} />{body}<Handles /></div>;
}

function KgEdge(p: EdgeProps) {
  const [path, lx, ly] = getBezierPath(p);
  const d = (p.data ?? {}) as { hot: boolean; label: string; arrow: boolean; editing?: boolean; onLabel?: (id: string, v: string) => void };
  const cls = "edge" + (d.hot ? " hot" : "");
  const cancel = useRef(false);
  return (
    <>
      <BaseEdge id={p.id} path={path} className={cls}
        markerEnd={d.arrow ? `url(#${d.hot ? "kg-arrow-hot" : "kg-arrow"})` : undefined} />
      {d.editing && (
        <EdgeLabelRenderer>
          <input className="elabel-edit nodrag nopan" autoFocus defaultValue={d.label}
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
            onBlur={(e) => { const c = cancel.current; cancel.current = false; d.onLabel?.(p.id, c ? d.label : e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancel.current = true; e.currentTarget.blur(); } }} />
        </EdgeLabelRenderer>
      )}
      {d.label && !d.editing && <text className={"elabel" + (d.hot ? " hot" : "")} x={lx} y={ly + 4} textAnchor="middle">{d.label}</text>}
    </>
  );
}

const nodeTypes = { card: CardNode, group: GroupNode };
const edgeTypes = { kg: KgEdge };

function Controls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="zoom">
      <button title="Zoom in" onClick={() => void zoomIn()}>+</button>
      <button title="Zoom out" onClick={() => void zoomOut()}>&minus;</button>
      <button title="Fit" onClick={() => void fitView({ padding: 0.05 })}>&#9635;</button>
    </Panel>
  );
}

// A canvas opened while the graph is hidden is fitted when it comes back.
function RefitOnShow({ focused }: { focused: boolean }) {
  const { fitView } = useReactFlow();
  const pending = useRef(focused);
  useEffect(() => {
    if (focused || !pending.current) return;
    pending.current = false;
    const t = setTimeout(() => void fitView({ padding: 0.05 }), 300);
    return () => clearTimeout(t);
  }, [focused, fitView]);
  return null;
}

interface Props {
  project: Project;
  canvas: Canvas;
  selected: string | null;
  query: string;
  focused: boolean;
  onSelect: (id: string) => void;
  onOpenCanvas: (path: string) => void;
}

function miniClass(n: { id: string; selected?: boolean; data: Record<string, unknown> }): string {
  const d = n.data as CardData;
  return n.selected ? "mm sel" : d.node.type === "group" ? `mm g${d.color}` : "mm";
}

type Over = Record<string, Partial<Box>>;

function FlowView({ project, canvas, canvasPath, selected, query, focused, onSelect, onOpenCanvas }: Props & { canvasPath: string }) {
  const { mode } = useStore();
  const writable = project.manifest.writable === true;
  const editing = writable && mode === "edit";
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const [selNodes, setSelNodes] = useState<Set<string>>(() => new Set(selected ? [selected] : []));
  const [selEdges, setSelEdges] = useState<Set<string>>(new Set());
  const [editEdge, setEditEdge] = useState<string | null>(null);
  const [over, setOver] = useState<Over>({});
  const lastNodeClick = useRef<{ id: string; at: number } | null>(null);
  const lastEdgeClick = useRef<{ id: string; at: number } | null>(null);
  const drag = useRef<Map<string, { x: number; y: number }> | null>(null);

  useEffect(() => { setSelNodes(new Set(selected ? [selected] : [])); }, [selected]);

  const edit = (fn: (c: Canvas) => Canvas) => editor.edit(canvasPath, fn);

  const api = useMemo(() => ({
    editing,
    setText: (id: string, text: string) => edit((c) => setText(c, id, text)),
    setLabel: (id: string, label: string) => edit((c) => setGroupLabel(c, id, label)),
    resizeEnd: (id: string, box: Box) => {
      edit((c) => setBox(c, id, box));
      setOver((o) => { const { [id]: _gone, ...rest } = o; return rest; });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [editing, canvasPath]);

  const center = () => {
    const r = wrap.current?.getBoundingClientRect();
    return rf.screenToFlowPosition(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 });
  };

  const select = (id: string) => { setSelNodes(new Set([id])); setSelEdges(new Set()); onSelect(id); };

  const remove = () => {
    if (selNodes.size + selEdges.size === 0) return;
    edit((c) => removeItems(c, [...selNodes], [...selEdges]));
    setSelNodes(new Set());
    setSelEdges(new Set());
  };

  useEffect(() => {
    if (!writable) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") { e.preventDefault(); void store.save(); return; }
      if (!editing) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (mod && key === "z") { e.preventDefault(); if (e.shiftKey) editor.redo(canvasPath); else editor.undo(canvasPath); }
      else if (mod && key === "y") { e.preventDefault(); editor.redo(canvasPath); }
      else if (key === "delete" || key === "backspace") { e.preventDefault(); remove(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onNodesChange = (changes: NodeChange[]) => {
    if (!editing) return;
    let sel: Set<string> | null = null;
    const patch: Over = {};
    for (const c of changes) {
      if (c.type === "select") {
        sel ??= new Set(selNodes);
        if (c.selected) sel.add(c.id); else sel.delete(c.id);
      } else if (c.type === "position" && c.position && c.dragging !== false) {
        patch[c.id] = { ...patch[c.id], x: c.position.x, y: c.position.y };
      } else if (c.type === "dimensions" && c.resizing && c.dimensions) {
        patch[c.id] = { ...patch[c.id], width: c.dimensions.width, height: c.dimensions.height };
      }
    }
    if (sel) {
      setSelNodes(sel);
      if (sel.size > 0) setSelEdges(new Set());
      const only = sel.size === 1 ? canvas.nodes.find((n) => sel.has(n.id)) : undefined;
      if (only && only.type !== "group") onSelect(only.id);
    }
    if (Object.keys(patch).length) {
      setOver((o) => {
        const next = { ...o };
        for (const [id, p] of Object.entries(patch)) next[id] = { ...next[id], ...p };
        return next;
      });
    }
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    if (!editing) return;
    const sel = new Set(selEdges);
    let touched = false;
    for (const c of changes) {
      if (c.type !== "select") continue;
      touched = true;
      if (c.selected) sel.add(c.id); else sel.delete(c.id);
    }
    if (touched) setSelEdges(sel);
  };

  const dragStart = (nodes: { id: string }[]) => {
    const ids = new Set(nodes.flatMap((n) => dragSet(canvas, n.id)));
    drag.current = new Map(canvas.nodes.filter((n) => ids.has(n.id)).map((n) => [n.id, { x: n.x, y: n.y }]));
  };

  const base = toFlow(canvas, project, editing ? null : selected, query);
  const flow = useMemo(() => {
    if (!editing) return base;
    const nodes = base.nodes.map((n) => {
      const o = over[n.id];
      const group = n.type === "group";
      return {
        ...n,
        selected: selNodes.has(n.id), selectable: true, draggable: true, connectable: true,
        dragHandle: group ? ".gl" : undefined,
        position: { x: o?.x ?? n.position.x, y: o?.y ?? n.position.y },
        width: o?.width ?? n.width, height: o?.height ?? n.height,
      };
    });
    const edges = base.edges.map((e) => {
      const d = e.data as { hot: boolean };
      return {
        ...e, selectable: true, selected: selEdges.has(e.id),
        data: { ...e.data, hot: d.hot || selEdges.has(e.id), editing: e.id === editEdge,
          onLabel: (id: string, v: string) => { edit((c) => setEdgeLabel(c, id, v)); setEditEdge(null); } },
      };
    });
    return { nodes, edges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, editing, over, selNodes, selEdges, editEdge]);

  const addExisting = (path: string, x: number, y: number) => {
    let id = "";
    edit((c) => { const r = addNode(c, { type: "file", file: path }, x, y); id = r.id; return r.canvas; });
    select(id);
  };

  return (
    <EditContext.Provider value={api}>
      <div ref={wrap} className={"flowwrap" + (editing ? " editing" : "")}>
        <ReactFlow
          nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose} connectionRadius={30}
          nodesDraggable={editing} nodesConnectable={editing} edgesFocusable={false}
          deleteKeyCode={null} elevateNodesOnSelect={false} zoomOnDoubleClick={!editing}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeDragStart={(_e, _n, nodes) => dragStart(nodes)}
          onNodeDrag={(_e, node, nodes) => {
            const start = drag.current, s = start?.get(node.id);
            if (!start || !s) return;
            const dragged = new Set(nodes.map((n) => n.id));
            const patch: Over = {};
            for (const [id, p] of start) if (!dragged.has(id)) patch[id] = { x: p.x + node.position.x - s.x, y: p.y + node.position.y - s.y };
            setOver((o) => ({ ...o, ...patch }));
          }}
          onNodeDragStop={(_e, node) => {
            const start = drag.current, s = start?.get(node.id);
            drag.current = null;
            if (start && s) edit((c) => moveNodes(c, [...start.keys()], snap(node.position.x) - s.x, snap(node.position.y) - s.y));
            setOver({});
          }}
          onConnect={(conn: Connection) => {
            let id = "";
            edit((c) => { const r = connect(c, conn); if (!r) return c; id = r.id; return r.canvas; });
            if (id) { setSelNodes(new Set()); setSelEdges(new Set([id])); }
          }}
          onEdgeClick={(_e, edge) => {
            // A selected edge is drawn again, which swallows the browser's own double click.
            const last = lastEdgeClick.current, now = Date.now();
            lastEdgeClick.current = { id: edge.id, at: now };
            if (editing && last?.id === edge.id && now - last.at < 450) setEditEdge(edge.id);
          }}
          onDragOver={(e) => { if (editing && e.dataTransfer.types.includes("application/kg-note")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
          onDrop={(e) => {
            const path = e.dataTransfer.getData("application/kg-note");
            if (!editing || !path) return;
            e.preventDefault();
            const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
            addExisting(path, p.x, p.y);
          }}
          fitView fitViewOptions={{ padding: 0.05 }} minZoom={0.2} maxZoom={2}
          onNodeClick={(_e, n) => {
            if (n.type === "group") return;
            const d = n.data as CardData;
            if (!editing) {
              if (d.info.kind === "map") onOpenCanvas(d.node.file ?? "");
              else onSelect(n.id);
              return;
            }
            // Selecting a card draws it again, which swallows the browser's own double click.
            const last = lastNodeClick.current, now = Date.now();
            lastNodeClick.current = { id: n.id, at: now };
            if (d.info.kind === "map" && last?.id === n.id && now - last.at < 450) onOpenCanvas(d.node.file ?? "");
          }}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap pannable zoomable nodeClassName={miniClass} nodeStrokeWidth={0} />
          <Controls />
          <RefitOnShow focused={focused} />
          {editing && (
            <EditToolbar project={project} canvasPath={canvasPath} canvas={canvas} selNodes={selNodes} selEdges={selEdges}
              center={center} onAdded={select} onDelete={remove}
              onColor={(id, color) => edit((c) => setColor(c, id, color))} />
          )}
        </ReactFlow>
      </div>
    </EditContext.Provider>
  );
}

export function Graph(props: Props & { canvasPath: string }) {
  return (
    <section id="stage">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          {[["kg-arrow", "var(--edge)"], ["kg-arrow-hot", "var(--accent)"]].map(([id, fill]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={fill} />
            </marker>
          ))}
        </defs>
      </svg>
      <ReactFlowProvider>
        <FlowView {...props} />
      </ReactFlowProvider>
    </section>
  );
}
