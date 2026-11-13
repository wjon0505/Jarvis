<!-- jarvis-kit: template lane brief; generic adaptation from a production multi-agent setup. -->
# BRIEF <LANE-ID>: <one-line title>

**Type:** build | verify | follow-up. **Agent:** agents/<role>.md. **Ids allocated:** B-____..B-____, DEC-____.
**Base:** worktree from `main` at `<sha>`. **Do not:** add dependencies, push, deploy, touch live credentials.

## The defect and its evidence
<what is wrong, file:line at the base sha, how it was observed>

## Premise check (do this first)
Open the code cited above and confirm the defect still exists at the base sha. Run
`git log --oneline --all | grep -iE '<id>|<topic>'` to find work done under another name. If the premise is
false, stop and say so in the handback.

## Judgement calls that are yours
<what the lane decides; what it must escalate>

## Sequence (run in this order)
1. Create the worktree; copy ignored runtime state (derive the list with `git check-ignore`).
2. Disarm: `scripts/lane-disarm.sh`, then verify.
3. Install, then build shared packages.
4. Write the failing test first; run it; see it fail for the right reason.
5. Make the change; see the test pass.
6. Two-axis review of your diff before the handback.
7. Ask the orchestrator for the slot; run the gate battery through `scripts/slot/gate-run.sh` at the final
   sha on a clean tree; capture each exit yourself.
8. Commit as you go. Never stash.

## Standing rules that have cost time before
<paste the 3-5 rule numbers and lines that matter for this item>

## Questions
Ask in the BELL file and keep working; do not wait in the terminal.

## Handback (at most 25 lines)
final sha · last-gate sha · premise check result · what changed with red/green evidence · decisions logged ·
gate numbers and exits · rows filed and closed · what you could not verify · owner-gated items.

**Tell me where this brief is wrong.**
