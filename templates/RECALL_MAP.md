<!-- jarvis-kit: template recall map; generic adaptation from a production multi-agent setup. -->
# RECALL_MAP.md: where every kind of fact lives

A compacted session does not lose facts so much as lose the knowledge that a fact exists. Given a
question, this says which artefact answers it, and when nothing does, how to reach the raw transcript.
**Read this when** you were compacted, you are resuming, or you are about to re-derive something that
smells decided.

## Ask recall first
```bash
node scripts/recall/recall.mjs "REQ-0042"                 # an id: its own row first, then what cites it
node scripts/recall/recall.mjs "retry policy" --source decisions
node scripts/recall/recall.mjs "3f9a1c*"                  # a sha prefix
node scripts/recall/recall.mjs --show 123                  # the whole unit behind a hit
node scripts/recall/recall.mjs --update                    # after docs or transcripts changed
```

## The retrieval order
Go to the FIRST artefact that could hold the answer. Do not read them all.

| The question | Where it lives |
|---|---|
| What did the owner ask for, exactly? | docs/REQUEST_LEDGER.md |
| Was this decided, and why? | docs/DECISIONS_LOG.md |
| Is this work open, done, or parked, and why parked? | docs/BACKLOG.md (then open the code it cites) |
| What happened in batch N? | docs/HISTORY.md |
| What waits on the owner? | docs/OWNER_TRACK.md |
| What is in flight right now? | the resume file's tail; each head's STATUS.md |
| What rule applies? | docs/STANDING_RULES.md, rules/ |
| What did an agent learn? | the memory folder index; agent memory folders |
| None of the above | the raw transcripts, below |

## Reaching a raw transcript
Transcripts live in `<TRANSCRIPT_DIR>`, one file per session. Never print a whole one. Grep for an id or
phrase with bounded context, e.g. `grep -o '.\{200\}REQ-0042.\{200\}' <file>`, then read the unit around
the byte offset.
