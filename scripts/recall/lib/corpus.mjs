// jarvis-kit: generic adaptation of the recall index's corpus enumeration from a production multi-agent setup; real values replaced with placeholders.
/**
 * corpus.mjs: which files the recall index covers, and which `source` each carries.
 *
 *   <keyed sources>  the files listed under `keyed` (a backlog, a decision log, a request ledger...)
 *   docs             docs.files and every *.md under docs.dirs
 *   memory           every *.md under memory.dirs, plus memory.files (a resume file, agent memory)
 *   scratch          every *.md / *.txt under scratch.dirs (lane reports and briefs)
 *   transcripts      every *.jsonl at the top of transcripts.dirs and under <session>/subagents/
 *
 * Symlinks are never followed. A scratch file over scratch.maxBytes, or byte-identical to one
 * already listed, is skipped and NAMED in the result, because a silently missing file is a blind
 * spot nobody can see. Env files are never members, whatever directory they sit in.
 */
import { readdirSync, statSync, lstatSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, resolve, dirname, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * The MAIN checkout of the repository `repoRoot` belongs to. One index serves every worktree on the
 * machine, so repository docs are read from the main checkout; a lane running recall from its own
 * worktree would otherwise index a second copy of every doc.
 */
export function mainCheckout(repoRoot) {
  try {
    const common = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const abs = isAbsolute(common) ? common : resolve(repoRoot, common);
    return basename(abs) === '.git' ? dirname(abs) : repoRoot;
  } catch {
    return repoRoot;
  }
}

function walk(dir, { depth = Infinity, match, exclude = [], out = [] }, level = 0) {
  if (!existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (exclude.some((x) => p === x || p.startsWith(`${x}/`))) continue;
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      if (level < depth) walk(p, { depth, match, exclude, out }, level + 1);
    } else if (e.isFile() && match(e.name, p)) out.push(p);
  }
  return out;
}

const isMd = (n) => n.endsWith('.md');
const isMdOrTxt = (n) => n.endsWith('.md') || n.endsWith('.txt');
const isJsonl = (n) => n.endsWith('.jsonl');

function entry(path, source, kind, extra = {}) {
  const st = statSync(path);
  return { path, source, kind, size: st.size, mtimeMs: Math.floor(st.mtimeMs), ...extra };
}

/** Returns { files: [{path, source, kind, size, mtimeMs, keyed?}], skipped: [{path, reason, detail}] }. */
export function enumerateCorpus(cfg) {
  const files = [];
  const skipped = [];
  const ex = cfg.exclude ?? [];
  const taken = new Set();
  const push = (e) => { if (!taken.has(e.path)) { taken.add(e.path); files.push(e); } };
  const isFile = (p) => existsSync(p) && !lstatSync(p).isSymbolicLink() && lstatSync(p).isFile();

  // Keyed files first, so the same file met again under docs.dirs keeps its keyed source.
  for (const k of cfg.keyed) if (isFile(k.file)) push(entry(k.file, k.source, 'md', { keyed: k }));
  for (const f of cfg.docs.files) if (isFile(f)) push(entry(f, 'docs', 'md'));
  for (const d of cfg.docs.dirs) for (const p of walk(d, { match: isMd, exclude: ex })) push(entry(p, 'docs', 'md'));

  for (const d of cfg.memory.dirs) for (const p of walk(d, { match: isMd, exclude: ex })) push(entry(p, 'memory', 'md'));
  for (const f of cfg.memory.files) if (isFile(f)) push(entry(f, 'memory', 'md'));

  const seenDigest = new Map();
  for (const d of cfg.scratch.dirs) {
    for (const p of walk(d, { match: isMdOrTxt, exclude: ex }).sort()) {
      if (taken.has(p)) continue;
      const e = entry(p, 'scratch', p.endsWith('.md') ? 'md' : 'txt');
      if (e.size > cfg.scratch.maxBytes) { skipped.push({ path: p, reason: 'over-size', detail: `${e.size} bytes > ${cfg.scratch.maxBytes}` }); continue; }
      const digest = createHash('sha256').update(readFileSync(p)).digest('hex');
      const first = seenDigest.get(digest);
      if (first) { skipped.push({ path: p, reason: 'duplicate', detail: `byte-identical to ${first}` }); continue; }
      seenDigest.set(digest, p);
      push(e);
    }
  }

  for (const d of cfg.transcripts.dirs) {
    if (!existsSync(d)) continue;
    for (const p of walk(d, { depth: 0, match: isJsonl, exclude: ex })) push(entry(p, 'transcripts', 'jsonl'));
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue;
      for (const p of walk(join(d, e.name, 'subagents'), { depth: 0, match: isJsonl, exclude: ex })) push(entry(p, 'transcripts', 'jsonl'));
    }
  }

  return { files: files.filter((f) => !/^\.env/.test(basename(f.path))), skipped };
}
