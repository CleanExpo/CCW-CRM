#!/usr/bin/env node
// Dependency-free builder: assembles the CCW Truck-Mount Operator Course markdown
// into a single self-contained, print/PDF-ready branded HTML pack.
const fs = require('fs');
const path = require('path');

const MAN = path.join(__dirname, "..");
const OUTDIR = __dirname;
const OUT = path.join(OUTDIR, 'ccw-truckmount-operator-course.html');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// slug for anchors
const slugged = new Set();
function slug(t) {
  let s = t.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  let b = s, i = 2; while (slugged.has(s)) { s = b + '-' + i++; }
  slugged.add(s); return s;
}

// inline: bold, italic, code, links, keep ⚠ emoji
function inline(t) {
  // escape first
  t = esc(t);
  // inline code
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
    const safe = url.replace(/"/g, '%22');
    const internal = url.startsWith('#');
    return `<a href="${safe}"${internal ? '' : ' target="_blank" rel="noopener"'}>${txt}</a>`;
  });
  // bold (non-greedy so it can wrap nested *italic*)
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic (single * not adjacent to another) — runs after bold consumed all **
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}

function isBlockStart(l) {
  return /^\s*\d+\.\s+/.test(l) || /^\s*[-*]\s+/.test(l) || /^#{1,6}\s/.test(l) ||
         /^>/.test(l) || /^---+\s*$/.test(l) || /^\s*\|.*\|\s*$/.test(l);
}

function tableRow(line) {
  // split on | but not escaped; trim outer
  let cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  return cells;
}

// Convert one markdown doc to HTML sections. Returns {html, headings:[{level,text,id}]}
function mdToHtml(md, fileKey) {
  const lines = md.split('\n');
  const out = [];
  const headings = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];

    // blank
    if (/^\s*$/.test(line)) { i++; continue; }

    // horizontal rule
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // heading
    let h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = slug(fileKey + '-' + text);
      if (level <= 3) headings.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++; continue;
    }

    // blockquote (collect consecutive > lines)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      const inner = mdToHtml(buf.join('\n'), fileKey).html;
      out.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    // table: current line has |, next line is separator |---|
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
      const header = tableRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        rows.push(tableRow(lines[i])); i++;
      }
      let t = '<div class="tbl"><table><thead><tr>' +
        header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows) {
        t += '<tr>' + header.map((_, ci) => `<td>${inline(r[ci] || '')}</td>`).join('') + '</tr>';
      }
      t += '</tbody></table></div>';
      out.push(t);
      continue;
    }

    // task list / unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, ''); i++;
        // absorb soft-wrapped continuation lines
        while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) { item += ' ' + lines[i].trim(); i++; }
        const task = item.match(/^\[([ xX])\]\s+(.*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === 'x';
          items.push(`<li class="task"><span class="box">${checked ? '&#10003;' : ''}</span>${inline(task[2])}</li>`);
        } else {
          items.push(`<li>${inline(item)}</li>`);
        }
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\.\s+/, ''); i++;
        while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) { item += ' ' + lines[i].trim(); i++; }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // paragraph (collect until blank or block starter)
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,6}\s|>|\s*[-*]\s|\s*\d+\.\s|---+\s*$)/.test(lines[i]) &&
           !(/\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]))) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), headings };
}

// ---- assemble ----
const logo = fs.readFileSync(path.join(__dirname, "../../../../public/brand/ccw-logo-mark.svg"), "utf8").trim();

// order + display titles
const parts = [
  { file: '02-truckmount-safety-certificate.md', key: 'm02', part: 'Part A — Compliance' },
  { file: '03-truckmount-operator-course.md', key: 'm03', part: 'Part B — Operator Course' },
  { file: '03.1-au-configurations-and-specs.md', key: 'u31', part: 'Part B — Operator Course' },
  { file: '03.2-safe-operating-procedures.md', key: 'u32', part: 'Part B — Operator Course' },
  { file: '03.3-storage-transport-road-safety.md', key: 'u33', part: 'Part B — Operator Course' },
  { file: '03.4-maintenance-and-servicing.md', key: 'u34', part: 'Part B — Operator Course' },
  { file: '03.5-image-catalogue.md', key: 'u35', part: 'Part B — Operator Course' },
  { file: '03.6-assessment-and-signoff.md', key: 'u36', part: 'Part B — Operator Course' },
];

let sections = '';
let toc = [];
for (const p of parts) {
  const md = fs.readFileSync(path.join(MAN, p.file), 'utf8');
  const { html, headings } = mdToHtml(md, p.key);
  sections += `<section class="module" id="${p.key}">${html}</section>`;
  // TOC: use h1 + h2
  const h1 = headings.find(h => h.level === 1);
  if (h1) toc.push({ level: 1, text: h1.text, id: h1.id, part: p.part });
  headings.filter(h => h.level === 2).forEach(h => toc.push({ level: 2, text: h.text, id: h.id }));
}

// build TOC grouped by part
let tocHtml = '';
let lastPart = '';
for (const t of toc) {
  if (t.level === 1) {
    if (t.part && t.part !== lastPart) { tocHtml += `<li class="toc-part">${esc(t.part)}</li>`; lastPart = t.part; }
    tocHtml += `<li class="toc-1"><a href="#${t.id}">${inline(t.text)}</a></li>`;
  } else {
    tocHtml += `<li class="toc-2"><a href="#${t.id}">${inline(t.text)}</a></li>`;
  }
}

const today = process.env.PACK_DATE || 'July 2026';

const css = `
:root{--pri:hsl(221 83% 45%);--pri-d:hsl(224 76% 33%);--sec:hsl(262 83% 55%);--acc:hsl(173 70% 34%);
--ink:#16202e;--muted:#5a6b7f;--line:#e2e8f0;--bg:#fff;--soft:#f6f9fc;--warn-bg:#fff7ed;--warn-bd:#fdba74;--warn-ink:#9a3412;}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#e8eef6;--muted:#9fb0c3;--line:#26313f;--bg:#0f1620;--soft:#141d29;--warn-bg:#2a1c0e;--warn-bd:#7c4a1e;--warn-ink:#fdba74;}}
:root[data-theme=dark]{--ink:#e8eef6;--muted:#9fb0c3;--line:#26313f;--bg:#0f1620;--soft:#141d29;--warn-bg:#2a1c0e;--warn-bd:#7c4a1e;--warn-ink:#fdba74;}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.62 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.wrap{max-width:860px;margin:0 auto;padding:0 28px 80px;}
a{color:var(--pri);text-decoration:none;border-bottom:1px solid transparent}
a:hover{border-bottom-color:currentColor}
code{background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:.05em .4em;font:.86em ui-monospace,SFMono-Regular,Menlo,monospace}
h1,h2,h3,h4{line-height:1.22;font-weight:700;letter-spacing:-.01em}
h1{font-size:1.9rem;margin:0 0 .5em;color:var(--pri-d)}
h2{font-size:1.32rem;margin:1.9em 0 .5em;padding-bottom:.28em;border-bottom:2px solid var(--line)}
h3{font-size:1.08rem;margin:1.4em 0 .35em;color:var(--sec)}
h4{font-size:.98rem;margin:1.1em 0 .3em}
p{margin:.55em 0}
ul,ol{margin:.5em 0 .5em;padding-left:1.35em}
li{margin:.22em 0}
li.task{list-style:none;margin-left:-1.1em;display:flex;gap:.55em;align-items:flex-start}
li.task .box{flex:0 0 auto;width:1.05em;height:1.05em;margin-top:.18em;border:1.5px solid var(--muted);border-radius:3px;color:var(--acc);font-size:.8em;line-height:1em;text-align:center;font-weight:700}
blockquote{margin:1em 0;padding:.7em 1em;background:var(--warn-bg);border:1px solid var(--warn-bd);border-left:4px solid var(--warn-bd);border-radius:8px;color:var(--warn-ink)}
blockquote p{margin:.35em 0}
blockquote strong{color:var(--warn-ink)}
hr{border:0;border-top:1px solid var(--line);margin:1.6em 0}
.tbl{overflow-x:auto;margin:1em 0;border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{text-align:left;padding:.5em .7em;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--soft);font-weight:700;color:var(--pri-d);border-bottom:2px solid var(--line)}
tr:last-child td{border-bottom:0}
.module{padding-top:.5em}
/* cover */
.cover{min-height:calc(100vh - 20px);display:flex;flex-direction:column;justify-content:center;text-align:center;padding:40px 0}
.cover .logo{width:82px;height:82px;margin:0 auto 22px}
.cover .kicker{letter-spacing:.22em;text-transform:uppercase;font-size:.8rem;color:var(--acc);font-weight:700;margin-bottom:.6em}
.cover h1{font-size:2.6rem;border:0;color:var(--pri-d);margin:.1em 0 .2em}
.cover .sub{font-size:1.15rem;color:var(--muted);max-width:34ch;margin:.3em auto 1.4em}
.cover .meta{font-size:.85rem;color:var(--muted);margin-top:1em}
.badge{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.3em 1em;font-size:.8rem;color:var(--muted);margin:.25em}
.gate{background:var(--warn-bg);border:1px solid var(--warn-bd);border-radius:12px;padding:18px 20px;margin:20px 0}
.gate h2{border:0;margin-top:0;color:var(--warn-ink)}
.toc{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:16px 22px}
.toc ul{list-style:none;padding:0;margin:0}
.toc .toc-part{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);font-weight:700;margin:1em 0 .3em}
.toc .toc-1 a{font-weight:700}
.toc .toc-2{margin-left:1.1em}
.toc .toc-2 a{color:var(--muted);font-size:.9rem}
.docfoot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
@media print{
  @page{size:A4;margin:16mm 14mm 18mm;}
  body{font-size:10.5pt;color:#000;background:#fff}
  .wrap{max-width:none;padding:0}
  a{color:#0b4bb3;border:0}
  .no-print{display:none}
  .cover{min-height:auto;height:auto;page-break-after:always;justify-content:flex-start;padding-top:22mm}
  .toc{page-break-after:always;background:#fff}
  .module{page-break-before:always}
  #m02{page-break-before:avoid}
  h2,h3,h4{page-break-after:avoid}
  tr,li,blockquote,.tbl{page-break-inside:avoid}
  th{background:#eef2f7 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  blockquote{background:#fff7ed !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`;

const html = `<div class="wrap">
<div class="no-print" style="text-align:right;font-size:.8rem;color:var(--muted);padding-top:12px">Tip: press <strong>Cmd/Ctrl-P → Save as PDF</strong> for the print edition.</div>

<header class="cover">
  <div class="logo">${logo}</div>
  <div class="kicker">Carpet Cleaners Warehouse · Training</div>
  <h1>Truck-Mount Operator Course</h1>
  <div class="sub">HydraMaster &amp; Sapphire Scientific · Australian configuration</div>
  <div>
    <span class="badge">Standards-sourced</span>
    <span class="badge">Australianised</span>
    <span class="badge">Assessment &amp; sign-off included</span>
  </div>
  <div class="meta">Compiled ${esc(today)} · Training material — not legal advice and not a substitute for the manufacturer's manual or a licensed practitioner.</div>
</header>

<section class="gate">
  <h2>How to use this pack — read first</h2>
  <p>This pack contains <strong>Part A — the Manufacturer's Truck-Mount Safety Certificate</strong> (Australian regulatory compliance) and <strong>Part B — the six-unit Operator Course</strong>.</p>
  <p>Every safety-critical setpoint (water temperature, working pressure, RPM, service intervals, torque) is <strong>model- and engine-specific</strong>, and several compliance points are flagged <strong>⚠ CONFIRM</strong>. <strong>This is training reference, not fact for a specific machine, until Unit 3.6 "Gate A" is completed</strong> against the actual unit + engine manual and the operator's State. No operator is signed off unproven, and no ⚠ item is taught as settled until verified.</p>
</section>

<nav class="toc">
  <h2 style="margin-top:0;border:0">Contents</h2>
  <ul>${tocHtml}</ul>
</nav>

${sections}

<div class="docfoot">
  <p><strong>Related:</strong> Module 01 — Dehumidifier Deployment: Contractor Responsibilities &amp; Risk Management is a separate module in the CCW Restoration Training Manual (duty of care and secondary-damage prevention for water-removal equipment).</p>
  <p>Sources are listed at the foot of each unit — manufacturer service/owner manuals (Sapphire 370 SS #49-038, 454 SS; HydraMaster Boxxer 423S, Titan 875), Australian primary authorities (NHVR, NTC, Safe Work Australia, state transport &amp; water authorities), a WA/NIOSH carbon-monoxide fatality investigation, and live Australian distributor pages including ccwonline.com.au. Manufacturer images referenced in Unit 3.5 remain their owners' copyright; licence before commercial reuse.</p>
  <p>© Carpet Cleaners Warehouse. Training material — not legal advice.</p>
</div>
</div>`;

// theme toggle (light/dark, small)
const themeJs = `<script>(function(){try{var b=document.createElement('button');b.textContent='◐';b.title='Toggle light/dark';b.className='no-print';b.style.cssText='position:fixed;bottom:16px;right:16px;z-index:9;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--ink);cursor:pointer;font-size:16px';b.onclick=function(){var r=document.documentElement;var cur=r.getAttribute('data-theme');var next=cur==='dark'?'light':(cur==='light'?'dark':(matchMedia('(prefers-color-scheme:dark)').matches?'light':'dark'));r.setAttribute('data-theme',next);};document.body.appendChild(b);}catch(e){}})();</script>`;

const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CCW Truck-Mount Operator Course</title><style>${css}</style></head><body>${html}${themeJs}</body></html>`;

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUT, doc);
console.log('TOC entries:', toc.length, '| sections:', parts.length);
