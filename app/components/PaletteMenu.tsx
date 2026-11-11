import { useEffect, useRef, useState } from "react";
import { applyTheme, currentTheme, type Mode, PALETTES, type Theme, writeTheme } from "../theme";

// A round swatch button that opens the palette list and Light / Dark.
export function PaletteMenu({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const choose = (next: Theme) => { setTheme(next); applyTheme(next); writeTheme(next); };
  return (
    <div className={`pal ${className}`} ref={box}>
      <button className="pal-btn" title="Colours" aria-label="Colours" onClick={() => setOpen(!open)}>
        <span className="sw2" data-palette={theme.palette} data-mode={theme.mode} />
      </button>
      {open && (
        <div className="pal-pop">
          {PALETTES.map((p) => (
            <button key={p.id} className={"opt" + (p.id === theme.palette ? " on" : "")} onClick={() => choose({ ...theme, palette: p.id })}>
              <span className="sw2" data-palette={p.id} data-mode={theme.mode} />
              {p.name}
            </button>
          ))}
          <div className="switch">
            {(["light", "dark"] as Mode[]).map((m) => (
              <button key={m} className={m === theme.mode ? "on" : ""} onClick={() => choose({ ...theme, mode: m })}>
                {m === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
