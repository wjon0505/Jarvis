// jarvis-kit: generic adaptation of the recall index's markdown splitter from a production multi-agent setup; real values replaced with placeholders.
/**
 * units.mjs: structure-aware splitting of markdown into index units.
 *
 * One unit is what a search hit points at, so the split follows the document's own structure:
 *   · split "rows":      every table row whose first cell starts with the file's idPattern (or, with
 *                        no idPattern, every data row, keyed by its first cell) is one unit; prose
 *                        between tables is chunked under its heading. Fits a backlog or a ledger.
 *   · split "sections":  every heading whose title STARTS with an id is one unit, including deeper
 *                        sub-headings that carry no id. Fits a decision log.
 *   · split "headings":  one unit per heading section (every other doc).
 * Long units are split on paragraph boundaries into parts sharing the key. `line` is 1-based, so a
 * hit prints as `file:line`.
 */

const MAX_UNIT_CHARS = 6000;
const MAX_ROW_CHARS = 12000;
const ISO = '(\\d{4}-[01]\\d-[0-3]\\d)';
const DATE_RE = new RegExp(`\\b${ISO}\\b`);

/** The unit's date: one written in a heading as `(YYYY-MM-DD,` / `| YYYY-MM-DD |`, else the first ISO date, else the fallback. */
export function dateOf(text, fallback) {
  const nl = text.indexOf('\n');
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  const headed = new RegExp(`\\(${ISO}[,)]`).exec(firstLine) || new RegExp(`\\|\\s*${ISO}\\s*\\|`).exec(firstLine);
  if (headed) return headed[1];
  const m = DATE_RE.exec(text);
  return m ? m[1] : fallback;
}

function splitLong(text, startLine) {
  if (text.length <= MAX_UNIT_CHARS) return [{ text, line: startLine }];
  const parts = [];
  let buf = []; let bufChars = 0; let bufLine = startLine; let lineNo = startLine;
  const flush = () => { if (buf.length) parts.push({ text: buf.join('\n'), line: bufLine }); buf = []; bufChars = 0; };
  for (const l of text.split('\n')) {
    const blank = l.trim() === '';
    if (bufChars + l.length + 1 > MAX_UNIT_CHARS && (blank || bufChars > MAX_UNIT_CHARS * 0.6)) {
      flush();
      bufLine = lineNo + (blank ? 1 : 0);
      if (blank) { lineNo += 1; continue; }
    }
    if (buf.length === 0) bufLine = lineNo;
    buf.push(l.length > MAX_ROW_CHARS ? `${l.slice(0, MAX_ROW_CHARS)} …[truncated]` : l);
    bufChars += l.length + 1;
    lineNo += 1;
  }
  flush();
  return parts;
}

function heading(line) {
  const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
  return m ? { level: m[1].length, title: m[2] } : null;
}
const isDelimiterRow = (l) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const isTableRow = (l) => /^\|.*\|\s*$/.test(l);
const plainKey = (s) => s.replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();

export function headingUnits(text) {
  const out = [];
  let key = '(top)'; let buf = []; let bufLine = 1;
  const flush = () => {
    const body = buf.join('\n');
    if (body.trim() !== '') for (const p of splitLong(body, bufLine)) out.push({ key, line: p.line, text: p.text });
    buf = [];
  };
  text.split('\n').forEach((l, i) => {
    const h = heading(l);
    if (h) { flush(); key = plainKey(h.title).slice(0, 160); bufLine = i + 1; buf = [l]; }
    else { if (buf.length === 0) bufLine = i + 1; buf.push(l); }
  });
  flush();
  return out;
}

/** Row-keyed tables: `keyOf(firstCell)` returns a key or null. */
function rowUnits(text, keyOf) {
  const lines = text.split('\n');
  const out = [];
  let sectionTitle = ''; let sectionKey = '(top)'; let buf = []; let bufLine = 1;
  const flush = () => {
    const body = buf.join('\n');
    if (body.trim() !== '') for (const p of splitLong(body, bufLine)) out.push({ key: sectionKey, line: p.line, text: p.text });
    buf = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    const h = heading(l);
    if (h) { flush(); sectionTitle = plainKey(h.title); sectionKey = sectionTitle.slice(0, 160); bufLine = i + 1; buf = [l]; continue; }
    const isHeaderRow = isTableRow(l) && isDelimiterRow(lines[i + 1] ?? '');
    let key = null;
    if (isTableRow(l) && !isDelimiterRow(l) && !isHeaderRow) {
      const cells = l.slice(1).split(/(?<!\\)\|/);
      key = cells.length >= 3 ? keyOf(cells[0]) : null;
    }
    if (key) {
      flush();
      const row = l.length > MAX_ROW_CHARS ? `${l.slice(0, MAX_ROW_CHARS)} …[truncated]` : l;
      out.push({ key, line: i + 1, text: sectionTitle ? `${sectionTitle}\n${row}` : row });
      bufLine = i + 2;
      continue;
    }
    if (buf.length === 0) bufLine = i + 1;
    buf.push(l);
  }
  flush();
  return out;
}

export function idRowUnits(text, idPattern) {
  const re = new RegExp(`^\\s*[*_\`~]*(${idPattern.source})`);
  return rowUnits(text, (cell) => { const m = re.exec(cell); return m ? m[1] : null; });
}

export function firstCellRowUnits(text) {
  return rowUnits(text, (cell) => {
    const k = plainKey(cell);
    if (!k || /^(request|asked|status|note|id|#|row)$/i.test(k)) return null;
    return k.slice(0, 120);
  });
}

/**
 * A heading whose title starts with an id opens a unit; it ends at the next id heading or the next
 * heading of the same or a shallower level. A deeper heading without an id stays inside it.
 */
export function sectionUnits(text, idPattern) {
  const re = new RegExp(`^[\\s*_\`~]*(${idPattern.source})\\b`);
  const out = [];
  let cur = null;
  const close = () => {
    if (!cur) return;
    const body = cur.lines.join('\n');
    if (body.trim() !== '') for (const p of splitLong(body, cur.line)) out.push({ key: cur.key, line: p.line, text: p.text });
    cur = null;
  };
  text.split('\n').forEach((l, i) => {
    const h = heading(l);
    if (!h) { if (!cur) cur = { key: '(top)', line: i + 1, level: 0, keyed: false, lines: [] }; cur.lines.push(l); return; }
    const id = re.exec(h.title);
    if (!id && cur && cur.keyed && h.level > cur.level) { cur.lines.push(l); return; }
    close();
    cur = { key: id ? id[1] : plainKey(h.title).slice(0, 160), line: i + 1, level: h.level, keyed: Boolean(id), lines: [l] };
  });
  close();
  return out;
}

/** Dispatch on the file's keyed settings (null for a plain doc). */
export function unitsForMarkdown(text, keyed) {
  if (!keyed || keyed.split === 'headings') return headingUnits(text);
  if (keyed.split === 'sections') return keyed.idPattern ? sectionUnits(text, keyed.idPattern) : headingUnits(text);
  return keyed.idPattern ? idRowUnits(text, keyed.idPattern) : firstCellRowUnits(text);
}
