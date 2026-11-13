<!-- jarvis-kit: generic adaptation of the quality gates of a production multi-agent setup; real values replaced with placeholders. -->
# 03. Gates and rules: when is something done

## An item is done only when all of these hold
1. The change is committed on the lane branch, on a clean tree.
2. The red-first test exists: the test, its failing run, its passing run, all in the handback.
3. The gate battery passed **at the final sha**, each exit captured unpiped (`scripts/run-gate.sh`).
4. The secrets sweep is clean (`scripts/secrets-sweep.sh`), chained with `&&`.
5. Anything a person sees was checked in a real browser, with screenshots.
6. The ledgers are updated in the same change: rows closed with where in code, decisions logged.
7. After merge, the battery passes again on the merged tree.

## The battery (adapt to your stack)
| Gate | Catches |
|---|---|
| typecheck, every package | type drift between packages; derive the count of programs from the log, never recite it |
| unit and integration tests | behaviour |
| guards (invariant specs) | rules about the codebase itself: every route registered, every set enumerated, no secret on a path |
| a boot test | the real application module compiles and starts |
| dependency audit with a reasoned allow-list | known advisories (`scripts/npm-audit-gate.mjs`) |
| static analysis against a baseline | new findings only |
| secrets sweep | committed credentials |
| skill-content approval | agent instruction bytes changed without the owner's approval (`scripts/skill-approval/`) |

Gates run through the test slot (docs/01) on shared machines.

## Reading a result honestly
- Green from a loaded machine stands; red from one stands too unless it has the contention signature.
- A crash (139, 143, 134, no summary, zero failures) is not a result: re-run once and say so.
- A red across a machine sleep is void.
- A number in a report is a claim until the log shows it.
- When unsure, report "observed, not proven" and say what would prove it.

## Owner decisions
- Decisions go to the owner as **structured prompts** (a question with 2-4 options, the recommended one
  first and labelled), batched when several are ready. Most agent tools have a question tool; plain text
  works too.
- A dismissed prompt is not consent for copy, legal text, money, pushes or deploys. Re-ask in plain text.
- Decisions the orchestrator takes in the owner's absence go in the decisions log tagged `[OWNER REVIEW]`.
- Only a short list of things stops a build item outright (ours: real customer personal data, real
  messages to real people, live money movement). Every other open question is filed as a row and the work
  continues under a stated assumption.

## The rules
`templates/STANDING_RULES.md` holds 21 numbered rules and the owner and ledger rules, each with its
reason. Domain rules that load only when an agent touches matching files live in `rules/`.

## Ledgers
Formats with fictional rows: `templates/REQUEST_LEDGER.md`, `templates/DECISIONS_LOG.md`,
`templates/BACKLOG.md`, `templates/HISTORY.md`, `templates/OWNER_TRACK.md`, `templates/HANDOFF.md`.
