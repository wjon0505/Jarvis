#!/usr/bin/env node
// jarvis-kit: generic adaptation of a plan-usage meter from a production multi-agent setup; real values replaced with placeholders.
//
// usage-meter.mjs: pace agent dispatch on the limits that actually govern you (the provider's own
// plan accounting), not on token or dollar guesses.
//
//   node scripts/usage-meter.mjs                     read usage through the adapter, print a verdict
//   node scripts/usage-meter.mjs --json              machine-readable
//   node scripts/usage-meter.mjs --from <file>       parse saved adapter output instead of running it
//   node scripts/usage-meter.mjs --session 40 --week 61 [--premium 12] [--session-reset <ISO time>]
//                                                    give the numbers by hand (any tool, any provider)
//
// POLICY (the reason this exists; change thresholds, keep the shape):
//   · STOP at USAGE_WEEKLY_STOP_PCT (default 97) weekly. A weekly cap cannot be waited out today:
//     finish the item in hand, write the docs, report.
//   · Pace on the SESSION WINDOW. Compare % used with % of the window elapsed: 40% used in the first
//     10% of the window is CONSERVE even though 40 is a low number; 35% used with 20 minutes left
//     is SPEND (room for more lanes).
//   · NEVER run onto paid overage. If a sub-limit spills onto paid credits past its cap (for example
//     a premium model's weekly share), CONSERVE before the cap and move lanes to the included model.
//   · A caption that names a threshold must READ it. A warning printed at every value is noise that
//     eventually gets believed at the wrong value.
//
// THRESHOLDS (env):
//   USAGE_WEEKLY_STOP_PCT=97        USAGE_SESSION_CONSERVE_PCT=90     USAGE_SESSION_WINDOW_HOURS=5
//   USAGE_AHEAD_MARGIN=0.25         USAGE_BEHIND_MARGIN=0.15          USAGE_PREMIUM_CAP_PCT=80
//   USAGE_CMD="claude -p /usage"    (the adapter's command; split on spaces, no shell)
//
// Exit is always 0: the meter informs; the orchestrator decides. UNKNOWN means "treat as NORMAL and
// say so in the batch report", never "assume there is room".
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const num = (name, dflt) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== '' && process.env[name] !== undefined ? v : dflt;
};
const T = {
  weeklyStop: num('USAGE_WEEKLY_STOP_PCT', 97),
  sessionConserve: num('USAGE_SESSION_CONSERVE_PCT', 90),
  windowMs: num('USAGE_SESSION_WINDOW_HOURS', 5) * 3600e3,
  ahead: num('USAGE_AHEAD_MARGIN', 0.25),
  behind: num('USAGE_BEHIND_MARGIN', 0.15),
  premiumCap: num('USAGE_PREMIUM_CAP_PCT', 80),
};

// ── ADAPTER: Claude Code's `/usage` text ─────────────────────────────────────────────────────────
// TOOL-SPECIFIC. This parses the human-readable output of one CLI's usage command, which can change
// shape between releases. Every other part of this file is tool-neutral. To support another tool,
// write a function that returns the same object ({ session, sessionReset, week, weekReset, premium })
// with percentages as numbers (or null) and resets as epoch ms (or null), and call it in readUsage().
export function parseClaudeCodeUsage(raw) {
  const pct = (re) => { const m = raw.match(re); return m ? Number(m[1]) : null; };
  const when = (re) => { const m = raw.match(re); return m ? parseResetText(m[1].trim()) : null; };
  return {
    session: pct(/Current session:\s*(\d+)%/),
    sessionReset: when(/Current session:.*?resets ([^(\n]+)/),
    week: pct(/Current week \(all models\):\s*(\d+)%/),
    weekReset: when(/Current week \(all models\):.*?resets ([^(\n]+)/),
    // Any per-model weekly line other than "all models" is treated as the premium sub-limit.
    premium: pct(/Current week \((?!all models)[^)]+\):\s*(\d+)%/),
  };
}

// "Aug 20 at 12:59pm" or "Aug 20 at 1pm" -> epoch ms, local time zone; rolls into next year if needed.
export function parseResetText(s) {
  const m = s && s.match(/([A-Z][a-z]{2})\s+(\d+)\s+at\s+(\d+)(?::(\d+))?(am|pm)/);
  if (!m) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  let h = Number(m[3]) % 12; if (m[5] === 'pm') h += 12;
  const now = new Date();
  let d = new Date(now.getFullYear(), months[m[1]], Number(m[2]), h, Number(m[4] ?? 0));
  if (d.getTime() < now.getTime() - 30 * 864e5) d = new Date(now.getFullYear() + 1, months[m[1]], Number(m[2]), h, Number(m[4] ?? 0));
  return d.getTime();
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readUsage() {
  if (arg('session') !== undefined) {
    const n = (v) => (v === undefined ? null : Number(v));
    const r = arg('session-reset');
    return { session: n(arg('session')), week: n(arg('week')), premium: n(arg('premium')), sessionReset: r ? Date.parse(r) : null, weekReset: null };
  }
  const from = arg('from');
  if (from) return parseClaudeCodeUsage(readFileSync(from, 'utf8'));
  const [cmd, ...args] = (process.env.USAGE_CMD || 'claude -p /usage').split(' ').filter(Boolean);
  const raw = execFileSync(cmd, args, { encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'] });
  return parseClaudeCodeUsage(raw);
}

/** The verdict. Pure: takes the usage object, thresholds and "now". */
export function verdictOf(u, t, now) {
  const minsLeft = u.sessionReset ? Math.max(0, Math.round((u.sessionReset - now) / 60000)) : null;
  const elapsed = u.sessionReset ? Math.min(1, Math.max(0, 1 - (u.sessionReset - now) / t.windowMs)) : null;
  let verdict; let why;
  if (u.week != null && u.week >= t.weeklyStop) {
    verdict = 'STOP'; why = `weekly is ${u.week}% (stop line ${t.weeklyStop}%). A weekly cap cannot be waited out today: finish the item in hand and report.`;
  } else if (u.session == null) {
    verdict = 'UNKNOWN'; why = 'no session figure: treat as NORMAL and say so in the batch report.';
  } else if (u.session >= t.sessionConserve) {
    verdict = 'CONSERVE'; why = `session ${u.session}% with ~${minsLeft ?? '?'}m left: coast to the reset rather than be cut off mid-item.`;
  } else if (elapsed != null && u.session / 100 > elapsed + t.ahead) {
    verdict = 'CONSERVE'; why = `ahead of pace: ${u.session}% used at ${Math.round(elapsed * 100)}% of the window.`;
  } else if (elapsed != null && u.session / 100 < elapsed - t.behind) {
    verdict = 'SPEND'; why = `under pace: ${u.session}% used at ${Math.round(elapsed * 100)}% of the window: room for more lanes.`;
  } else {
    verdict = 'NORMAL'; why = `on pace: ${u.session}% used, ~${minsLeft ?? '?'}m left in the window.`;
  }
  // Never paid overage: the caption below reads the SAME threshold as this branch.
  const premiumOver = u.premium != null && u.premium >= t.premiumCap;
  if (premiumOver && verdict !== 'STOP') {
    verdict = 'CONSERVE';
    why += ` Premium sub-limit at ${u.premium}% (cap ${t.premiumCap}%): past it, usage spills onto paid credits. Move lanes to the included model.`;
  }
  return { verdict, why, minsLeft, elapsedPct: elapsed == null ? null : Math.round(elapsed * 100), premiumOver };
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) {
  let u;
  try { u = readUsage(); } catch (e) {
    const detail = String(e?.message || e).slice(0, 200);
    if (process.argv.includes('--json')) console.log(JSON.stringify({ verdict: 'UNKNOWN', error: detail }, null, 2));
    else console.error(`USAGE METER: could not read usage (${detail})\n  VERDICT: UNKNOWN: treat as NORMAL and say so in the batch report.`);
    process.exit(0);
  }
  const v = verdictOf(u, T, Date.now());
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ measuredAt: new Date().toISOString(), usage: u, thresholds: T, ...v }, null, 2));
  } else {
    console.log(`USAGE METER (the provider's own plan accounting, not token math)
  session : ${u.session ?? '?'}%  (~${v.minsLeft ?? '?'}m left, window ${v.elapsedPct ?? '?'}% elapsed)
  week    : ${u.week ?? '?'}%  (stop line ${T.weeklyStop}%)
  premium : ${u.premium ?? '?'}%  ${v.premiumOver ? 'PAST ITS CAP: further use spills onto paid credits' : `(cap ${T.premiumCap}%)`}

  VERDICT: ${v.verdict}
  ${v.why}`);
  }
}
