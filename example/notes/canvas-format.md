# Canvas format

A canvas is a JSON Canvas file, the same format Obsidian uses.

It holds nodes and edges. A node is a `file` (a note, an image or another canvas), a `text` card, a `link` card or a `group`. Fields kg does not know are kept when it saves, so the file stays readable by other tools. Notes are described in [[markdown-notes]].

This is what a note card looks like in the file:

```json
{
  "id": "graph",
  "type": "file",
  "file": "notes/graph.md",
  "x": 70,
  "y": 85,
  "width": 200,
  "height": 64
}
```

An edge has `fromNode`, `toNode` and an optional `label`. The Links tab of [[note-editor]] shows the same entry for the selected card on its JSON tab.
