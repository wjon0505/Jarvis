// jarvis-kit: generic adaptation of the recall index's configuration from a production multi-agent setup; real values replaced with placeholders.
/**
 * config.mjs: where the recall index reads from and writes to. Nothing machine-specific is coded in
 * this tool; every path comes from a JSON config (see recall.config.example.json).
 *
 * Config lookup: --config <path>, else $RECALL_CONFIG, else ./recall.config.json.
 * Path rules: a leading `~` is the home directory; `repoRoot` resolves against the config file's
 * directory; every other relative path resolves against `repoRoot`. $RECALL_INDEX_DIR overrides
 * `indexDir`. `useMainCheckout: false` stops the repoRoot being moved from a worktree to its main checkout.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { mainCheckout } from './corpus.mjs';

export const BUILTIN_SOURCES = ['docs', 'memory', 'scratch', 'transcripts'];

const expand = (p, base) => {
  if (typeof p !== 'string' || p === '') throw new Error(`bad path in recall config: ${JSON.stringify(p)}`);
  if (p === '~' || p.startsWith('~/')) return join(homedir(), p.slice(1));
  return isAbsolute(p) ? p : resolve(base, p);
};
const list = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Turn a parsed config object into absolute, validated settings. `configDir` anchors `repoRoot`. */
export function normaliseConfig(raw, configDir) {
  // One index serves every worktree: read repository docs from the main checkout unless told not to.
  const given = expand(raw.repoRoot ?? '.', configDir);
  const repoRoot = raw.useMainCheckout === false ? given : mainCheckout(given);
  const p = (x) => expand(x, repoRoot);
  const keyed = list(raw.keyed).map((k, i) => {
    if (!k.file || !k.source) throw new Error(`keyed[${i}] needs "file" and "source"`);
    if (!['rows', 'sections', 'headings'].includes(k.split ?? 'headings')) throw new Error(`keyed[${i}].split must be rows | sections | headings`);
    if (BUILTIN_SOURCES.includes(k.source)) throw new Error(`keyed[${i}].source "${k.source}" collides with a built-in source`);
    return { file: p(k.file), source: k.source, split: k.split ?? 'headings', idPattern: k.idPattern ? new RegExp(k.idPattern) : null };
  });
  const idPatterns = list(raw.idPatterns);
  for (const s of idPatterns) new RegExp(s); // throws on a bad pattern
  const cfg = {
    repoRoot,
    indexDir: process.env.RECALL_INDEX_DIR ? expand(process.env.RECALL_INDEX_DIR, process.cwd()) : p(raw.indexDir ?? '~/.jarvis/recall'),
    docs: { files: list(raw.docs?.files).map(p), dirs: list(raw.docs?.dirs).map(p) },
    keyed,
    memory: { dirs: list(raw.memory?.dirs).map(p), files: list(raw.memory?.files).map(p) },
    scratch: { dirs: list(raw.scratch?.dirs).map(p), maxBytes: Number(raw.scratch?.maxBytes ?? 1024 * 1024) },
    transcripts: { dirs: list(raw.transcripts?.dirs).map(p), format: raw.transcripts?.format ?? 'claude-code-jsonl' },
    idRe: idPatterns.length ? new RegExp(`^(?:${idPatterns.join('|')})$`, 'i') : /^$/,
    exclude: list(raw.exclude).map(p),
  };
  if (cfg.transcripts.format !== 'claude-code-jsonl') throw new Error(`transcripts.format "${cfg.transcripts.format}" has no adapter (see lib/transcripts.mjs)`);
  cfg.exclude.push(cfg.indexDir); // the index never indexes itself
  cfg.sources = [...new Set([...keyed.map((k) => k.source), ...BUILTIN_SOURCES])];
  return cfg;
}

export function loadConfig(path) {
  const file = resolve(path ?? process.env.RECALL_CONFIG ?? 'recall.config.json');
  if (!existsSync(file)) {
    const err = new Error(`no recall config at ${file}. Copy recall.config.example.json to recall.config.json and edit it, or pass --config.`);
    err.code = 'NO_CONFIG';
    throw err;
  }
  return normaliseConfig(JSON.parse(readFileSync(file, 'utf8')), dirname(file));
}
