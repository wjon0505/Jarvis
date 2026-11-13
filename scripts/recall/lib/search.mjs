// jarvis-kit: generic adaptation of the recall index's search from a production multi-agent setup; real values replaced with placeholders.
/**
 * search.mjs: keyword search over the recall index.
 *
 * Ranking is BM25 (FTS5 `bm25()`, column weights key 6 : text 1) over a candidate pool, then three
 * adjustments, because raw BM25 over a corpus that is mostly transcript lines buries the doc that
 * actually answers the question under short tool-output records:
 *   · an id named in the query (config `idPatterns`) fetches the units KEYED by it directly and puts
 *     them first, whatever their BM25;
 *   · scratch copies carry a small penalty so the repository's own row outranks a lane's copy of it;
 *   · transcripts fill at most a quota of the answer (3 of 8) while any doc-tier unit remains;
 *     `--source transcripts` lifts the quota.
 *
 * The FTS5 expression is built here, never from raw user text: every term is quoted (so `REQ-0042`'s
 * `-` is not read as NOT), a trailing `*` makes a prefix query, and a "quoted phrase" stays one
 * term. Fallback order: all terms (AND), topped up with any term (OR) when fewer than `limit` units
 * carry every term, then a trigram substring of the longest term when nothing matched. The mode used
 * is reported with every result.
 */

const SCRATCH_PENALTY = 0.5;
const ID_BOOST = -1000;
const POOL = 400;

export function parseQuery(q, idRe = /^$/) {
  const terms = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const raw = (m[1] ?? m[2]).trim();
    if (!raw) continue;
    const prefix = m[2] !== undefined && raw.endsWith('*') && raw.length > 2;
    const text = (prefix ? raw.slice(0, -1) : raw).replace(/"/g, '');
    if (text) terms.push({ text, prefix, phrase: m[1] !== undefined });
  }
  return { terms, ids: terms.filter((t) => idRe.test(t.text)).map((t) => t.text.toUpperCase()) };
}

const quote = (s) => `"${s.replace(/"/g, '""')}"`;

export function ftsExpression(terms, { any = false } = {}) {
  const parts = terms.map((t) => `${quote(t.text)}${t.prefix ? '*' : ''}`);
  return parts.length ? `{key text}: (${parts.join(any ? ' OR ' : ' AND ')})` : null;
}

export const transcriptQuota = (limit) => Math.max(1, Math.ceil(limit * 0.375));
const COLS = 'd.id, d.source, d.path, d.locator, d.key, d.date, d.session, d.agent, d.cwd, d.start, d.end';

/** Returns { hits, mode, ms }; mode is and | and+or | or | trigram | none. */
export function search(db, { query = '', source = null, since = null, limit = 8, id = null, idRe = /^$/ } = {}) {
  const t0 = performance.now();
  const parsed = parseQuery(query, idRe);
  if (id) {
    const up = id.toUpperCase();
    if (!parsed.terms.some((t) => t.text.toUpperCase() === up)) parsed.terms.push({ text: up, prefix: false, phrase: true });
    if (!parsed.ids.includes(up)) parsed.ids.push(up);
  }
  if (parsed.terms.length === 0) return { hits: [], mode: 'none', ms: 0 };
  const filters = []; const args = [];
  if (source) { filters.push('d.source = ?'); args.push(source); }
  if (since) { filters.push('d.date >= ?'); args.push(since); }
  const where = filters.length ? ` AND ${filters.join(' AND ')}` : '';
  const seen = new Map();
  const add = (rows, via, expr) => { for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, { ...r, via, expr }); };
  const ftsRows = (expr) => db.prepare(`SELECT ${COLS}, bm25(fts, 0.0, 6.0, 1.0) AS score FROM fts JOIN docs d ON d.id = fts.rowid WHERE fts MATCH ?${where} ORDER BY score LIMIT ?`).all(expr, ...args, POOL);

  const andExpr = ftsExpression(parsed.terms);
  add(ftsRows(andExpr), 'fts', andExpr);
  let mode = seen.size ? 'and' : 'none';
  if (seen.size < limit && parsed.terms.length > 1) {
    const orExpr = ftsExpression(parsed.terms, { any: true });
    const before = seen.size;
    add(ftsRows(orExpr), 'fts', orExpr);
    if (seen.size > before) mode = before ? 'and+or' : 'or';
  }
  if (seen.size === 0) {
    const longest = [...parsed.terms].sort((a, b) => b.text.length - a.text.length)[0];
    if (longest && longest.text.length >= 3) {
      const triExpr = quote(longest.text);
      add(db.prepare(`SELECT ${COLS}, bm25(tri) AS score FROM tri JOIN docs d ON d.id = tri.rowid WHERE tri MATCH ?${where} ORDER BY score LIMIT ?`).all(triExpr, ...args, POOL), 'tri', triExpr);
      if (seen.size) mode = 'trigram';
    }
  }
  for (const up of parsed.ids) {
    const spellings = [...new Set([up, ...parsed.terms.filter((t) => t.text.toUpperCase() === up).map((t) => t.text)])];
    const rows = db.prepare(`SELECT ${COLS}, 0.0 AS score FROM docs d WHERE d.key IN (${spellings.map(() => '?').join(',')})${where} LIMIT 20`).all(...spellings, ...args);
    add(rows, 'key', andExpr);
    if (rows.length && mode === 'none') mode = 'and';
  }
  if (seen.size === 0) return { hits: [], mode: 'none', ms: Math.round((performance.now() - t0) * 10) / 10 };

  const ranked = [...seen.values()]
    .map((r) => ({ ...r, adjusted: r.score + (r.source === 'scratch' ? SCRATCH_PENALTY : 0) + (parsed.ids.includes(String(r.key).toUpperCase()) ? ID_BOOST : 0) }))
    .sort((a, b) => a.adjusted - b.adjusted);
  const quota = source === 'transcripts' ? limit : transcriptQuota(limit);
  const chosen = []; const heldBack = []; let transcripts = 0;
  for (const r of ranked) {
    if (chosen.length >= limit) break;
    if (r.source === 'transcripts') {
      if (transcripts >= quota) { heldBack.push(r); continue; }
      transcripts += 1;
    }
    chosen.push(r);
  }
  for (const r of heldBack) { if (chosen.length >= limit) break; chosen.push(r); }

  const snipFts = db.prepare("SELECT snippet(fts, 2, '[', ']', '…', 28) AS s FROM fts WHERE rowid = ? AND fts MATCH ?");
  const snipTri = db.prepare("SELECT snippet(tri, 0, '[', ']', '…', 28) AS s FROM tri WHERE rowid = ? AND tri MATCH ?");
  const hits = chosen.map((r) => {
    let snip = null;
    try { snip = (r.via === 'tri' ? snipTri : snipFts).get(r.id, r.expr)?.s ?? null; } catch { snip = null; }
    if (snip === null) snip = db.prepare('SELECT substr(text, 1, 400) AS s FROM docs WHERE id = ?').get(r.id)?.s ?? '';
    const { expr, via, adjusted, ...rest } = r;
    return { ...rest, snippet: String(snip ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) };
  });
  return { hits, mode, ms: Math.round((performance.now() - t0) * 10) / 10 };
}

export function showDoc(db, id) {
  return db.prepare('SELECT * FROM docs WHERE id = ?').get(Number(id)) ?? null;
}

export function stats(db) {
  return {
    perSource: db.prepare('SELECT source, COUNT(*) AS units, COUNT(DISTINCT path) AS files FROM docs GROUP BY source ORDER BY source').all(),
    files: db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM files').get(),
    redactions: db.prepare('SELECT kind, count FROM redactions ORDER BY kind').all(),
    meta: Object.fromEntries(db.prepare('SELECT k, v FROM meta').all().map((r) => [r.k, r.v])),
  };
}
