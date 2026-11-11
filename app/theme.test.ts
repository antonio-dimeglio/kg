import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, readTheme, THEME_KEY, writeTheme } from "./theme";

function memory(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[THEME_KEY, initial]]);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("stored theme", () => {
  it("falls back to Porcelain light when nothing is stored", () => {
    expect(readTheme(memory())).toEqual(DEFAULT_THEME);
  });

  it("reads back what was written", () => {
    const s = memory();
    writeTheme({ palette: "ink", mode: "dark" }, s);
    expect(readTheme(s)).toEqual({ palette: "ink", mode: "dark" });
  });

  it("falls back on invalid values", () => {
    expect(readTheme(memory("not json"))).toEqual(DEFAULT_THEME);
    expect(readTheme(memory('{"palette":"neon","mode":"dark"}'))).toEqual(DEFAULT_THEME);
    expect(readTheme(memory('{"palette":"mist","mode":"blue"}'))).toEqual(DEFAULT_THEME);
  });

  it("survives a storage that throws", () => {
    const bad = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
    expect(readTheme(bad)).toEqual(DEFAULT_THEME);
    expect(() => writeTheme(DEFAULT_THEME, bad)).not.toThrow();
  });
});
