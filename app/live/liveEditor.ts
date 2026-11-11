import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { stem } from "../../src/notes";
import { assetTarget, imageName, pendingImages } from "./assets";
import { livePreview, wikiLinkAt } from "./decorations";

export interface LiveOptions {
  parent: HTMLElement;
  doc: string;
  notePath: string;
  // The current project notes (path -> text) and a lookup for [[names]].
  notes: () => Record<string, string>;
  resolveNote: (name: string) => string | undefined;
  onChange: (text: string) => void;
  onOpenNote: (path: string) => void;
  isTaken: (path: string) => boolean;
  saveAsset: (path: string, blob: Blob) => void;
}

const External = Annotation.define<boolean>();
const DEBOUNCE_MS = 300;

export class LiveEditor {
  readonly view: EditorView;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private opts: LiveOptions) {
    const lineSeparator = opts.doc.includes("\r\n") ? "\r\n" : undefined;
    this.view = new EditorView({
      parent: opts.parent,
      state: EditorState.create({
        doc: opts.doc,
        extensions: [
          ...(lineSeparator ? [EditorState.lineSeparator.of(lineSeparator)] : []),
          history(),
          keymap.of([...historyKeymap, ...defaultKeymap]),
          markdown({ base: markdownLanguage }),
          EditorView.lineWrapping,
          livePreview({ notePath: opts.notePath, notes: opts.notes, resolveNote: opts.resolveNote }),
          autocompletion({ override: [(c) => this.complete(c)], icons: false }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((t) => t.annotation(External))) this.schedule();
          }),
          EditorView.domEventHandlers({
            keydown: (e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") this.flush();
              return false;
            },
            blur: () => { this.flush(); return false; },
            mousedown: (e, view) => this.follow(e, view),
            paste: (e, view) => this.pasteImages(e.clipboardData?.files, e, view, view.state.selection.main.head),
            drop: (e, view) => this.pasteImages(e.dataTransfer?.files, e, view, view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head),
          }),
        ],
      }),
    });
  }

  get text(): string {
    return this.view.state.sliceDoc();
  }

  get pending(): boolean {
    return this.timer !== undefined;
  }

  // Shows new text from outside (reload, undo elsewhere). Does not count as an edit.
  setText(text: string): void {
    if (text === this.text) return;
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, annotations: External.of(true) });
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  flush(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.opts.onChange(this.text);
  }

  destroy(): void {
    this.flush();
    this.view.destroy();
  }

  private complete(c: CompletionContext) {
    const m = c.matchBefore(/\[\[[^\]\n]*/);
    if (!m) return null;
    const after = c.state.sliceDoc(c.pos, c.pos + 2);
    const closed = after === "]]";
    return {
      from: m.from + 2,
      options: Object.keys(this.opts.notes()).map((p) => ({
        label: stem(p),
        apply: closed ? stem(p) : `${stem(p)}]]`,
      })),
    };
  }

  // Cmd or Ctrl + click on a [[link]] opens the note.
  private follow(e: MouseEvent, view: EditorView): boolean {
    if (!(e.metaKey || e.ctrlKey)) return false;
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return false;
    const line = view.state.doc.lineAt(pos);
    const name = wikiLinkAt(line.text, pos - line.from);
    const path = name ? this.opts.resolveNote(name) : undefined;
    if (!path) return false;
    e.preventDefault();
    this.flush();
    this.opts.onOpenNote(path);
    return true;
  }

  private pasteImages(files: FileList | undefined, e: Event, view: EditorView, at: number): boolean {
    const images = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return false;
    e.preventDefault();
    const now = new Date();
    const links: string[] = [];
    const used = new Set<string>();
    for (const file of images) {
      const target = assetTarget(this.opts.notePath, imageName(file, now), (p) => used.has(p) || this.opts.isTaken(p));
      used.add(target.path);
      pendingImages.set(target.path, URL.createObjectURL(file));
      this.opts.saveAsset(target.path, file);
      links.push(target.link);
    }
    const insert = links.join("\n");
    view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length }, userEvent: "input.paste" });
    return true;
  }
}
