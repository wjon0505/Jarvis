#!/usr/bin/env node
// jarvis-kit: generic adaptation of a dependency-audit gate from a production multi-agent setup; real values replaced with placeholders.
/**
 * npm-audit-gate.mjs: a dependency scan that CAN fail.
 *
 *   node scripts/npm-audit-gate.mjs                                         run both audits and gate them
 *   node scripts/npm-audit-gate.mjs --from <full.json> --from-runtime <omit-dev.json>   gate saved documents
 *   node scripts/npm-audit-gate.mjs --self-test                             prove every red path fires
 *   --allowlist <path>   (or NPM_AUDIT_ALLOWLIST; default security/npm-audit-allowlist.json)
 *
 * The common anti-pattern is `npm audit --audit-level=high || true`: the scan runs, prints, and its
 * exit code goes into `true`. This computes a verdict from the audit JSON against a reasoned,
 * dated allow-list keyed on GHSA ids:
 *
 *   FAIL  a high or critical advisory, anywhere in the tree, with no allow-list entry
 *   FAIL  a MODERATE advisory whose vulnerable package is in the RUNTIME closure, with no entry
 *         (a moderate advisory in shipped code can be a real exploit; "high only" lets it sit)
 *   FAIL  an allow-listed advisory whose entry has EXPIRED (the reason was dated; the date passed)
 *   FAIL  an allow-list entry the audit no longer reports or no longer gates (a stale reason)
 *   ABORT (exit 2) the audit, allow-list or lockfile cannot be read, or the two runtime instruments
 *         below disagree in the direction that could hide an advisory. "Never asked" is not clean.
 *
 * Low advisories, and moderates whose every copy is dev-only, are listed for the record only.
 * `npm audit` exits 1 whenever anything is found, so its exit code is not the verdict; the JSON is.
 *
 * THE RUNTIME CLOSURE IS DERIVED TWICE. (1) runtimeClosure() walks package-lock.json from the root
 * and every workspace through dependencies / optionalDependencies / peerDependencies (never
 * devDependencies), resolving each edge the way node does. (2) `npm audit --omit=dev` is npm's own
 * view. Every lockfile node marked non-dev must be reached by (1), and every moderate npm reports in
 * (2) must be gated by (1), else ABORT. (1) may reach more than npm counts; that surplus gates more,
 * never less, and is printed.
 *
 * Allow-list entry shape (see npm-audit-allowlist.example.json):
 *   { id: "GHSA-xxxx-xxxx-xxxx", package, severity, title, vulnerableRange, reason, addedAt, expiresAt, owner }
 */
import { readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUDIT_ARGV = ['audit', '--json', '--audit-level=high'];
export const RUNTIME_AUDIT_ARGV = [...AUDIT_ARGV, '--omit=dev'];
export const GATED_ANYWHERE = new Set(['high', 'critical']);
export const GATED_IN_RUNTIME = new Set(['moderate']);
/** Kept separate from the rule on purpose: a mutation that switches the rule off is caught by the cross-check. */
const RUNTIME_INSTRUMENT_SEVERITIES = new Set(['moderate']);
const GHSA = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

function globToRegExp(glob) {
  const parts = glob.split('**').map((seg) => seg.split('*').map((s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('[^/]+'));
  return new RegExp(`^${parts.join('.+')}$`);
}

/** Walk the lockfile's `packages` graph through production edges only. Pure. */
export function runtimeClosure(lock) {
  const pk = lock?.packages;
  if (!pk || typeof pk !== 'object' || !pk['']) throw new Error('package-lock.json has no `packages[""]` root entry (lockfileVersion 2 or 3 is required)');
  const globs = (Array.isArray(pk[''].workspaces) ? pk[''].workspaces : []).map(globToRegExp);
  const workspaces = Object.keys(pk).filter((p) => p !== '' && !p.includes('node_modules/') && globs.some((re) => re.test(p)));
  const resolveFrom = (from, name) => {
    let base = from;
    for (;;) {
      const candidate = base === '' ? `node_modules/${name}` : `${base}/node_modules/${name}`;
      if (pk[candidate]) return candidate;
      if (base === '') return null;
      const i = base.lastIndexOf('/node_modules/');
      base = i >= 0 ? base.slice(0, i) : '';
    }
  };
  const chain = new Map();
  const missing = { prod: [], optional: [], peer: [] };
  const seen = new Set(['', ...workspaces]);
  const queue = ['', ...workspaces];
  while (queue.length) {
    const p = queue.shift();
    const node = pk[p];
    if (node.link) {
      const target = node.resolved;
      if (typeof target !== 'string' || !pk[target]) { missing.prod.push(`${p} -> (link) ${String(target)}`); continue; }
      if (!seen.has(target)) { seen.add(target); chain.set(target, { from: p, kind: 'link' }); queue.push(target); }
      continue;
    }
    const edges = [
      ...Object.entries(node.dependencies ?? {}).map(([n, s]) => [n, s, 'prod']),
      ...Object.entries(node.optionalDependencies ?? {}).map(([n, s]) => [n, s, 'optional']),
      ...Object.entries(node.peerDependencies ?? {}).map(([n, s]) => [n, s, node.peerDependenciesMeta?.[n]?.optional ? 'peerOptional' : 'peer']),
    ];
    for (const [name, spec, kind] of edges) {
      const r = resolveFrom(p, name);
      if (!r) { (kind === 'prod' ? missing.prod : kind === 'optional' ? missing.optional : missing.peer).push(`${p || '<root>'} -> ${name}@${spec} (${kind})`); continue; }
      if (!seen.has(r)) { seen.add(r); chain.set(r, { from: p, kind }); queue.push(r); }
    }
  }
  const isWorkspace = new Set(workspaces);
  const nodes = new Set([...seen].filter((p) => p !== '' && !isWorkspace.has(p) && !pk[p].link));
  const lockNonDev = Object.keys(pk).filter((p) => p !== '' && !isWorkspace.has(p) && !pk[p].link && !pk[p].dev);
  return {
    nodes, workspaces, chain, missing,
    unreached: lockNonDev.filter((p) => !nodes.has(p)),
    overIncluded: [...nodes].filter((p) => pk[p].dev === true),
    lockNonDev: lockNonDev.length,
  };
}

export function chainOf(closure, path) {
  const out = [path];
  let p = path;
  const guard = new Set([p]);
  while (closure.chain.has(p)) {
    p = closure.chain.get(p).from;
    if (guard.has(p)) break;
    guard.add(p);
    out.unshift(p === '' ? '<root>' : p);
  }
  return out.join(' -> ');
}

/** Every GATED advisory keyed by GHSA id. A moderate with no node locations is gated (unknown placement fails loud). */
export function advisoriesOf(audit, runtimeNodes) {
  if (!(runtimeNodes instanceof Set)) throw new Error('advisoriesOf needs the runtime closure as a Set of lockfile paths');
  const out = new Map();
  for (const [name, v] of Object.entries(audit?.vulnerabilities ?? {})) {
    const nodes = Array.isArray(v.nodes) ? v.nodes.filter((n) => typeof n === 'string') : [];
    const runtimeCopies = nodes.filter((n) => runtimeNodes.has(n));
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      const severity = via.severity;
      let why;
      if (GATED_ANYWHERE.has(severity)) why = `${severity}: gated wherever it sits`;
      else if (GATED_IN_RUNTIME.has(severity) && nodes.length === 0) why = 'moderate with NO node locations, so it cannot be placed outside the runtime closure';
      else if (GATED_IN_RUNTIME.has(severity) && runtimeCopies.length > 0) why = `moderate, in the runtime closure at ${runtimeCopies.join(', ')}`;
      else continue;
      const id = String(via.url ?? '').split('/').pop() ?? '';
      if (!GHSA.test(id)) continue;
      if (!out.has(id)) out.set(id, { id, package: via.name ?? name, severity, title: via.title ?? '', nodes, runtimeNodes: runtimeCopies, why });
    }
  }
  return out;
}

export function idsBySeverity(audit, severities) {
  const out = new Map();
  for (const [name, v] of Object.entries(audit?.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || via === null || !severities.has(via.severity)) continue;
      const id = String(via.url ?? '').split('/').pop() ?? '';
      if (GHSA.test(id) && !out.has(id)) out.set(id, { id, package: via.name ?? name, severity: via.severity, title: via.title ?? '' });
    }
  }
  return out;
}

/** `missed` = moderates npm places in the runtime closure that the walk did not gate (ABORT). */
export function crossCheck(gated, runtimeAudit) {
  const npmModerates = idsBySeverity(runtimeAudit, RUNTIME_INSTRUMENT_SEVERITIES);
  const missed = [...npmModerates.values()].filter((a) => !gated.has(a.id));
  const surplus = [...gated.values()].filter((a) => GATED_IN_RUNTIME.has(a.severity) && !npmModerates.has(a.id));
  return { npmModerates, missed, surplus };
}

/** The verdict. Pure: `today` is YYYY-MM-DD (UTC). */
export function evaluate(audit, allowlist, today, runtimeNodes) {
  const found = advisoriesOf(audit, runtimeNodes);
  const entries = new Map((allowlist.entries ?? []).map((e) => [e.id, e]));
  const unlisted = [...found.values()].filter((a) => !entries.has(a.id));
  const expired = [...found.values()].filter((a) => entries.has(a.id) && entries.get(a.id).expiresAt < today);
  const stale = [...entries.values()].filter((e) => !found.has(e.id));
  const unreasoned = [...entries.values()].filter((e) => !e.reason || !e.expiresAt);
  const tolerated = [...found.values()].filter((a) => entries.has(a.id) && entries.get(a.id).expiresAt >= today).map((a) => ({ ...a, expiresAt: entries.get(a.id).expiresAt }));
  const recordOnly = [...idsBySeverity(audit, new Set(['low', 'moderate'])).values()].filter((a) => !found.has(a.id));
  return { found, unlisted, expired, stale, unreasoned, tolerated, recordOnly, ok: !unlisted.length && !expired.length && !stale.length && !unreasoned.length };
}

function abort(message, detail) {
  console.error(`GATE ABORTED (exit 2): ${message}`);
  if (detail) console.error(detail);
  console.error('This is NOT a clean result: the question was never asked.');
  process.exit(2);
}

function runAudit(argv) {
  const r = spawnSync('npm', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try {
    const doc = JSON.parse(r.stdout || '');
    if (!doc || typeof doc !== 'object' || !('vulnerabilities' in doc)) throw new Error('no vulnerabilities key');
    return doc;
  } catch (err) {
    return abort(`\`npm ${argv.join(' ')}\` produced no readable document (${err.message}).`, (r.stderr || '').slice(0, 2000));
  }
}

function readJson(path, what) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (err) { return abort(`cannot read ${what} at ${path}: ${err.message}`); }
}

function report(v, today, closure, xc, allowlistPath) {
  const line = (a) => `  ${a.id}  ${a.severity.padEnd(8)} ${a.package}  ${a.title}`.slice(0, 160);
  console.log(`npm-audit-gate: runtime closure ${closure.nodes.size} nodes from the root and ${closure.workspaces.length} workspace(s); lockfile marks ${closure.lockNonDev} non-dev; npm --omit=dev reports ${xc.npmModerates.size} moderate id(s)`);
  if (closure.overIncluded.length) console.log(`  the walk reaches ${closure.overIncluded.length} node(s) the lockfile files as dev (gated all the same): ${closure.overIncluded.join(', ')}`);
  console.log(`npm-audit-gate: ${v.found.size} gated advisory(ies); ${v.tolerated.length} tolerated by an unexpired entry (today ${today})`);
  for (const a of v.tolerated) console.log(`  tolerated ${a.id} ${a.severity.padEnd(8)} ${a.package} until ${a.expiresAt}`);
  for (const a of v.recordOnly) console.log(`  record-only ${a.id} ${a.severity.padEnd(8)} ${a.package}`);
  if (xc.surplus.length) console.log(`  the walk gates ${xc.surplus.length} moderate id(s) npm --omit=dev does not list (conservative; kept)`);
  if (v.unlisted.length) {
    console.log(`\nFAIL: ${v.unlisted.length} advisory(ies) with NO allow-list entry (${allowlistPath}):`);
    for (const a of v.unlisted) { console.log(line(a)); for (const n of a.runtimeNodes) console.log(`      reached as ${chainOf(closure, n)}`); }
  }
  if (v.expired.length) { console.log(`\nFAIL: ${v.expired.length} entry(ies) EXPIRED (upgrade, or re-date with a fresh reason):`); for (const a of v.expired) console.log(line(a)); }
  if (v.stale.length) { console.log(`\nFAIL: ${v.stale.length} entry(ies) no longer reported or gated (remove them):`); for (const e of v.stale) console.log(`  ${e.id}  ${e.package}`); }
  if (v.unreasoned.length) { console.log(`\nFAIL: ${v.unreasoned.length} entry(ies) without a reason or an expiry:`); for (const e of v.unreasoned) console.log(`  ${e.id}`); }
  console.log(v.ok ? '\nVERDICT: CLEAN' : '\nVERDICT: RED');
}

function selfTest() {
  const checks = [];
  const check = (label, pass) => checks.push([label, pass]);
  const today = '2030-06-15';
  const entry = (id, severity, expiresAt) => ({ id, package: 'synthetic-pkg', severity, reason: 'synthetic', addedAt: '2030-06-01', expiresAt });
  const lock = () => ({
    lockfileVersion: 3,
    packages: {
      '': { name: 'synthetic-root', workspaces: ['apps/*', 'packages/*'], devDependencies: { 'root-dev-tool': '1' } },
      'apps/web': { name: 'web', dependencies: { prodlib: '1', '@scope/lib': '*' }, devDependencies: { devlib: '1' } },
      'packages/lib': { name: '@scope/lib', dependencies: { leaf: '1' } },
      'node_modules/@scope/lib': { resolved: 'packages/lib', link: true },
      'node_modules/prodlib': { version: '1.0.0', dependencies: { shared: '1', nested: '1' }, optionalDependencies: { 'missing-platform-build': '1' } },
      'node_modules/prodlib/node_modules/nested': { version: '2.0.0' },
      'node_modules/nested': { version: '1.0.0', dev: true },
      'node_modules/shared': { version: '1.0.0' },
      'node_modules/leaf': { version: '1.0.0' },
      'node_modules/devlib': { version: '1.0.0', dev: true, dependencies: { shared: '1', devonly: '1' } },
      'node_modules/devonly': { version: '1.0.0', dev: true },
      'node_modules/root-dev-tool': { version: '1.0.0', dev: true },
    },
  });
  const audit = (id, severity, nodes) => ({ vulnerabilities: { 'synthetic-pkg': { name: 'synthetic-pkg', severity, via: [{ name: 'synthetic-pkg', severity, title: 'synthetic', url: `https://github.com/advisories/${id}` }], nodes } } });
  const c = runtimeClosure(lock());
  check('workspaces found from root globs', c.workspaces.length === 2);
  check('production transitive is in the closure', c.nodes.has('node_modules/prodlib') && c.nodes.has('node_modules/shared'));
  check('nested copy resolves nearest-first', c.nodes.has('node_modules/prodlib/node_modules/nested') && !c.nodes.has('node_modules/nested'));
  check('workspace link followed to its target', c.nodes.has('node_modules/leaf'));
  check('dev dependencies stay out', !c.nodes.has('node_modules/devlib') && !c.nodes.has('node_modules/devonly'));
  check('walk and lockfile flags agree', c.unreached.length === 0 && c.overIncluded.length === 0);
  const unflagged = lock(); delete unflagged.packages['node_modules/devonly'].dev;
  check('a non-dev node the walk cannot reach is UNREACHED', runtimeClosure(unflagged).unreached.join() === 'node_modules/devonly');
  const RT = new Set(['node_modules/synthetic-pkg']);
  const id = 'GHSA-aaaa-bbbb-cccc';
  check('unlisted high fails, even outside runtime', !evaluate(audit(id, 'high', ['node_modules/x']), { entries: [] }, today, RT).ok);
  check('expired entry fails', evaluate(audit(id, 'critical', ['node_modules/synthetic-pkg']), { entries: [entry(id, 'critical', '2030-06-14')] }, today, RT).expired.length === 1);
  check('unexpired entry tolerates', evaluate(audit(id, 'high', ['node_modules/synthetic-pkg']), { entries: [entry(id, 'high', '2030-06-15')] }, today, RT).ok);
  check('stale entry fails', evaluate({ vulnerabilities: {} }, { entries: [entry(id, 'high', '2030-12-01')] }, today, RT).stale.length === 1);
  check('entry without a reason fails', !evaluate(audit(id, 'high', ['node_modules/synthetic-pkg']), { entries: [{ ...entry(id, 'high', '2030-12-01'), reason: '' }] }, today, RT).ok);
  check('dev-only moderate does not gate', evaluate(audit(id, 'moderate', ['node_modules/x']), { entries: [] }, today, RT).ok);
  check('runtime moderate fails', !evaluate(audit(id, 'moderate', ['node_modules/synthetic-pkg']), { entries: [] }, today, RT).ok);
  check('moderate with no node locations fails', !evaluate(audit(id, 'moderate', []), { entries: [] }, today, RT).ok);
  check('low never gates', evaluate(audit(id, 'low', ['node_modules/synthetic-pkg']), { entries: [] }, today, RT).ok);
  const devOnly = evaluate(audit(id, 'moderate', ['node_modules/x']), { entries: [] }, today, RT);
  check('npm-reported runtime moderate the walk missed is MISSED', crossCheck(devOnly.found, audit(id, 'moderate', ['node_modules/synthetic-pkg'])).missed.length === 1);
  let ok = true;
  for (const [label, pass] of checks) { console.log(`SELF-TEST: ${label.padEnd(60)} [${pass ? 'ok' : 'FAILED'}]`); ok = ok && pass; }
  process.exit(ok ? 0 : 1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const allowlistPath = resolve(process.cwd(), val('--allowlist') ?? process.env.NPM_AUDIT_ALLOWLIST ?? 'security/npm-audit-allowlist.json');
  const from = val('--from'); const fromRt = val('--from-runtime');
  if (Boolean(from) !== Boolean(fromRt)) abort('--from and --from-runtime go together.');
  const audit = from ? readJson(from, 'the audit document') : runAudit(AUDIT_ARGV);
  const runtimeAudit = fromRt ? readJson(fromRt, 'the --omit=dev audit document') : runAudit(RUNTIME_AUDIT_ARGV);
  const allowlist = readJson(allowlistPath, 'the allow-list');
  let closure;
  try { closure = runtimeClosure(readJson(resolve(process.cwd(), 'package-lock.json'), 'the lockfile')); } catch (err) { abort(`the runtime closure cannot be derived: ${err.message}`); }
  if (closure.missing.prod.length) abort(`the lockfile cannot resolve ${closure.missing.prod.length} production edge(s):`, closure.missing.prod.map((m) => `  ${m}`).join('\n'));
  if (closure.unreached.length) abort(`${closure.unreached.length} node(s) marked non-dev were not reached by the walk:`, closure.unreached.map((p) => `  ${p}`).join('\n'));
  const today = new Date().toISOString().slice(0, 10);
  const verdict = evaluate(audit, allowlist, today, closure.nodes);
  const xc = crossCheck(verdict.found, runtimeAudit);
  if (xc.missed.length) abort(`npm --omit=dev reports ${xc.missed.length} runtime moderate(s) the walk did not gate:`, xc.missed.map((a) => `  ${a.id}  ${a.package}`).join('\n'));
  report(verdict, today, closure, xc, allowlistPath);
  process.exit(verdict.ok ? 0 : 1);
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) main();
