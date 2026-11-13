<!-- jarvis-kit: template entry file for a project; generic adaptation from a production multi-agent setup. -->
# AGENTS.md: project memory (read first, every session)

**Project:** <PRODUCT>. **Stack:** <STACK>. **Test command:** `<GATE_CMD>`.

## Session start ritual
Read in order: this file → `docs/PLAN.md` → the newest entries of `docs/DECISIONS_LOG.md`. Then act.

> **Compacted or resuming cold?** Read `docs/RECALL_MAP.md` first, then the tail of the resume file.
> Ask the recall index before you grep: `node scripts/recall/recall.mjs "<id or question>"`.

Update docs continuously, not at session end. Assume context is lost between sessions.

## Prime directives
1. <PRODUCT> holds <WHAT_IS_SENSITIVE>. Security and quality are never traded for speed; speed comes
   from parallel work.
2. Build the foundation so later phases attach without rework.
3. Central brain, thin adapters: every external system behind a common interface, a config toggle and a mock.
4. Research before building anything that depends on an outside standard; cite primary sources with dates.
5. Run independent work in parallel; every parallel gain passes the same gates.
6. Keep context small; bulk reading happens in workers.
7. One doorway per concept; retire a superseded surface in the same change.

## Development environment
| Tool | Version | Note |
|---|---|---|
| <RUNTIME> | <VERSION> | |
| <DATABASE> | <VERSION> | must be running before DB-dependent work |

## Living docs
| Doc | Holds |
|---|---|
| docs/PLAN.md | goals, task breakdown, status |
| docs/DECISIONS_LOG.md | every consequential decision |
| docs/STANDING_RULES.md | the rules in full |
| docs/REQUEST_LEDGER.md | what the owner asked for; a row before the reply |
| docs/BACKLOG.md | work rows |
| docs/HISTORY.md | batch entries, newest last |
| docs/OWNER_TRACK.md | what only the owner can do |
| docs/RECALL_MAP.md | which artefact answers which question |

## Standing rules (headlines; full text in docs/STANDING_RULES.md)
1. A gate over a dirty tree is evidence about your editor.
2. After touching anything a guard reads, run the whole guard suite.
3. Never two test runs in one checkout at once.
4. One whole-workspace run per machine at a time; ask first.
5. Release the slot on the holder's message only.
6. Capture `$?` yourself, unpiped.
<!-- continue with the rules you keep, same numbers as the full file -->

## Owner actions
Start at `docs/OWNER_TRACK.md`. Money, legal text, credentials, pushes and deploys wait for the owner's
typed word; a dismissed prompt is not consent.

## Compact Instructions
When this conversation is compacted, keep verbatim: every open lane with its name, worktree, base sha and
allocated id blocks; who holds the test slot and who is queued; every unpushed or unmerged branch with
its last-gate sha; every decision waiting on the owner and what the owner already answered, word for
word; the current batch's gate numbers and exits; every shared resource taken (databases, cache indexes,
port blocks). After compaction, read `docs/RECALL_MAP.md` and the resume file's tail before acting.
