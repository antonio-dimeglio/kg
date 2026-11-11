# CLI

The command line tool is `kg`, with three commands.

`kg serve` opens the page and saves edits to a folder, `kg build` writes a read only site, and `kg init` makes an empty project.

```bash
kg init my-map
kg serve my-map
kg build my-map --out site
```

Without a folder, `kg serve` starts at the start screen. The built site works under any sub-path, so it can be published on GitHub Pages. Saving is described in [[save-flow]].
