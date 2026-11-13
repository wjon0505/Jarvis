<!-- jarvis-kit: generic adaptation of the orchestration model of a production multi-agent setup; real values replaced with placeholders. -->
# 01. Architecture: who does what

## The shape

```text
Owner (a human: decides money, legal text, credentials, pushes, deploys)
  ORCH: the orchestrator session (a "COO"). Talks to the owner, allocates ids, merges, owns the docs.
    Department heads: long-running sessions of their own (Engineering, Growth, Legal, Internal tools...)
      Lanes: short-lived worker agents, one scoped item each, in their own git worktree
    Reviewers: independent sessions that never see the team's reasoning (docs/04)
```

### Why department heads are separate sessions, not subagents
A head running in its own terminal session has its own context window, its own agent limit and its own
research budget. Its workers never appear in the orchestrator's context, and their output never fills it.
The orchestrator reads each head's **STATUS** and **BELL** files only, never a report body, and never
dispatches workers on a head's behalf.

### Lanes
A lane is one agent that owns one item end to end: the change, its tests, its gates, its commits and a
short handback. Lanes are picked by subject (backend, frontend, integration, security, verifier,
persona audit), and each runs in its own worktree created from the main branch at the sha the brief names.

- **Write the brief from the code, not from the ticket.** Before dispatch, run
  `git log --oneline --all | grep -iE '<id>|<topic>'` and open the code the ticket cites. A ticket
  describes the defect at filing time, not the tree at dispatch time.
- **End every brief with "tell me where this brief is wrong."** A brief written from a report is a
  hypothesis; the lane is closer to the code. Lane corrections are often the most valuable output.
- **Write the sequence, not the set.** "Copy env → install → build → gates" as numbered, runnable steps.
  A sequence that is executed gets tested every run; a sequence that is only read gets tested by nothing.
- **Ids are allocated by the orchestrator in the brief.** Only it can see every id in flight; lanes that
  "take the max and add one" collide.

### Pacing
The gate is the last act of every lane, so lanes started together want the machine together. Keep at
most about three lanes able to reach their final gate in the same window; start the next lane when an
earlier one has gated. Say in the brief when overlap is unavoidable, so the lane reads a slow run
correctly. The orchestrator stays off the machine while lanes gate.

### Merging
Rebase the lane onto the current main branch, merge with `--no-ff` and a message that says what shipped
and the gate numbers, then run the full gate battery on the **merged** tree. Merged-tree gates catch
what per-branch gates miss. Two lanes in one file: decide which merges first and tell both.

## The test slot
One whole-workspace test run on a machine at a time. Two concurrent runs in one checkout can delete each
other's databases; several runs on one machine run it out of memory, and a crash loses every run in
flight. `scripts/slot/gate-run.sh` acquires the slot, waits while a `LOW_MEMORY` flag file exists, runs
the command (optionally inside a memory-capped cgroup), writes the real exit code to a file, and releases
the slot on any exit. A run that is killed by the cap is a crash (exit 137), not a result.

Rules that come with it:
- The slot is released on the holder's message only. A zero-process reading is one instant.
- A self-watch writes `LOW_MEMORY` when available memory drops; seeds, typechecks and dev servers wait on
  it too, not only tests.
- Cap concurrent worktrees (we use three on a 16 GB machine) and clean up on every handback.
- A "is anything heavy running?" `pgrep` in a brief is not a control: it matches its own command line.

## The doorbell: BELL, STATUS, INBOX
Every head works from a folder `<HQ>/<dept>/` (template in `templates/hq/`):

| File | Rule |
|---|---|
| `STATUS.md` | at most 15 lines, overwritten: stage, done, next, blockers, usage reading |
| `BELL` | at most 5 lines, written when a stage ends or the head is blocked. The orchestrator's watcher wakes on it |
| `ASKS.md` | owner decisions, one per line, each with a recommendation; the orchestrator batches them into one prompt |
| `INBOX.md` | candidates and requests for this head, newest last |
| `STATE` | append-only: what the head is doing and waiting on, so a restart resumes cleanly |
| `NOTES.md` | the head's verdicts and the evidence behind them |
| `outbox/` or `to-<dept>/` | specs handed to another department |

The orchestrator runs **one** background watcher (`scripts/hq/doorbell.sh`) that exits on any BELL change,
or on a stall (a head's STATE older than an hour while the machine is idle). It reads the BELL, acts, and
re-arms the watcher. Polling a lane that has not reported wastes context; the doorbell replaces it.

Every handback is at most 25 lines: final sha and last-gate sha; what the premise check found; what
changed, with fail-then-pass evidence; decisions logged; gate numbers and exits; rows filed and closed;
what could not be verified; owner-gated items. Detail lives in files and the handback names the path.

### Usage limits per department
On a shared subscription, departments stop dispatching at different points of the weekly limit, so the
work that matters most keeps headroom. Ours, as an example: research and legal stop at 70%, partnerships
at 80%, engineering at 85%, the orchestrator keeps to 90%, and the last 10% is reserved for the end of the
week.

### Which machine runs what
The coordinating machine (the orchestrator, the browser, mail) must outlive its lanes:
`scripts/hq/load-guard.sh` stops a head before that machine runs short. Build lanes default to a separate
build machine that restarts itself after a crash. Heads start with `scripts/hq/launch-head.sh`.

## Long-running sessions on a second machine
Heads can run in `tmux` (or any multiplexer) on a build machine. A watchdog (`scripts/watch/`) recreates
a dead session and resumes its conversation. **A keystroke the watchdog sends is never approval**: if a
nudge can answer a dialog, it can answer a deletion prompt, so destructive actions need the owner's typed
word through the orchestrator. Heads ask questions in their BELL and keep working; a question typed into
a terminal pane can wait an hour unseen.

## Company rhythm (optional)
- A weekly one-page operating report built from each department's STATUS.
- An environment-improvement department on a two-day cycle: survey skills, plugins and methods, propose
  additions and removals (quality effect first, efficiency second), measure after adoption.
- A morning handoff file for the owner: what finished, what waits on them.
