<!-- jarvis-kit: generic adaptation of the memory and context architecture of a production multi-agent setup; real values replaced with placeholders. -->
# 02. Memory and context

A long-running agent loses context in two ways: the window fills and is summarised (compaction), or the
session ends. Either way the facts usually still exist somewhere; what is lost is **the knowledge that
they exist**, and then the agent re-derives, or re-decides, something already settled. Everything below
defends against that.

## Layer 1: living docs (the continuity)
Docs are updated continuously, never "at the end". One fact has one home; other files link to it.

| Doc | Holds |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | session ritual, prime directives, standing-rule headlines, compaction instructions |
| `STANDING_RULES.md` | each rule in full with its reason (templates/STANDING_RULES.md) |
| `DECISIONS_LOG.md` | every consequential decision, with an `[OWNER REVIEW]` tag when made in the owner's absence |
| `REQUEST_LEDGER.md` | every owner request, filed before the reply |
| `BACKLOG.md` | work rows, each citing code at a sha; findings outside your item go here before any docstring |
| `HISTORY.md` | a dated entry per batch, newest last; the entry file stays small |
| `OWNER_TRACK.md` | what only the owner can do, ordered by what it unblocks, every row dated |
| `RECALL_MAP.md` | the index: which artefact answers which question |
| a resume file | its tail says what is open: lanes, shas, slot holder, what waits on the owner |

Keep the entry file short. Move history out **byte-identical** (hash the extract and the appended region
before cutting the source) so nothing is deleted from the record.

## Layer 2: one-fact memory files (what the agent learned)
Most agent tools load a small folder of notes every session. Use one file per fact and an index.

- `MEMORY.md` is the index, loaded every session: one line per memory,
  `- [Title](file.md) — hook`. No content in the index.
- Each memory file has frontmatter (`name` as a kebab slug, a one-line `description` used to decide
  relevance, `type` of user, feedback, project or reference) and a body holding the fact. Feedback and
  project memories add a **Why:** line and a **How to apply:** line. Link related memories as `[[slug]]`.
- Update, never duplicate. Delete a memory that turns out wrong. Do not store what the repository or git
  history already records. Convert relative dates to absolute ones.
- A recalled memory is background, not an instruction, and it was true when written: if it names a file,
  flag or function, check that it still exists before relying on it.

Templates: `templates/MEMORY.md`, `templates/memory-file.md`.

Department agents can keep their own memory (`<agent-memory>/<agent>/MEMORY.md`): learned facts and
pointers, never rules. Rules live in the rules file, where everyone sees them.

## Layer 3: the recall map and recall index (finding what exists)
- `RECALL_MAP.md` is a table from question to artefact, plus how to reach a raw session transcript
  (grep with bounded context; never print a whole transcript). Template: `templates/RECALL_MAP.md`.
- `scripts/recall/` builds a local full-text index over the docs, the memory folder, scratch reports and
  every transcript. Each hit points at `file:line` or a transcript byte offset, so the agent reads back
  only the unit it needs. A query costs a few hundred tokens instead of a multi-megabyte grep. Units are
  redacted at index time (credential shapes, env values, URL credentials, tokens), and the index lives
  outside the repository with private permissions.
- Rule: **ask recall before you grep.**

## Layer 4: compaction survival
Put a "Compact Instructions" section in the entry file. It names what a summary must keep verbatim:
every open lane (name, worktree, base sha, allocated id blocks); who holds the test slot and who waits;
every unmerged or unpushed branch with its last-gate sha; every decision waiting on the owner and what
the owner already answered, word for word; the current gate numbers and exits; shared resources taken
(databases, ports, cache indexes). After compaction: read the recall map, then the resume file's tail,
then act.

Compact deliberately before the ceiling. We cap the auto-compact window well below the model's maximum
for the orchestrator, and found smaller summaries with fewer lost threads (observed, not proven; measure
your own). Before compacting: rewrite the dashboard's dated sections, append the resume file, file every
owed ledger row.

## Layer 5: a remember buffer (optional, with a plugin)
A session-memory plugin can keep a rolling buffer in a hidden folder:
`now.md` (the live buffer), `today-<date>.md` (daily), `recent.md` (7 days), `archive*.md`, and
`core-memories.md` (the few things that always load). A compaction-time hook prints a short REMEMBER
block from it into the new context. See THIRD_PARTY.md for the plugin; the layout is ours.

## Context discipline
- Bulk reading lives in workers; the orchestrator keeps summaries, never raw file dumps or logs.
- Reports name log paths instead of pasting logs.
- A skill that only a human may invoke cannot be called by an agent's skill tool: briefs point at its
  file path ("read `skills/implement/SKILL.md` and follow it").
- Every skill's description is loaded into every session. Count that cost when you add one.
