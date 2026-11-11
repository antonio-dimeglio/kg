# kg

kg is a small tool for hand-built knowledge graphs. You write Markdown notes
and connect them on a canvas, either by editing the files or visually in the
browser. The files stay plain text, so people and agents can both read and
edit them.

Demo: https://antonio-dimeglio.github.io/kg/

## Features

- Graphs stored as [JSON Canvas](https://jsoncanvas.org) files, notes as
  Markdown with `[[name]]` links.
- Groups, and sub-map cards that open another canvas.
- Notes edited in place with live preview: LaTeX (KaTeX), code highlighting,
  Mermaid diagrams, images, video and audio.
- Five colour palettes, light and dark.
- Import and export as `.zip`. No accounts.

## Install

kg needs Node.js 20 or newer.

```
npm install -g https://github.com/antonio-dimeglio/kg/releases/latest/download/kg.tgz
```

## Use

```
kg init my-map
kg serve my-map
```

`kg serve` opens the page at http://localhost:5173 and saves edits to the
folder. Without a folder it starts on the project screen.

```
kg build my-map --out site
```

`kg build` writes a read-only static site that any web server can host.

In Chrome or Edge the website can also open a folder from your computer
directly, for example a folder in Google Drive for desktop. Use Open folder on
the start screen; edits are saved straight to the files in that folder.

## Files

A project is a folder:

```
my-map/
  overview.canvas
  notes/tracking.md
  notes/assets/figure.png
  template.md          (optional, starting text for new notes)
```

`.canvas` files follow the JSON Canvas format, so they also open in Obsidian.
A `file` node points at a note, an image or another `.canvas` (a sub-map).

## Publish a map on GitHub Pages

Put the map in a repository, enable Pages with "GitHub Actions" as the
source, and add `.github/workflows/pages.yml`:

```yaml
name: Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g https://github.com/antonio-dimeglio/kg/releases/latest/download/kg.tgz
      - run: kg build . --out _site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Develop

```
npm install
npm run dev
npm test
```

## License

MIT
