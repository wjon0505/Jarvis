// jarvis-kit: generic adaptation of the recall index's storage from a production multi-agent setup; real values replaced with placeholders.
/**
 * db.mjs: the recall index file, its permissions and its schema.
 *
 * The index holds transcript text, so it lives OUTSIDE the repository (config `indexDir`): directory
 * 0700, every file 0600, never committed, never copied to another machine. `process.umask(0o077)` at
 * module load makes every file SQLite creates (journal, temp) born 0600.
 *
 * Engine: Node's built-in `node:sqlite` (Node 22.5+; FTS5 included). No npm package.
 *   · docs   one row per unit: source, path, locator (`:line` or `@byte`), key, date, session, agent,
 *            cwd, byte range, and the REDACTED text
 *   · fts    FTS5 over (source, key, text), tokenizer unicode61 with tokenchars '-_' so ids such as
 *            REQ-0042 and snake_case names are whole tokens
 *   · tri    FTS5 trigram over text, for substring queries; docs.in_tri mirrors membership
 *   · files  size, mtime and bytes indexed per file, for incremental updates
 *   · redactions (counts per kind, never values), meta
 * Keyword only, no embeddings: cheap, local, explainable. Measure misses before adding vectors.
 */
import { mkdirSync, chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

process.umask(0o077);

export const INDEX_FILE = 'recall.sqlite';
export const TOKENIZER = "unicode61 tokenchars '-_'";

let sqliteMod = null;
async function sqlite() {
  if (!sqliteMod) {
    // node:sqlite prints an ExperimentalWarning on first import; keep it out of every query's output.
    const prior = process.listeners('warning');
    process.removeAllListeners('warning');
    process.on('warning', (w) => {
      if (w && w.name === 'ExperimentalWarning' && /SQLite/.test(String(w.message))) return;
      for (const l of prior) l(w);
    });
    sqliteMod = await import('node:sqlite');
  }
  return sqliteMod;
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}

export function tightenPerms(dir) {
  if (!existsSync(dir)) return;
  chmodSync(dir, 0o700);
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isFile()) chmodSync(p, 0o600);
  }
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS files(
  path TEXT PRIMARY KEY, source TEXT NOT NULL, size INTEGER NOT NULL, mtime_ms INTEGER NOT NULL,
  bytes_indexed INTEGER NOT NULL DEFAULT 0, docs INTEGER NOT NULL DEFAULT 0, indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS docs(
  id INTEGER PRIMARY KEY, source TEXT NOT NULL, path TEXT NOT NULL, locator TEXT NOT NULL,
  key TEXT NOT NULL DEFAULT '', date TEXT, session TEXT, agent TEXT, cwd TEXT,
  start INTEGER, end INTEGER, in_tri INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS docs_path ON docs(path);
CREATE INDEX IF NOT EXISTS docs_key ON docs(key);
CREATE INDEX IF NOT EXISTS docs_source_date ON docs(source, date);
CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(source, key, text, content='docs', content_rowid='id', tokenize="${TOKENIZER}");
CREATE VIRTUAL TABLE IF NOT EXISTS tri USING fts5(text, content='docs', content_rowid='id', tokenize='trigram');
CREATE TABLE IF NOT EXISTS redactions(kind TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
`;

/** Open (and with `create`, initialise) the index at dir/name. Refuses when absent and not creating. */
export async function openIndex({ dir, name = INDEX_FILE, create = false, build = false }) {
  const { DatabaseSync } = await sqlite();
  ensureDir(dir);
  const file = join(dir, name);
  if (!existsSync(file) && !create) {
    const err = new Error(`no recall index at ${file}. Build it first: node recall.mjs --build`);
    err.code = 'NO_INDEX';
    throw err;
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = TRUNCATE');
  db.exec(`PRAGMA synchronous = ${build ? 'OFF' : 'NORMAL'}`);
  db.exec('PRAGMA temp_store = MEMORY');
  if (create) db.exec(SCHEMA);
  tightenPerms(dir);
  return db;
}

export function getMeta(db, k) {
  const r = db.prepare('SELECT v FROM meta WHERE k = ?').get(k);
  return r ? r.v : null;
}
export function setMeta(db, k, v) {
  db.prepare('INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v));
}
export function indexBytes(dir, name = INDEX_FILE) {
  const f = join(dir, name);
  return existsSync(f) ? statSync(f).size : 0;
}
