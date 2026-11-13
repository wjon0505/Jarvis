<!-- jarvis-kit: generic adaptation of the session-start instructions of a production multi-agent setup; real values replaced with placeholders. -->
# AGENTS.md: read this first

You are an agent reading the Jarvis starter kit. It describes how one team runs software work with
many AI agents at once, and it gives you the formats and scripts to do the same in another project.

## If you are adopting the kit into a project
1. Read `docs/01` to `docs/05` in order. Each is short.
2. Read the target project before proposing anything: its stack, its test command, its existing docs.
3. Propose a plan to the owner: which templates, rules, scripts and agents fit, and which do not. Say why.
4. Adapt; never copy blind. Replace every `<PLACEHOLDER>`, delete rules that do not apply, and keep what
   you keep numbered and stable.
5. Third-party items in `THIRD_PARTY.md` are suggestions. Read each one's source before installing it,
   and install nothing without the owner's yes (`docs/05`).

## If you are working inside a project that already uses it
Session start ritual:
1. Read the project's `AGENTS.md` (or `CLAUDE.md`), then its plan, then the newest entries of its
   decisions log.
2. If you were compacted or are resuming cold, read `RECALL_MAP.md` first, then the tail of the resume
   file. A compacted session rarely loses a fact; it loses the knowledge that the fact exists.
3. Ask the recall index before grepping (`scripts/recall/`).
4. Update docs as you go, not at the end.

## Prime directives
1. **Quality and security are never traded for speed.** Speed comes from parallel work.
2. **Build the foundation so later phases attach without rework.**
3. **Central brain, thin adapters.** One source of truth; every external system sits behind a common
   interface and a config toggle, with a mock.
4. **Research before building anything that depends on an outside standard or API.** No facts from
   memory for things that change; cite the primary source and its date.
5. **Run independent work in parallel**, under the gates in `docs/03`.
6. **Keep context small.** Bulk reading happens in workers; the orchestrator reads summaries.
7. **One doorway per concept.** When a new surface replaces an old one, remove the old one in the
   same change (after the new one does everything the old one did).

## Where to look
| Question | File |
|---|---|
| How is the work organised? | docs/01-architecture.md |
| How do I remember things across sessions? | docs/02-memory-and-context.md |
| When is something done? | docs/03-gates-and-rules.md |
| How is work reviewed? | docs/04-review-loops.md |
| What must I never do? | docs/05-safety.md |
| What does a lane brief look like? | templates/BRIEF.md |
| What role definitions exist? | agents/README.md |
