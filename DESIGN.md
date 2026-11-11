# kg design

kg is a tool for hand-built knowledge graphs of a codebase. People and agents
write Markdown notes and connect them in a graph. People can also build the
graph visually in a web page. The page runs locally (edit) and on GitHub
Pages (read only).

## Files

A kg project is a folder:

```
map/
  overview.canvas
  page.canvas
  notes/graph.md
  template.md          (optional)
```

- `.canvas` files use the JSON Canvas format (jsoncanvas.org). Nodes are
  `file` (a note), `text`, `link` or `group`. Edges have an optional label and
  can point at groups. Unknown fields are kept, so files stay readable by
  Obsidian.
- Notes are plain Markdown. `[[name]]` links to another note.
- A new note starts with its title only. If the project has a `template.md`,
  new notes start from it instead, with `{{title}}` filled in. No note types.

## Hierarchy

Two ways, nothing more:

- Groups: a box around cards on one canvas, one level of nesting.
- Sub-map cards: a `file` card that points at another `.canvas`. Clicking it
  opens that canvas; a breadcrumb in the top bar shows the path
  (`overview > page > editor`) and each part goes back up. Any depth.
  The breadcrumb follows how you got there; opening a canvas from the left
  list starts a fresh path.

## Media

- Maths: LaTeX in notes with KaTeX, inline `$...$` and display `$$...$$`.
- Code: fenced code blocks with syntax highlighting (Python, C, C++, TS,
  bash, JSON at least).
- Diagrams: ```mermaid blocks drawn as diagrams, library loaded only when a
  note has one (step 4).
- Notes: Markdown images `![alt](assets/x.png)`, paths relative to the note.
  Video and audio files written the same way play inline.
- Canvas: file cards can be images, video or PDF, not only notes. Link cards
  open a web page.
- In the editor, pasting or dropping an image saves it under `assets/` next to
  the note and inserts the link.
- Media files are listed in the manifest and go into zip exports and
  `kg build`.

## Start screen

Shown when no project is open, in the same minimal style as the rest:
the kg logo, and three actions.

- Continue <name>: shown at the top when a project was just left, to go back to it. The top bar has a visible Projects button for leaving; with unsaved changes it asks Save / Discard / Cancel.
- New project: a name and a folder; runs the same code as `kg init`.
- Open project: a folder path, with a list of recent projects.
- Import .zip: a zip file, a name and a folder; the files are written to the new folder and it opens.

`kg serve` with no folder starts here; `kg serve <folder>` opens that folder
directly. The top bar gets a way back to the start screen (click the logo).
On GitHub Pages the start screen offers the published project, Import .zip,
and New project in the browser (kept in memory, leaves by export).
A browser cannot be given a folder path by a picker, so locally the folder
is typed or picked from a simple folder list served by `kg serve`.

## Page layout

- Top bar: project name and breadcrumb of canvases, search, View/Edit switch, Save (when the project is writable).
- Left: list of canvases and notes.
- Middle: the graph. Groups as coloured boxes, notes as cards (title and one
  line), text cards, labelled edges. Pan, zoom, fit, minimap.
- Right: the selected note, three tabs.
  - Note: the full note, rendered. When the project is writable it is always
    edited in place, as rendered text (live preview), in View and in Edit:
    typing `# `, `- `, backticks or `[[` turns into formatting. When the
    project is read only, the note is only shown.
  - Links: what the note points to and what points to it.
  - JSON: the canvas entry of the node and its edges.
  - A Focus button hides the graph so the note fills the page; it brings the
    graph back when clicked again. Clicking a note in the left list keeps
    focus mode on.
- The View/Edit switch only controls the graph. In Edit mode cards and
  edges can be dragged, added and deleted, and the edit toolbar shows. In
  View mode the graph cannot be changed; clicking a card opens its note, and
  a sub-map card opens its canvas. Save and undo work in both modes.
- Edit toolbar: add note, sub-map, text, group; delete. `+ Sub-map` creates a
  new empty canvas and a card pointing at it.
  Cards are dragged; edges are drawn from handles on the card sides.

## Running

- `kg serve [folder]`: local server that serves the page and writes files on
  Save. Editing is available only here.
- `kg build [folder] [--out dir]`: writes a static site for GitHub Pages, read only, into `<folder>/_site` by default. All URLs are relative, so it works under any sub-path.
- Later: `kg check` to compare a map with the code (for example with grimp).

## Import and export

- Export: a "..." menu in the top bar downloads the whole project as a
  `.zip` (canvases, notes, media, template.md, unsaved edits included), or
  the current note or canvas.
- Import: a `.zip` from the start screen, or single `.md`, `.canvas` and
  media files added to the open project (file picker in the "..." menu, or
  drag onto the left list). Hidden files, `__MACOSX`, unsafe paths and
  unreadable text are skipped; a single top folder is unwrapped; the cap is
  200 MB.
- This works in every mode, also on GitHub Pages: an imported project lives
  in the browser, can be edited there, and leaves again by export. Locally,
  `kg serve` writes an imported zip to a new project folder. A project in the
  browser shows "In browser" in the top bar and the page warns before it is
  closed with changes not exported.
- No accounts and no cloud storage. Syncing is left to the folder the files
  live in (git, Google Drive app, Dropbox).

## Stack

Vite + TypeScript + React, React Flow (xyflow) for the graph, a Markdown
editor with live preview (for example Milkdown or TipTap with Markdown
round-trip). The CLI is a small Node script shipped in the same npm package.

## Open

- Cards show title and one line; full text only in the side panel.

## Palettes

Five palettes: Porcelain, Mist, Garden,
Sorbet, Ink. Each has a light and a dark version. A small menu in the top bar
picks the palette and Light / Dark. The default is always Porcelain, light
(not following the system setting). The choice is remembered in the browser.
