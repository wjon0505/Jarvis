<!-- jarvis-kit: generic adaptation of a production multi-agent setup; real values replaced with placeholders. -->
# Jarvis

Jarvis is a starter kit for running a software company with AI coding agents. It is the environment one
founder built for a real product, with every company detail removed: how one orchestrator session
directs department heads and worker lanes, how memory and context survive compaction, the gates and
standing rules that keep quality from slipping, and the skills, agents, hooks and scripts that hold it
together.

It works with any agent that reads Markdown: Claude Code, Codex, Gemini CLI, Cursor, Aider or your own.
The tool-specific parts are under `adapters/`.

## Point your agent here

Tell your agent:

> Read AGENTS.md in this repository, then docs/ in order. Propose which parts fit my project, and
> adapt the templates to it. Do not install anything listed in THIRD_PARTY.md until you have read its
> source and I have approved it.

## Quick start (5 minutes)

1. Copy `templates/AGENTS.md` and `templates/CLAUDE.md` into your repository root. Fill in the
   placeholders (`<PRODUCT>`, `<STACK>`, `<GATE_CMD>`).
2. Copy `templates/STANDING_RULES.md` to `docs/STANDING_RULES.md`. Delete the rules that do not apply
   to you, and keep the numbering stable once lanes cite it.
3. Create the ledgers from `templates/`: `REQUEST_LEDGER.md`, `DECISIONS_LOG.md`, `RECALL_MAP.md`.
4. Set up the memory folder your tool loads every session from `templates/MEMORY.md` and
   `templates/memory-file.md` (see docs/02).
5. Put `scripts/secrets-sweep.sh` and `scripts/run-gate.sh` in front of every merge.
6. When you run more than one agent at a time, add the test slot (`scripts/slot/`) and read docs/01.

## What is here

| Path | What it holds |
|---|---|
| `AGENTS.md` | the tool-neutral entry point an agent reads first |
| `CLAUDE.md` | a pointer to AGENTS.md for Claude Code |
| `docs/01-architecture.md` | orchestrator, department heads, lanes and worktrees, the test slot, the BELL/STATUS doorbell |
| `docs/02-memory-and-context.md` | one-fact memory files, the recall map and index, compaction survival, living docs |
| `docs/03-gates-and-rules.md` | the gate battery, the secrets sweep, the standing rules, decision prompts, ledgers |
| `docs/04-review-loops.md` | the blind reviewer, rubric rounds, independent verification |
| `docs/05-safety.md` | what never leaves, credentials, destructive actions, outside code, usage limits |
| `agents/` | role definitions for build lanes, reviewers and department heads |
| `rules/` | domain rules that load when an agent touches matching files |
| `skills/` | skills we wrote ourselves |
| `scripts/` | secrets sweep, gate runner, test slot, watchdog, lane disarm, usage meter, recall index, skill approval |
| `hooks/` | hooks we wrote, as plain scripts |
| `templates/` | every ledger, brief, memory and workspace format, with fictional examples |
| `adapters/<tool>/` | tool-specific wiring and its equivalent in other tools |
| `THIRD_PARTY.md` | the third-party skills, plugins and servers we use: links, licences, why, and how to vet them |

## The ideas that matter most

1. **Speed comes from parallel work, never from skipped checks.** Every lane passes the same gates.
2. **One fact, one home.** Docs are the continuity between sessions; a session assumes it remembers nothing.
3. **A green you did not see is not a green.** Capture exit codes yourself, on a clean tree, and keep the count.
4. **Outside code enters as read source.** Read every line of a skill, hook or script before it runs.
5. **The owner decides money, legal text, credentials, pushes and deploys.** Agents prepare; the owner says yes.

## Licence

See `LICENSE`. Third-party work is linked, not copied, and keeps its own licence.
