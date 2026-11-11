# Markdown notes

A note is a plain Markdown file in the notes folder.

`[[name]]` links to another note by its file name, ignoring case, so `[[Graph]]` finds `graph.md`. `[[name|text]]` shows other text. The first line after the title is shown on the note's card.

Links are found with a small helper. A sketch of the idea in TypeScript:

```ts
function links(md: string): string[] {
  const found = [...md.matchAll(/\[\[([^\]|#]+)/g)];
  return [...new Set(found.map((m) => m[1].trim()))];
}
```

A new note starts with its title only, or from `template.md` if the project has one. See [[canvas-format]] for how notes appear on a canvas.
