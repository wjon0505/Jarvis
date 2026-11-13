#!/usr/bin/env node
// jarvis-kit: generic adaptation of a local recall index CLI from a production multi-agent setup; real values replaced with placeholders.
/**
 * recall.mjs: ask a local index before grepping megabytes of docs or gigabytes of transcripts.
 *
 *   node recall.mjs "<query>" [--source S] [--since YYYY-MM-DD] [--limit N] [--id REQ-0042] [--json]
 *   node recall.mjs --show <unit-id>     the stored (redacted, capped) text of one hit
 *   node recall.mjs --build              full build (heavy IO: hold the test slot)
 *   node recall.mjs --update             incremental: changed files and appended transcripts only
 *   node recall.mjs --stats              sizes, units per source, redaction counts per kind
 *   node recall.mjs --self-test          fixture build in a temp dir; never touches the real index
 *   every mode: [--config path] (default $RECALL_CONFIG, else ./recall.config.json)
 *
 * WHY. A long-running agent that has been compacted rarely loses a fact; it loses the knowledge that
 * the fact exists, and then re-derives something already decided. Recall answers "where was this
 * said?" from docs, the memory folder, scratch reports and every transcript, and each hit points at
 * `file:line` or `transcript@byte-offset`, so the reader opens exactly that place and nothing more.
 *
 * Query tips: ids and shas are whole tokens; `2a7c41f*` is a prefix; `"two words"` is a phrase.
 * When no unit carries every term the search falls back to any term, then to a trigram substring,
 * and says which it used. Output is small on purpose: 8 hits of at most 400 characters.
 *
 * Exit: 0 hits (or action done) · 1 no hits · 2 refused (bad flag, no config, no index, self-test failure).
 * Requires Node 22.5+ (built-in node:sqlite). No npm dependencies.
 */
import { fileURLToPath } from 'node:url';
import { join, relative, basename } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, renameSync, unlinkSync, statSync, realpathSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { openIndex, INDEX_FILE, indexBytes, tightenPerms } from './lib/db.mjs';
import { enumerateCorpus } from './lib/corpus.mjs';
import { runIndex } from './lib/index.mjs';
import { search, showDoc, stats } from './lib/search.mjs';

const VALUE_FLAGS = ['source', 'since', 'limit', 'id', 'show', 'config'];
const BOOLEAN_FLAGS = ['build', 'update', 'stats', 'self-test', 'json', 'help', 'quiet'];
const USAGE = 'recall.mjs "<query>" [--source S] [--since YYYY-MM-DD] [--limit N] [--id ID] [--json] | --show ID | --build | --update | --stats | --self-test   [--config path]';

class ArgError extends Error {}

/** Strict flag parser: an unknown flag is refused rather than read as part of the query. */
export function parseArgs(argv) {
  const flags = {}; const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (!tok.startsWith('--') || tok === '--') { positional.push(tok); continue; }
    const [name, inline] = tok.slice(2).split(/=(.*)/s);
    if (VALUE_FLAGS.includes(name)) {
      const v = inline ?? argv[++i];
      if (v === undefined) throw new ArgError(`--${name} needs a value`);
      flags[name] = v;
    } else if (BOOLEAN_FLAGS.includes(name)) {
      if (inline !== undefined) throw new ArgError(`--${name} takes no value`);
      flags[name] = true;
    } else throw new ArgError(`unrecognised option --${name}`);
  }
  return { flags, query: positional.join(' ').trim() };
}

const home = (p) => (p.startsWith(homedir()) ? `~${p.slice(homedir().length)}` : p);

export function formatHit(h, i, repoRoot) {
  const path = h.path.startsWith(repoRoot) ? relative(repoRoot, h.path) : home(h.path);
  const where = h.source === 'transcripts' ? `${basename(path)}${h.locator}` : `${path}${h.locator}`;
  const who = h.source === 'transcripts' ? `  (session ${String(h.session ?? '').slice(0, 8)}${h.agent ? ` agent ${h.agent.slice(0, 8)}` : ''})` : '';
  return `${String(i + 1).padStart(2)}. [${h.source}] ${where}  ${h.date ?? ''}  ${h.key}${who}  #${h.id}\n    ${h.snippet}`;
}

function printStats(db, dir) {
  const s = stats(db);
  const lines = [`recall index: ${home(join(dir, INDEX_FILE))} (${(indexBytes(dir) / 1048576).toFixed(1)} MB)`];
  lines.push(`files: ${s.files.n} · corpus bytes: ${(s.files.bytes / 1048576).toFixed(1)} MB`);
  for (const r of s.perSource) lines.push(`  ${r.source.padEnd(12)} ${String(r.units).padStart(8)} units in ${r.files} files`);
  lines.push(`redactions (counts only): ${s.redactions.length ? s.redactions.map((r) => `${r.kind}=${r.count}`).join(', ') : 'none'}`);
  for (const k of ['last_build_at', 'last_update_at']) if (s.meta[k]) lines.push(`${k}: ${s.meta[k]}`);
  const skipped = JSON.parse(s.meta.skipped ?? '[]');
  if (skipped.length) {
    lines.push(`NOT INDEXED (${skipped.length} files, named so the blind spot is visible):`);
    for (const k of skipped.slice(0, 12)) lines.push(`  ${k.reason}: ${home(k.path)} (${k.detail ?? ''})`);
    if (skipped.length > 12) lines.push(`  … ${skipped.length - 12} more (--stats --json lists all)`);
  }
  console.log(lines.join('\n'));
}

async function build(cfg, log) {
  const tmpName = `${INDEX_FILE}.building`;
  if (existsSync(join(cfg.indexDir, tmpName))) unlinkSync(join(cfg.indexDir, tmpName));
  const db = await openIndex({ dir: cfg.indexDir, name: tmpName, create: true, build: true });
  const corpus = enumerateCorpus(cfg);
  log(`building over ${corpus.files.length} files (${corpus.skipped.length} skipped)`);
  const totals = runIndex(db, { mode: 'build', corpus, repoRoot: cfg.repoRoot, log });
  db.close();
  renameSync(join(cfg.indexDir, tmpName), join(cfg.indexDir, INDEX_FILE)); // readers never see a half-built index
  tightenPerms(cfg.indexDir);
  return totals;
}

async function update(cfg, log) {
  const db = await openIndex({ dir: cfg.indexDir, create: false, build: true });
  const totals = runIndex(db, { mode: 'update', corpus: enumerateCorpus(cfg), repoRoot: cfg.repoRoot, log });
  db.close();
  tightenPerms(cfg.indexDir);
  return totals;
}

function summary(t, dir) {
  const counts = Object.entries(t.counts).sort().map(([k, v]) => `${k}=${v}`).join(', ');
  return [
    `done in ${(t.elapsedMs / 1000).toFixed(1)} s · ${t.files} files (${t.unchanged} unchanged, ${t.reindexed} reindexed, ${t.appended} appended, ${t.removed} removed)`,
    `units +${t.docsAdded} / -${t.docsRemoved} · ${(t.bytesRead / 1048576).toFixed(1)} MB read · index ${(indexBytes(dir) / 1048576).toFixed(1)} MB`,
    `redactions this run (counts only): ${counts || 'none'}`,
    t.skipped.length ? `NOT INDEXED: ${t.skipped.length} files; --stats names them` : null,
  ].filter(Boolean).join('\n');
}

export async function main(argv) {
  let flags; let query;
  try { ({ flags, query } = parseArgs(argv)); } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    console.error(`ARGUMENTS REFUSED: ${e.message}\n  usage: ${USAGE}`);
    return 2;
  }
  if (flags.help) { console.log(USAGE); return 0; }
  if (flags['self-test']) {
    const { runSelfTest } = await import('./self-test.mjs');
    return runSelfTest({ log: (l) => console.log(l) });
  }
  let cfg;
  try { cfg = loadConfig(flags.config); } catch (e) { console.error(`REFUSED: ${e.message}`); return 2; }
  const log = flags.quiet ? () => {} : (l) => console.error(l);
  if (flags.build) { console.log(summary(await build(cfg, log), cfg.indexDir)); return 0; }
  if (flags.update) { console.log(summary(await update(cfg, log), cfg.indexDir)); return 0; }

  let db;
  try { db = await openIndex({ dir: cfg.indexDir, create: false }); } catch (e) {
    if (e.code === 'NO_INDEX') { console.error(`REFUSED: ${e.message}`); return 2; }
    throw e;
  }
  try {
    if (flags.stats) {
      if (flags.json) console.log(JSON.stringify({ ...stats(db), indexBytes: indexBytes(cfg.indexDir) }, null, 1));
      else printStats(db, cfg.indexDir);
      return 0;
    }
    if (flags.show !== undefined) {
      const d = showDoc(db, flags.show);
      if (!d) { console.error(`no unit #${flags.show}`); return 1; }
      const path = d.path.startsWith(cfg.repoRoot) ? relative(cfg.repoRoot, d.path) : home(d.path);
      console.log(`[${d.source}] ${path}${d.locator}  ${d.date ?? ''}  ${d.key}${d.session ? `  session ${d.session}` : ''}${d.agent ? ` agent ${d.agent}` : ''}`);
      console.log(d.text);
      return 0;
    }
    if (!query && !flags.id) { console.error(`REFUSED: no query.\n  usage: ${USAGE}`); return 2; }
    if (flags.source && !cfg.sources.includes(flags.source)) { console.error(`REFUSED: --source must be one of ${cfg.sources.join('|')}`); return 2; }
    if (flags.since && !/^\d{4}-\d{2}-\d{2}$/.test(flags.since)) { console.error('REFUSED: --since must be YYYY-MM-DD'); return 2; }
    const limit = flags.limit === undefined ? 8 : Number(flags.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) { console.error('REFUSED: --limit must be an integer 1..200'); return 2; }
    const res = search(db, { query, source: flags.source ?? null, since: flags.since ?? null, limit, id: flags.id ?? null, idRe: cfg.idRe });
    if (flags.json) console.log(JSON.stringify({ query, mode: res.mode, ms: res.ms, hits: res.hits }, null, 1));
    else {
      for (const [i, h] of res.hits.entries()) console.log(formatHit(h, i, cfg.repoRoot));
      const st = statSync(join(cfg.indexDir, INDEX_FILE));
      console.log(`${res.hits.length} hit(s) · ${res.mode} · ${res.ms} ms · index ${st.mtime.toISOString().slice(0, 16)}Z · \`--show <#id>\` prints a unit in full`);
    }
    return res.hits.length ? 0 : 1;
  } finally {
    db.close();
  }
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`recall: ${e && e.stack ? e.stack : e}`); process.exit(2); });
}
