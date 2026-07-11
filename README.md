# Definition Lists for Obsidian

Adds [Pandoc / Markdown Extra style](https://pandoc.org/MANUAL.html#definition-lists)
definition lists to Obsidian, which it doesn't render natively. Works in both
**reading view** and **Live Preview**.

## Syntax

```markdown
Apple
: A fruit that grows on trees.

Term
: First definition.
: Second definition.

Multi-line
: A definition can lazily wrap onto
  the next line and stays one definition.
```

In reading view each block becomes a proper `<dl>` with `<dt>` (terms) and
`<dd>` (definitions). In Live Preview the same lines are styled (bold terms,
indented definitions) while staying fully editable — the `: ` marker is hidden
unless your cursor is on that line.

### Rules

- A **term** is a plain line that heads the block or is directly followed by a definition.
- A **definition** is a line beginning with `: ` (colon + space).
- A plain line that follows a definition (and isn't itself a term/definition) is
  treated as a **lazy continuation** of that definition.
- Leave a blank line between separate definition lists.
- The block must open with a term to be treated as a definition list.

## Building

```bash
npm install
npm run build   # produces main.js
```

For live development:

```bash
npm run dev
```

## Installing manually

Copy `main.js`, `manifest.json`, and `styles.css` into your vault at:

```
<vault>/.obsidian/plugins/markdown-definition-lists/
```

Then enable **Definition Lists** in Settings → Community plugins.

## Limitations

- Live Preview styles the lines (bold term, indented definition, hidden marker)
  but keeps the source text, rather than rendering true `<dl>` HTML — that's the
  editable-mode tradeoff. Reading view produces real `<dl>` markup.
- Live Preview scans the whole note on each edit/cursor move, which is fine for
  normal notes but not optimized for very large files.

## License

[The Unlicense](LICENSE) — released into the public domain. Do whatever you want with it.
