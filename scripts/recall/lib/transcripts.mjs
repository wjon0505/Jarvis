// jarvis-kit: generic adaptation of the recall index's transcript reader from a production multi-agent setup; real values replaced with placeholders.
/**
 * transcripts.mjs: read JSONL agent transcripts by BYTE offset and turn records into index units.
 *
 * Offsets are bytes, not characters, so a hit at `file@offset` can be read back with `dd` or
 * `fs.read` and `JSON.parse`d with no scan, and never `cat` a multi-megabyte transcript to find it.
 * Files are read in 4 MiB slices; only complete lines (ending in `\n`) are consumed, so a transcript
 * still being written is never read mid-record. The incomplete tail waits for the next update,
 * unless the file has been quiet long enough to consume it.
 *
 * ADAPTER: `unitFromRecord` below understands ONE format, Claude Code's session JSONL (records with
 * `type` user/assistant and `message.content` blocks text / tool_use / tool_result). It is the only
 * tool-specific code in the recall index. For another agent tool, write a function with the same
 * contract (record in, `{ key, text, session, agent, ts, cwd, isToolResultOnly }` or null out), add
 * a `transcripts.format` name for it in config.mjs, and dispatch on it in index.mjs.
 */
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';

const SLICE = 4 * 1024 * 1024;
export const TOOL_RESULT_CAP = 1500;
export const TEXT_CAP = 6000;
export const RECORD_CAP = 8000;

/** Yields { start, end, line } for every complete line from `fromOffset`; returns the resume offset. */
export function* iterateJsonl(path, fromOffset = 0, { consumeTail = false } = {}) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    let pos = Math.min(fromOffset, size);
    let pending = Buffer.alloc(0);
    let pendingStart = pos;
    const slice = Buffer.allocUnsafe(SLICE);
    while (pos < size) {
      const n = readSync(fd, slice, 0, SLICE, pos);
      if (n <= 0) break;
      pos += n;
      const buf = pending.length ? Buffer.concat([pending, slice.subarray(0, n)]) : Buffer.from(slice.subarray(0, n));
      let from = 0;
      for (;;) {
        const nl = buf.indexOf(10, from);
        if (nl === -1) break;
        let lineEnd = nl;
        if (lineEnd > from && buf[lineEnd - 1] === 13) lineEnd -= 1;
        if (lineEnd > from) yield { start: pendingStart + from, end: pendingStart + nl + 1, line: buf.toString('utf8', from, lineEnd) };
        from = nl + 1;
      }
      pending = buf.subarray(from);
      pendingStart += from;
    }
    if (pending.length > 0 && consumeTail) {
      const text = pending.toString('utf8').replace(/\r$/, '');
      if (text.trim()) yield { start: pendingStart, end: pendingStart + pending.length, line: text };
      return pendingStart + pending.length;
    }
    return pendingStart;
  } finally {
    closeSync(fd);
  }
}

const cap = (s, n) => (s.length > n ? `${s.slice(0, n)} …[+${s.length - n} chars]` : s);

/** Tool-input fields worth indexing, with a cap each. Anything else is summarised as JSON. */
const INPUT_FIELDS = [
  ['command', 1200], ['description', 300], ['file_path', 400], ['path', 400], ['pattern', 300],
  ['glob', 300], ['query', 300], ['url', 300], ['skill', 100], ['args', 300], ['subagent_type', 60],
  ['prompt', 1200], ['message', 1200], ['to', 60], ['old_string', 300], ['new_string', 300], ['content', 300],
];

function summarizeInput(input) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'object') return cap(String(input), 500);
  const parts = [];
  for (const [k, n] of INPUT_FIELDS) {
    const v = input[k];
    if (v !== undefined && v !== null) parts.push(`${k}=${cap(typeof v === 'string' ? v : JSON.stringify(v), n)}`);
  }
  if (parts.length === 0) parts.push(cap(JSON.stringify(input), 500));
  return parts.join(' ');
}

function textOfResult(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  return '';
}

/** ADAPTER (Claude Code JSONL): one record -> one unit, or null. Thinking and image blocks are not indexed. */
export function unitFromRecord(rec) {
  if (!rec || (rec.type !== 'user' && rec.type !== 'assistant')) return null;
  const msg = rec.message;
  const content = msg && typeof msg === 'object' ? msg.content : msg;
  const parts = []; const tools = []; let hasResult = false;
  if (typeof content === 'string') parts.push(cap(content, TEXT_CAP));
  else if (Array.isArray(content)) {
    for (const b of content) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'text' && typeof b.text === 'string') parts.push(cap(b.text, TEXT_CAP));
      else if (b.type === 'tool_use') {
        const name = typeof b.name === 'string' ? b.name : 'tool';
        tools.push(name);
        parts.push(`TOOL ${name}: ${summarizeInput(b.input)}`);
      } else if (b.type === 'tool_result') {
        hasResult = true;
        const t = textOfResult(b.content);
        if (t) parts.push(`RESULT${b.is_error ? ' (error)' : ''}: ${cap(t, TOOL_RESULT_CAP)}`);
      }
    }
  }
  const body = parts.join('\n').trim();
  if (!body) return null;
  const keyParts = [rec.type];
  if (tools.length) keyParts.push('tool_use', ...new Set(tools));
  if (hasResult) keyParts.push('tool_result');
  return {
    key: keyParts.join(' '),
    text: cap(body, RECORD_CAP),
    session: typeof rec.sessionId === 'string' ? rec.sessionId : null,
    agent: typeof rec.agentId === 'string' ? rec.agentId : null,
    ts: typeof rec.timestamp === 'string' ? rec.timestamp : null,
    cwd: typeof rec.cwd === 'string' ? rec.cwd : null,
    isToolResultOnly: hasResult && tools.length === 0 && parts.every((p) => p.startsWith('RESULT')),
  };
}

/** Session and agent ids implied by a path `<session-uuid>.jsonl` or `<session-uuid>/subagents/agent-<id>.jsonl`. */
export function idsFromPath(path) {
  const m = /([0-9a-f-]{36})(?:\/subagents\/agent-([0-9a-f]+))?\.jsonl$/.exec(path);
  return m ? { session: m[1], agent: m[2] ?? null } : { session: null, agent: null };
}
