// jarvis-kit: generic adaptation of the recall index self-test from a production multi-agent setup; real values replaced with placeholders.
/**
 * self-test.mjs: prove the recall index does what recall.mjs claims, on a FICTIONAL fixture, in a
 * temp dir. Nothing here touches a real index or a real corpus; the temp dir is removed at the end.
 * A failing clause prints `SELF-TEST FAILED: <clause>` and the run exits 2.
 *
 *   A  redaction: one planted value of every kind is gone and counted; ids, shas, UUIDs and paths pass
 *   B  structure: backlog rows, decision sections, ledger rows, heading chunks, memory, scratch,
 *      transcript units (non-message records and thinking blocks skipped); oversize and duplicate
 *      scratch files skipped AND named
 *   C  read-back: every transcript unit's byte range parses back to its record
 *   D  search: exact id first, sha prefix, trigram substring, phrase, --source, --since, transcript
 *      quota, and a planted secret is not findable by its value
 *   E  incremental: an appended record adds one unit; an edited doc is re-split; a deleted file is gone
 *   F  permissions: index dir 0700, index file 0600
 *   G  CLI: an unknown flag and an empty query are refused with exit 2; a query prints hits
 */
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync, statSync, openSync, readSync, closeSync, utimesSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { redact, plantedSecrets, CLEAN_SAMPLE, REDACTION_KINDS } from './lib/redact.mjs';
import { openIndex, INDEX_FILE } from './lib/db.mjs';
import { normaliseConfig } from './lib/config.mjs';
import { enumerateCorpus } from './lib/corpus.mjs';
import { runIndex } from './lib/index.mjs';
import { search } from './lib/search.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHA = '9f8e7d6c5b4a39281706f5e4d3c2b1a0deadbeef';
const SESSION = '11111111-2222-4333-8444-555555555555';

/** The fixture's config, in the same shape as recall.config.example.json. */
function fixtureConfig(root) {
  return {
    repoRoot: 'repo',
    useMainCheckout: false,
    indexDir: join(root, 'index'),
    docs: { files: ['AGENTS.md'], dirs: ['docs'] },
    keyed: [
      { file: 'docs/BACKLOG.md', source: 'backlog', split: 'rows', idPattern: 'REQ-\\d+' },
      { file: 'docs/DECISIONS_LOG.md', source: 'decisions', split: 'sections', idPattern: 'DEC-\\d+' },
      { file: 'docs/REQUEST_LEDGER.md', source: 'ledger', split: 'rows' },
    ],
    memory: { dirs: [join(root, 'home', 'memory')], files: [join(root, 'home', 'RESUME.md')] },
    scratch: { dirs: [join(root, 'home', 'scratch')], maxBytes: 1024 * 1024 },
    transcripts: { dirs: [join(root, 'home', 'transcripts')], format: 'claude-code-jsonl' },
    idPatterns: ['REQ-\\d+', 'DEC-\\d+', 'GHSA-[a-z0-9-]+'],
  };
}

function writeFixture(root, planted) {
  const repo = join(root, 'repo'); const docs = join(repo, 'docs'); const home = join(root, 'home');
  const memory = join(home, 'memory'); const scratch = join(home, 'scratch'); const transcripts = join(home, 'transcripts');
  for (const d of [docs, memory, join(scratch, 'lane-x'), join(transcripts, SESSION, 'subagents')]) mkdirSync(d, { recursive: true });

  writeFileSync(join(repo, 'AGENTS.md'), '# Agents\n\nParallel lanes are the default.\n\n## Rules\n\nRead gate exits unpiped. Run the guard suite after touching docs.\n');
  writeFileSync(join(docs, 'BACKLOG.md'), [
    '# Backlog', '', '## Section one (2030-01-01)', '', '| id | sev | what |', '|---|---|---|',
    '| **REQ-0001** | HIGH | the bookings hold must be a compare-and-swap; filed 2030-01-02 |',
    '| **REQ-0002** | MED | a table cell with `\\|` escaped pipes; filed 2030-01-03 |',
    '', 'Prose between tables about the render walk.', '', '## Section two', '', '| id | sev | what |', '|---|---|---|',
    `| **REQ-0003** | LOW | invoice colours; see commit ${SHA}; filed 2030-01-20 |`, '',
  ].join('\n'));
  writeFileSync(join(docs, 'DECISIONS_LOG.md'), [
    '# Decisions', '',
    '### DEC-001 | 2029-12-01 | npm workspaces, deciding in 2029 what 2031 needs', 'Because workspaces.', '',
    '## DEC-002 — staff PINs became six digits (2030-01-05)', 'The four-digit PIN was guessable.', '### Gates', 'unit 1,204 / 96.', '',
    '## Not a decision heading', 'Trailing prose.', '',
  ].join('\n'));
  writeFileSync(join(docs, 'REQUEST_LEDGER.md'), [
    '# Ledger', '', '| Request | Asked | Note |', '|---|---|---|',
    '| **Searchable index** — *"make the notes searchable"* | 2030-01-30 | FILED |',
    '| **Weekly digest** | 2030-01-30 | research first |', '',
  ].join('\n'));
  writeFileSync(join(docs, 'RECALL_MAP.md'), '# Recall map\n\n## Where facts live\n\nThe decisions log answers why.\n\n## Older waves\n\nThe history file holds them.\n');
  writeFileSync(join(memory, 'MEMORY.md'), '- the owner wants results first, no spin\n');
  writeFileSync(join(home, 'RESUME.md'), '# Resume\n\n## 2030-01-29\n\nDeploy order: staging then demo.\n');
  writeFileSync(join(scratch, 'lane-x', 'REPORT.md'), '# Report\n\nThe census found the backlog is grepped often.\n');
  writeFileSync(join(scratch, 'brief-X.txt'), 'You are lane X. Ids REQ-0900..REQ-0909.\n');
  writeFileSync(join(scratch, 'huge.txt'), 'x'.repeat(1024 * 1024 + 1));
  writeFileSync(join(scratch, 'lane-x', 'REPORT-copy.md'), readFileSync(join(scratch, 'lane-x', 'REPORT.md')));
  writeFileSync(join(scratch, '.env.local'), 'NOT_INDEXED=1\n');

  const base = { sessionId: SESSION, cwd: '/w', version: '1' };
  const rows = [
    { type: 'queue-operation', operation: 'enqueue', timestamp: '2030-01-28T00:00:00Z' },
    { ...base, type: 'user', uuid: 'u1', timestamp: '2030-01-28T10:00:00Z', message: { role: 'user', content: 'Please rebase the lane onto main and re-run the unit gate' } },
    { ...base, type: 'assistant', uuid: 'a1', timestamp: '2030-01-28T10:00:05Z', message: { role: 'assistant', content: [
      { type: 'thinking', thinking: 'not indexed ZZTHINKZZ' },
      { type: 'text', text: 'Rebasing now.' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'git rebase main && npm test', description: 'Rebase and gate' } },
    ] } },
    { ...base, type: 'user', uuid: 'u2', timestamp: '2030-01-28T10:01:00Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: `Tests: 1204 passed\n${planted.map((p) => p.line(p.value)).join('\n')}` }] } },
    { type: 'ai-title', aiTitle: 'not indexed ZZTITLEZZ', sessionId: SESSION },
    { ...base, type: 'assistant', uuid: 'a2', timestamp: '2030-01-29T09:00:00Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Done; the unit gate read 1,204 / 96 on 2a7c41ff0.' }] } },
  ];
  const mainPath = join(transcripts, `${SESSION}.jsonl`);
  writeFileSync(mainPath, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
  const subPath = join(transcripts, SESSION, 'subagents', 'agent-abc123def.jsonl');
  writeFileSync(subPath, `${JSON.stringify({ ...base, agentId: 'abc123def', type: 'user', uuid: 's1', timestamp: '2030-01-29T12:00:00Z', message: { role: 'user', content: 'Read-only research on the watchdog' } })}\n`);
  const old = new Date(Date.now() - 3600 * 1000);
  utimesSync(mainPath, old, old); utimesSync(subPath, old, old);
  return { mainPath, repo, scratch };
}

function readRange(path, start, end) {
  const fd = openSync(path, 'r');
  try { const buf = Buffer.alloc(end - start); readSync(fd, buf, 0, end - start, start); return buf.toString('utf8'); } finally { closeSync(fd); }
}

export async function runSelfTest({ log = console.log } = {}) {
  const fails = [];
  const check = (cond, clause) => { if (cond) log(`SELF-TEST: ${clause} [ok]`); else { fails.push(clause); log(`SELF-TEST FAILED: ${clause}`); } };
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'recall-selftest-')));
  try {
    // A. redaction
    const planted = plantedSecrets();
    const red = redact(planted.map((p) => p.line(p.value)).join('\n'));
    for (const p of planted) check(!red.text.includes(p.value) && (red.counts[p.kind] ?? 0) >= 1, `A redaction: a planted ${p.kind} is gone and counted`);
    check(planted.length === REDACTION_KINDS.length && REDACTION_KINDS.every((k) => planted.some((p) => p.kind === k)), `A redaction: the fixture plants every kind (${REDACTION_KINDS.length})`);
    const clean = redact(CLEAN_SAMPLE);
    check(clean.text === CLEAN_SAMPLE && Object.keys(clean.counts).length === 0, 'A redaction: ids, shas, UUIDs, paths and placeholders pass unchanged');

    // B. structure
    const fx = writeFixture(root, planted);
    const rawCfg = fixtureConfig(root);
    writeFileSync(join(root, 'recall.config.json'), JSON.stringify(rawCfg, null, 1));
    const cfg = normaliseConfig(rawCfg, root);
    const db = await openIndex({ dir: cfg.indexDir, create: true, build: true });
    const corpus = enumerateCorpus(cfg);
    check(corpus.skipped.some((s) => s.path.endsWith('huge.txt') && s.reason === 'over-size'), 'B corpus: the oversize scratch file is skipped AND named');
    check(corpus.skipped.some((s) => s.reason === 'duplicate') && corpus.skipped.length === 2, 'B corpus: one of two identical scratch files is skipped and names the other');
    check(!corpus.files.some((f) => f.path.endsWith('.env.local')), 'B corpus: env files are never members');
    const totals = runIndex(db, { mode: 'build', corpus, repoRoot: cfg.repoRoot });
    const count = (sql, ...a) => db.prepare(sql).get(...a).n;
    const keys = (source) => db.prepare('SELECT key FROM docs WHERE source = ? ORDER BY key').all(source).map((r) => r.key);
    check(keys('backlog').filter((k) => /^REQ-/.test(k)).join(',') === 'REQ-0001,REQ-0002,REQ-0003', `B structure: three backlog rows keyed by id (${keys('backlog').join(' | ')})`);
    const dRows = db.prepare("SELECT key, text, date FROM docs WHERE source = 'decisions' AND key LIKE 'DEC-%' ORDER BY key").all();
    check(dRows.map((r) => r.key).join(',') === 'DEC-001,DEC-002', 'B structure: two decision sections');
    check(dRows[0]?.date === '2029-12-01' && dRows[1]?.date === '2030-01-05', 'B structure: a decision is dated from its heading, not the first date in its title');
    check(dRows[1] && dRows[1].text.includes('### Gates') && !dRows[1].text.includes('Not a decision heading'), 'B structure: a deeper sub-heading stays inside its decision');
    check(keys('ledger').some((k) => k.startsWith('Searchable index')) && keys('ledger').some((k) => k.startsWith('Weekly digest')), 'B structure: ledger rows keyed by first cell');
    check(count("SELECT COUNT(*) AS n FROM docs WHERE source = 'docs' AND path LIKE '%RECALL_MAP.md' AND key IN ('Where facts live', 'Older waves')") === 2, 'B structure: a plain doc is split by heading');
    check(count("SELECT COUNT(*) AS n FROM docs WHERE source = 'memory'") >= 2, 'B structure: memory covers the memory folder and the resume file');
    check(count("SELECT COUNT(*) AS n FROM docs WHERE source = 'scratch'") === 2, 'B structure: scratch covers .md and .txt');
    const tUnits = db.prepare("SELECT key, text, start, end, path, session, agent FROM docs WHERE source = 'transcripts' ORDER BY path, start").all();
    check(tUnits.length === 5, `B structure: five transcript units (got ${tUnits.length})`);
    check(!tUnits.some((u) => /ZZTHINKZZ|ZZTITLEZZ/.test(u.text)), 'B structure: thinking blocks and non-message records are not indexed');
    check(tUnits.some((u) => u.key === 'assistant tool_use Bash' && u.text.includes('command=git rebase main')), 'B structure: tool inputs are indexed under the tool name');
    check(tUnits.some((u) => u.agent === 'abc123def' && u.session === SESSION), 'B structure: subagent units carry agent and session ids');
    check(Object.keys(totals.counts).length >= REDACTION_KINDS.length - 1, 'B redaction runs inside the pipeline');

    // C. read-back
    const ok = tUnits.filter((u) => { try { return JSON.parse(readRange(u.path, u.start, u.end)).type === u.key.split(' ')[0]; } catch { return false; } }).length;
    check(ok === tUnits.length, `C read-back: every transcript byte range parses to its record (${ok}/${tUnits.length})`);

    // D. search
    const q = (query, o = {}) => search(db, { query, idRe: cfg.idRe, ...o });
    let r = q('REQ-0002');
    check(r.hits[0]?.key === 'REQ-0002' && r.hits[0].source === 'backlog', 'D search: an id returns its own row first');
    check(q('DEC-002').hits[0]?.key === 'DEC-002', 'D search: a decision id returns its own section first');
    r = q(SHA.slice(0, 9));
    check(r.hits.length === 1 && r.hits[0].key === 'REQ-0003', 'D search: a 9-char sha is a whole token');
    r = q(`${SHA.slice(0, 7)}*`);
    check(r.hits.length === 1 && r.hits[0].key === 'REQ-0003', 'D search: a trailing * is a prefix query');
    r = q(SHA.slice(10, 18));
    check(r.mode === 'trigram' && r.hits[0]?.key === 'REQ-0003', 'D search: a mid-sha substring falls through to trigram');
    r = q('"compare-and-swap"');
    check(r.hits.length === 1 && r.hits[0].key === 'REQ-0001', 'D search: a quoted hyphenated phrase matches whole');
    r = q('rebase', { source: 'transcripts' });
    check(r.hits.length >= 1 && r.hits.every((h) => h.source === 'transcripts'), 'D search: --source restricts');
    r = q('gate', { since: '2030-01-29' });
    check(r.hits.length >= 1 && r.hits.every((h) => h.date >= '2030-01-29'), 'D search: --since excludes older units');
    r = q('bookings hold staff guessable');
    check(/or/.test(r.mode) && r.hits.length >= 1, 'D search: no unit has every term, so it falls back to OR');
    r = q('gate', { limit: 2 });
    check(r.hits.length === 2 && r.hits.some((h) => h.source !== 'transcripts'), 'D search: transcripts stay within their quota while doc units remain');
    const leaked = planted.reduce((n, p) => n + q(p.value).hits.length + q(p.value.slice(0, 12)).hits.length, 0);
    check(leaked === 0, `D search: no planted secret is findable by its value (${leaked})`);
    check(q('REDACTED:cloud_access_key_id').hits.length === 1, 'D search: the redaction marker IS findable');

    // E. incremental
    const before = Object.fromEntries(db.prepare('SELECT path, indexed_at FROM files').all().map((f) => [f.path, f.indexed_at]));
    await new Promise((res) => setTimeout(res, 20));
    appendFileSync(fx.mainPath, `${JSON.stringify({ sessionId: SESSION, type: 'user', uuid: 'u9', timestamp: '2030-01-30T08:00:00Z', message: { role: 'user', content: 'APPENDED-RECORD-MARKER continue' } })}\n`);
    const later = new Date(Date.now() - 1800 * 1000);
    utimesSync(fx.mainPath, later, later);
    appendFileSync(join(fx.repo, 'docs', 'BACKLOG.md'), '| **REQ-0004** | LOW | a fourth row added later |\n');
    rmSync(join(fx.scratch, 'brief-X.txt'));
    const t2 = runIndex(db, { mode: 'update', corpus: enumerateCorpus(cfg), repoRoot: cfg.repoRoot });
    check(t2.appended === 1 && t2.reindexed === 1 && t2.removed === 1, `E incremental: 1 appended, 1 reindexed, 1 removed (got ${t2.appended}/${t2.reindexed}/${t2.removed})`);
    check(q('APPENDED-RECORD-MARKER').hits.length === 1 && count("SELECT COUNT(*) AS n FROM docs WHERE source = 'transcripts'") === 6, 'E incremental: the appended record is exactly one new unit');
    check(count("SELECT COUNT(*) AS n FROM docs WHERE key = 'REQ-0001'") === 1, 'E incremental: the edited doc is re-split once, no duplicates');
    check(q('REQ-0900').hits.length === 0, 'E incremental: a deleted file leaves no units');
    const dl = db.prepare('SELECT path, indexed_at FROM files WHERE path LIKE ?').get('%DECISIONS_LOG.md');
    check(dl && before[dl.path] === dl.indexed_at, 'E incremental: an unchanged file was not re-read');
    db.close();

    // F. permissions
    check((statSync(cfg.indexDir).mode & 0o777) === 0o700, 'F permissions: index directory is 0700');
    check((statSync(join(cfg.indexDir, INDEX_FILE)).mode & 0o777) === 0o600, 'F permissions: index file is 0600');

    // G. CLI
    const run = (args) => spawnSync(process.execPath, [join(HERE, 'recall.mjs'), '--config', join(root, 'recall.config.json'), ...args], { encoding: 'utf8', env: { ...process.env, RECALL_INDEX_DIR: '' } });
    let c = run(['--bogus=1', 'x']);
    check(c.status === 2 && /unrecognised option/.test(c.stderr), `G cli: an unknown flag is refused with exit 2 (got ${c.status})`);
    c = run([]);
    check(c.status === 2 && /no query/.test(c.stderr), `G cli: an empty query is refused with exit 2 (got ${c.status})`);
    c = run(['REQ-0003', '--limit', '3']);
    check(c.status === 0 && /\[backlog\].*REQ-0003/.test(c.stdout), `G cli: a query prints hits and exits 0 (got ${c.status})`);
    c = run(['nothing-matches-this-token-zzqq']);
    check(c.status === 1, `G cli: no hits exits 1 (got ${c.status})`);
    c = run(['--stats']);
    check(c.status === 0 && /redactions \(counts only\)/.test(c.stdout) && !planted.some((p) => c.stdout.includes(p.value)), 'G cli: --stats prints counts and never a value');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  log(fails.length ? `SELF-TEST: ${fails.length} clause(s) FAILED` : 'SELF-TEST: all clauses passed');
  return fails.length ? 2 : 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) runSelfTest().then((code) => process.exit(code));
