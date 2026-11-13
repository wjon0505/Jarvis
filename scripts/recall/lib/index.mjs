// jarvis-kit: generic adaptation of the recall index builder from a production multi-agent setup; real values replaced with placeholders.
/**
 * index.mjs: build and incrementally update the recall index.
 *
 * `--build` indexes the whole corpus into a fresh file and renames it over the old one, so a reader
 * never sees a half-built index. `--update` re-indexes only files whose size or mtime changed,
 * resumes JSONL transcripts from the last indexed byte offset (a transcript is append-only; one that
 * SHRANK is re-indexed from byte 0), and drops the units of files that are gone.
 *
 * Every unit passes through `redact()` before insertion. Redaction counts are kept per kind:
 * counts only, never values.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { unitsForMarkdown, dateOf } from './units.mjs';
import { iterateJsonl, unitFromRecord, idsFromPath } from './transcripts.mjs';
import { redact, mergeCounts } from './redact.mjs';
import { setMeta, getMeta } from './db.mjs';

/** A transcript tail with no newline is consumed once the file has been quiet this long. */
const TAIL_SETTLE_MS = 10 * 60 * 1000;

/** Trigram membership: every non-transcript unit, and transcript units that are not purely tool output. */
export function wantsTrigram(source, unit) {
  return source !== 'transcripts' || !unit.isToolResultOnly;
}

function prepared(db) {
  return {
    insertDoc: db.prepare('INSERT INTO docs(source, path, locator, key, date, session, agent, cwd, start, end, in_tri, text) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'),
    insertFts: db.prepare('INSERT INTO fts(rowid, source, key, text) VALUES(?,?,?,?)'),
    insertTri: db.prepare('INSERT INTO tri(rowid, text) VALUES(?,?)'),
    docsOfPath: db.prepare('SELECT id, source, key, in_tri, text FROM docs WHERE path = ?'),
    deleteFts: db.prepare("INSERT INTO fts(fts, rowid, source, key, text) VALUES('delete', ?, ?, ?, ?)"),
    deleteTri: db.prepare("INSERT INTO tri(tri, rowid, text) VALUES('delete', ?, ?)"),
    deleteDocs: db.prepare('DELETE FROM docs WHERE path = ?'),
    upsertFile: db.prepare(
      'INSERT INTO files(path, source, size, mtime_ms, bytes_indexed, docs, indexed_at) VALUES(?,?,?,?,?,?,?) ' +
        'ON CONFLICT(path) DO UPDATE SET source=excluded.source, size=excluded.size, mtime_ms=excluded.mtime_ms, ' +
        'bytes_indexed=excluded.bytes_indexed, docs=excluded.docs, indexed_at=excluded.indexed_at',
    ),
    deleteFile: db.prepare('DELETE FROM files WHERE path = ?'),
    allFiles: db.prepare('SELECT path, source, size, mtime_ms, bytes_indexed, docs FROM files'),
    bumpRedaction: db.prepare('INSERT INTO redactions(kind, count) VALUES(?, ?) ON CONFLICT(kind) DO UPDATE SET count = count + excluded.count'),
  };
}

function removeDocsOfPath(p, path) {
  const rows = p.docsOfPath.all(path);
  for (const r of rows) {
    p.deleteFts.run(r.id, r.source, r.key, r.text);
    if (r.in_tri) p.deleteTri.run(r.id, r.text);
  }
  p.deleteDocs.run(path);
  return rows.length;
}

function addDoc(p, d) {
  const id = Number(p.insertDoc.run(d.source, d.path, d.locator, d.key ?? '', d.date ?? null, d.session ?? null, d.agent ?? null, d.cwd ?? null, d.start ?? null, d.end ?? null, d.tri ? 1 : 0, d.text).lastInsertRowid);
  p.insertFts.run(id, d.source, d.key ?? '', d.text);
  if (d.tri) p.insertTri.run(id, d.text);
  return id;
}

const isoDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function indexTextFile(p, file) {
  const counts = {};
  const units = unitsForMarkdown(readFileSync(file.path, 'utf8'), file.kind === 'md' ? file.keyed ?? null : null);
  for (const u of units) {
    const r = redact(u.text);
    mergeCounts(counts, r.counts);
    addDoc(p, { source: file.source, path: file.path, locator: `:${u.line}`, key: redact(u.key).text, date: dateOf(u.text, isoDate(file.mtimeMs)), text: r.text, tri: wantsTrigram(file.source, u) });
  }
  return { docs: units.length, counts };
}

function indexTranscript(p, file, fromOffset) {
  const counts = {};
  const ids = idsFromPath(file.path);
  const it = iterateJsonl(file.path, fromOffset, { consumeTail: Date.now() - file.mtimeMs > TAIL_SETTLE_MS });
  let n = 0;
  let step = it.next();
  while (!step.done) {
    const { start, end, line } = step.value;
    let rec = null;
    try { rec = JSON.parse(line); } catch { rec = null; } // a torn line is skipped; the offset still advances
    const u = rec ? unitFromRecord(rec) : null;
    if (u) {
      const r = redact(u.text);
      mergeCounts(counts, r.counts);
      addDoc(p, {
        source: 'transcripts', path: file.path, locator: `@${start}`, key: u.key,
        date: u.ts ? u.ts.slice(0, 10) : isoDate(file.mtimeMs),
        session: u.session ?? ids.session, agent: u.agent ?? ids.agent, cwd: u.cwd,
        start, end, text: r.text, tri: wantsTrigram('transcripts', u),
      });
      n += 1;
    }
    step = it.next();
  }
  return { docs: n, counts, bytesIndexed: step.value };
}

/** Run a build (every file) or an update (changed files only). Returns the summary the CLI prints. */
export function runIndex(db, { mode, corpus, repoRoot, log = () => {}, commitEvery = 64 * 1024 * 1024 }) {
  const t0 = Date.now();
  const p = prepared(db);
  const known = new Map(mode === 'update' ? p.allFiles.all().map((r) => [r.path, r]) : []);
  const present = new Set(corpus.files.map((f) => f.path));
  const totals = { files: 0, unchanged: 0, reindexed: 0, appended: 0, removed: 0, docsAdded: 0, docsRemoved: 0, bytesRead: 0, counts: {} };
  const now = new Date().toISOString();

  db.exec('BEGIN');
  let sinceCommit = 0;
  for (const [path] of known) {
    if (present.has(path)) continue;
    totals.docsRemoved += removeDocsOfPath(p, path);
    p.deleteFile.run(path);
    totals.removed += 1;
  }
  let lastLog = Date.now();
  corpus.files.forEach((file, i) => {
    totals.files += 1;
    const prev = known.get(file.path);
    let action = 'reindex';
    let fromOffset = 0;
    if (prev && prev.size === file.size && prev.mtime_ms === file.mtimeMs) action = 'unchanged';
    else if (prev && file.kind === 'jsonl' && file.size >= prev.bytes_indexed && prev.bytes_indexed > 0) { action = 'append'; fromOffset = prev.bytes_indexed; }
    if (action === 'unchanged') totals.unchanged += 1;
    else {
      let res;
      if (action === 'reindex') {
        if (prev) totals.docsRemoved += removeDocsOfPath(p, file.path);
        res = file.kind === 'jsonl' ? indexTranscript(p, file, 0) : indexTextFile(p, file);
        totals.reindexed += 1;
      } else {
        res = indexTranscript(p, file, fromOffset);
        totals.appended += 1;
      }
      const bytesIndexed = file.kind === 'jsonl' ? res.bytesIndexed : file.size;
      p.upsertFile.run(file.path, file.source, file.size, file.mtimeMs, bytesIndexed, (action === 'append' ? prev.docs : 0) + res.docs, now);
      totals.docsAdded += res.docs;
      totals.bytesRead += file.kind === 'jsonl' ? bytesIndexed - fromOffset : file.size;
      mergeCounts(totals.counts, res.counts);
      sinceCommit += file.size;
      if (sinceCommit >= commitEvery) { db.exec('COMMIT'); db.exec('BEGIN'); sinceCommit = 0; }
    }
    if (Date.now() - lastLog > 15000 || i === corpus.files.length - 1) {
      lastLog = Date.now();
      log(`  ${i + 1}/${corpus.files.length} files · +${totals.docsAdded} units · ${(totals.bytesRead / 1048576).toFixed(0)} MB read · ${relative(repoRoot, file.path).slice(0, 60)}`);
    }
  });
  for (const [kind, c] of Object.entries(totals.counts)) p.bumpRedaction.run(kind, c);
  setMeta(db, mode === 'build' ? 'last_build_at' : 'last_update_at', now);
  setMeta(db, 'last_run', JSON.stringify({ mode, at: now, elapsedMs: Date.now() - t0, ...totals }));
  const skipped = corpus.skipped.length ? corpus.skipped : mode === 'update' ? JSON.parse(getMeta(db, 'skipped') ?? '[]') : [];
  setMeta(db, 'skipped', JSON.stringify(skipped));
  db.exec('COMMIT');
  if (mode === 'build') db.exec("INSERT INTO fts(fts) VALUES('optimize')");
  totals.elapsedMs = Date.now() - t0;
  totals.skipped = skipped;
  return totals;
}
