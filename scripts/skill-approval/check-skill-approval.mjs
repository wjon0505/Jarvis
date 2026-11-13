#!/usr/bin/env node
// jarvis-kit: generic adaptation of a skill-content approval guard from a production multi-agent setup; real values replaced with placeholders.
/**
 * check-skill-approval.mjs: every skill directory's exact bytes carry the owner's approval.
 *
 *   node check-skill-approval.mjs [--skills-dir skills] [--manifest approved-skills.json]
 *                                 [--decision-re '\bDEC-\d+\b'] [--all-files]
 *   node check-skill-approval.mjs --hash <skill-dir>     print the hash to put in a new entry
 *   node check-skill-approval.mjs --self-test            show every refusal firing on mutated input
 *
 * A skill is instruction text that loads into every later agent session. Approving it by name is
 * not enough: a one-byte change is a new instruction. So the manifest records, per skill directory,
 *
 *   sha256 over the sorted lines "<relpath>\0<sha256(file bytes)>", joined by "\n"
 *
 * and this script recomputes each one and FAILS on:
 *   · a skill directory with no entry, or whose bytes no longer match its entry;
 *   · an entry with no directory (a removal must be approved too);
 *   · an entry whose "approved" string names no decision id (matching --decision-re);
 *   · a loose file at the top of the skills dir (every skill is a directory);
 *   · zero skill directories found (a census that found nothing is not a pass).
 *
 * Files come from `git ls-files` (tracked bytes are what every checkout receives); --all-files walks
 * the filesystem instead, for a directory that is not in git.
 * EXIT: 0 every skill approved · 1 offenders · 2 cannot run.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = (b) => createHash('sha256').update(b).digest('hex');

/** The content hash of one skill: files is { relpath: Buffer }. */
export function skillHash(files) {
  return sha(Object.keys(files).sort().map((p) => `${p}\0${sha(files[p])}`).join('\n'));
}

function walk(dir, base = dir, out = {}) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p, base, out);
    else if (e.isFile()) out[relative(base, p).split(sep).join('/')] = readFileSync(p);
  }
  return out;
}

/** { tree: { skillDir: { relpath: Buffer } }, loose: [paths] } */
export function readSkillTree(skillsDir, { allFiles = false } = {}) {
  const abs = resolve(skillsDir);
  const tree = {}; const loose = [];
  let rels;
  if (allFiles) {
    const all = walk(abs);
    rels = Object.keys(all);
    for (const r of rels) {
      const [dir, ...rest] = r.split('/');
      if (!rest.length) { loose.push(r); continue; }
      (tree[dir] ??= {})[rest.join('/')] = all[r];
    }
    return { tree, loose };
  }
  rels = execFileSync('git', ['-C', abs, 'ls-files', '-z', '--', '.'], { encoding: 'utf8', maxBuffer: 1e8 }).split('\0').filter(Boolean);
  for (const r of rels) {
    const [dir, ...rest] = r.split('/');
    if (!rest.length) { loose.push(r); continue; }
    (tree[dir] ??= {})[rest.join('/')] = readFileSync(join(abs, r));
  }
  return { tree, loose };
}

export function approvalOffenders(tree, manifest, decisionRe) {
  const out = [];
  const skills = manifest?.skills ?? {};
  for (const [dir, files] of Object.entries(tree)) {
    const e = skills[dir];
    const now = skillHash(files);
    if (!e) out.push(`${dir}: a skill directory with no approved content hash (now ${now})`);
    else if (e.sha256 !== now) out.push(`${dir}: content differs from the approved hash (approved ${String(e.sha256).slice(0, 12)}, now ${now.slice(0, 12)})`);
  }
  for (const [dir, e] of Object.entries(skills)) {
    if (!(dir in tree)) out.push(`${dir}: approved but absent (a removal must be approved and the entry dropped)`);
    if (!decisionRe.test(String(e.approved ?? ''))) out.push(`${dir}: its "approved" field names no decision matching ${decisionRe}`);
  }
  return out;
}

function arg(argv, name, dflt) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
}

function selfTest() {
  const re = /\bDEC-\d+\b/;
  const tree = { alpha: { 'SKILL.md': Buffer.from('---\nname: alpha\n---\nbody\n') }, beta: { 'SKILL.md': Buffer.from('b\n'), 'ref/notes.md': Buffer.from('n\n') } };
  const manifest = { skills: { alpha: { sha256: skillHash(tree.alpha), files: 1, approved: 'DEC-017: owner read the text' }, beta: { sha256: skillHash(tree.beta), files: 2, approved: 'DEC-018' } } };
  const checks = [
    ['the control arm is clean', approvalOffenders(tree, manifest, re).length === 0],
    ['a new skill with no entry is reported', /gamma: a skill directory with no approved/.test(approvalOffenders({ ...tree, gamma: { 'SKILL.md': Buffer.from('g') } }, manifest, re).join('\n'))],
    ['one byte changed is reported', /alpha: content differs/.test(approvalOffenders({ ...tree, alpha: { 'SKILL.md': Buffer.concat([tree.alpha['SKILL.md'], Buffer.from(' ')]) } }, manifest, re).join('\n'))],
    ['a renamed file inside a skill is reported', /beta: content differs/.test(approvalOffenders({ ...tree, beta: { 'SKILL.md': tree.beta['SKILL.md'], 'ref/notes2.md': tree.beta['ref/notes.md'] } }, manifest, re).join('\n'))],
    ['a removed skill is reported', /beta: approved but absent/.test(approvalOffenders({ alpha: tree.alpha }, manifest, re).join('\n'))],
    ['an approval with no decision id is reported', /alpha: its "approved" field names no decision/.test(approvalOffenders(tree, { skills: { ...manifest.skills, alpha: { ...manifest.skills.alpha, approved: 'looked fine' } } }, re).join('\n'))],
    ['the hash is order-independent', skillHash({ b: Buffer.from('2'), a: Buffer.from('1') }) === skillHash({ a: Buffer.from('1'), b: Buffer.from('2') })],
  ];
  let ok = true;
  for (const [label, pass] of checks) { console.log(`SELF-TEST: ${label} [${pass ? 'ok' : 'FAILED'}]`); ok &&= pass; }
  return ok ? 0 : 2;
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const hashDir = arg(argv, 'hash');
  if (hashDir) {
    if (!existsSync(hashDir) || !statSync(hashDir).isDirectory()) { console.error(`no such directory: ${hashDir}`); return 2; }
    const files = walk(resolve(hashDir));
    console.log(JSON.stringify({ sha256: skillHash(files), files: Object.keys(files).length, approved: '<DECISION-ID>: <what the owner read and approved>' }, null, 2));
    return 0;
  }
  const skillsDir = arg(argv, 'skills-dir', 'skills');
  const manifestPath = arg(argv, 'manifest', 'approved-skills.json');
  let decisionRe;
  try { decisionRe = new RegExp(arg(argv, 'decision-re', '\\bDEC-\\d+\\b')); } catch (e) { console.error(`bad --decision-re: ${e.message}`); return 2; }
  if (!existsSync(skillsDir)) { console.error(`REFUSED (exit 2): no skills directory at ${skillsDir}`); return 2; }
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { console.error(`REFUSED (exit 2): cannot read manifest ${manifestPath}: ${e.message}`); return 2; }
  let tree; let loose;
  try { ({ tree, loose } = readSkillTree(skillsDir, { allFiles: argv.includes('--all-files') })); } catch (e) { console.error(`REFUSED (exit 2): cannot list ${skillsDir}: ${e.message}`); return 2; }
  if (Object.keys(tree).length === 0) { console.error(`REFUSED (exit 2): zero skill directories under ${skillsDir}; a census that found nothing is not a pass`); return 2; }
  const offenders = [...loose.map((f) => `${f}: a loose file at the top of the skills dir (every skill is a directory)`), ...approvalOffenders(tree, manifest, decisionRe)];
  if (offenders.length) {
    console.log(`SKILL APPROVAL: ${offenders.length} offender(s) over ${Object.keys(tree).length} skill(s):`);
    for (const o of offenders) console.log(`  ${o}`);
    console.log('A changed skill is a new instruction. Show the owner the diff; only their approval, recorded as a decision, updates the manifest.');
    return 1;
  }
  console.log(`SKILL APPROVAL: all ${Object.keys(tree).length} skill(s) match an approved hash that names a decision.`);
  return 0;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) process.exit(main(process.argv.slice(2)));
