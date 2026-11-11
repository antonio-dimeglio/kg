// The palette and light/dark choice. The colours live in palettes.css; this
// file keeps the choice, remembers it in the browser and sets the attributes.

export const PALETTES = [
  { id: "porcelain", name: "Porcelain" },
  { id: "mist", name: "Mist" },
  { id: "garden", name: "Garden" },
  { id: "sorbet", name: "Sorbet" },
  { id: "ink", name: "Ink" },
] as const;

export type Palette = (typeof PALETTES)[number]["id"];
export type Mode = "light" | "dark";
export interface Theme { palette: Palette; mode: Mode }

export const DEFAULT_THEME: Theme = { palette: "porcelain", mode: "light" };
export const THEME_KEY = "kg-theme";
export const THEME_EVENT = "kg-theme";

type Store = Pick<Storage, "getItem" | "setItem">;

function isTheme(v: unknown): v is Theme {
  if (typeof v !== "object" || v === null) return false;
  const { palette, mode } = v as Record<string, unknown>;
  return PALETTES.some((p) => p.id === palette) && (mode === "light" || mode === "dark");
}

export function readTheme(store?: Store): Theme {
  try {
    const raw = (store ?? localStorage).getItem(THEME_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return isTheme(v) ? { palette: v.palette, mode: v.mode } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(theme: Theme, store?: Store): void {
  try {
    (store ?? localStorage).setItem(THEME_KEY, JSON.stringify(theme));
  } catch {
    // The choice just lasts until the page is closed.
  }
}

// Sets the attributes on <html> and tells the parts that draw by themselves
// (the diagrams) to redraw.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset["palette"] = theme.palette;
  root.dataset["mode"] = theme.mode;
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function currentTheme(): Theme {
  const { palette, mode } = document.documentElement.dataset;
  const t = { palette, mode };
  return isTheme(t) ? t : DEFAULT_THEME;
}
