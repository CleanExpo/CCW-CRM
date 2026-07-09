# Course pack (print / PDF deliverable)

`ccw-truckmount-operator-course.html` is the **single, self-contained, print-ready course
pack** — it assembles Module 02 (Safety Certificate) and Module 03 Units 3.1–3.6 into one
CCW-branded document with a cover, table of contents, and the Unit 3.6 verification gate up
front.

## Use
- Open the HTML in any browser → **Cmd/Ctrl-P → Save as PDF** for the print edition (A4,
  paginated per module, running margins).
- It is fully self-contained (inline CSS + inlined CCW logo, no external fetches) and
  theme-aware (light/dark).

## Regenerate
The HTML is generated from the sibling `../0*.md` module files:

```
node docs/training/restoration-manual/course-pack/build-pack.js
```

`build-pack.js` is a dependency-free Markdown→HTML converter (headings, tables, task lists,
blockquotes, links, emphasis) plus the branded template. Re-run it whenever the source
modules change. Branding pulls `public/brand/ccw-logo-mark.svg` and the `--brand-*` palette
convention.

> Every ⚠ CONFIRM flag and "confirm against unit manual" caveat is preserved verbatim — no
> safety setpoint is rendered as fact.
