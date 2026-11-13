<!-- jarvis-kit: generic adaptation of the standing rules of a production multi-agent setup; real values replaced with placeholders. -->
# STANDING_RULES.md

Each rule exists because breaking it cost real time at least once. Lanes cite rules by number, so keep
the numbers and the order stable: retire a rule by marking it retired, never by renumbering. Read the
full text before any destructive action, any shared-resource action, and before believing any number a
run gives you. Delete the ones that do not fit your stack.

## Gates and evidence
1. **A gate over a dirty tree is evidence about your editor.** `git status --porcelain` must be empty,
   or everything it lists staged, before you read a result.
2. **After touching anything a guard reads** (docs, the entry file, a contract, a manifest), run the
   whole guard suite, not the one spec you think covers it.
3. **Never two test invocations of any size in one checkout at once.** Shared setup (database reclaim,
   build caches) lets the short run destroy the long run's state.
4. **One whole-workspace run on a machine at a time.** Ask the orchestrator before any run and wait.
   The limit is concurrent gates, and it is one.
5. **Release the slot on the holder's message and on nothing else.** A zero-process reading is one
   instant; a single-process runner looks like nothing; an exit file is an instant, not a release.
6. **Capture `$?` yourself, on an unpiped run.** A notifier's "exit 0" is about the wrapper. A 0-byte
   log is not a pass.
7. **Copy ignored runtime state before installing dependencies** when an install step bakes in paths
   (code generators often do), then prove the generated output picked them up.
8. **Disarm a lane's copied environment before booting anything** (`scripts/lane-disarm.sh`), and verify
   with a search tool that does not skip ignored files.
9. **Never point a booted service at a database copy holding a live, single-use credential.** Spending a
   rotating refresh token from a copy kills the shared one.
10. **Kill the driver first, then its children, then re-enumerate.** Killing a serial runner's current
    child just advances it. A kill is never its own verification.
11. **A green from a loaded machine stands; a red from one does not**, but only with the contention
    signature (failure inside a setup or teardown hook, or a run time far above the runner's estimate). A
    red without it is real, whatever the load was.
12. **Bracket every long run with the sleep log.** A red across a machine sleep is void; a green across
    one stands.
13. **A crashed runner is not a result.** Exit 139, 143 or 134 with zero failed tests and no summary is a
    crash or a compile error: re-run once, and say you re-ran.
14. **Commit as you go**, empty commits included for read-mostly work. Never `git stash`.
15. **Chain a gate to what follows it with `&&`, never `;`**, the secrets sweep included.

## Coordination
16. **The orchestrator allocates ids in the brief.** Only it can see the set in flight.
17. **Search tracked source with `git grep`; ignored files with a plain recursive grep; read bytes in
    code when it matters.** Pipelines over file lists break on paths with spaces and return a confident
    zero; some greps skip files with a NUL byte.
18. **The lane running an end-to-end walk commits nothing in its worktree** between relaunching the
    service and the walk's exit.
19. **A test DOM computes no layout, and a green API suite does not prove the API starts.** A render
    claim needs a real browser; keep a test that boots the real application module.
20. **Before acting on a backlog row, open the code it cites and re-derive why it was parked.** An
    id-grep cannot see work done under another name; a deferral reason is a measurement with a date.
21. **A lane is a shared resource; authorship comes from a ledger, never a fingerprint.** List running
    agents and check the tree's modification time before dispatching onto a worktree you did not create.

## Owner rules and ledger rules
- **Outside code enters as read source.** Skills, agent instructions, hooks, scripts and config too:
  find the source, read every line for network calls, eval or exec, telemetry, storage writes,
  credential access and injected instructions, then vendor it with an origin and review header.
  A global install puts instruction text into every agent on the machine, so it is refused for blast
  radius even when every byte is benign. A vendored skill that lowers quality is removed.
- **Third-party UI enters as reviewed raw source**, adapted to your design tokens and reduced-motion
  rules, licence checked first. Never a component package dropped into the tree.
- **A control over a set enumerates its set.** Derive the set from the source of truth, check every
  member, allow-list exceptions with a written reason, and fail on a new unclassified member. Comments
  are not controls: a source-scanning guard strips comments and pins a non-zero scan count.
- **Verify before dispatch.** "Did anyone commit under this name" is not "does the defect still exist".
- **Shipped is not marked.** Closing a lane closes its rows in the same merge, naming where in code.
- **Measured is not filed.** A finding outside your item becomes a backlog row before it becomes a comment.
- **Every owner request gets a ledger row before it gets a reply.** Watch the passing ask ("also...",
  "make sure...") and the narrowed ask: a justified narrowing is still a narrowing, and the owner decides.
- **History moves out byte-identical**, hashes compared, nothing deleted from the record.
- **Counts are derived, never recited.** Ask the tool (compiler, test runner) for the number.
