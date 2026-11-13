<!-- jarvis-kit: generic adaptation of a script index from a production multi-agent setup; real values replaced with placeholders. -->
# Scripts

Each script refuses rather than passes when it cannot do its job (exit 2 means "the question was not
asked", never "clean"), and most carry a `--self-test` that shows every refusal firing. Run a
script's self-test once on your machine before you trust its verdict.

Chain every gate to what follows it with `&&`, never `;`.

| Script | What it prevents | How to run | Config |
|---|---|---|---|
| `secrets-sweep.sh` | Credentials (private keys, cloud keys, provider tokens, JWTs, connection strings with passwords, tracked `.env` files) reaching the remote. A one-liner that returns a plausible zero. | `scripts/secrets-sweep.sh` (all tracked files) · `--range origin/main` (added lines, before push) · `--self-test` | `.secrets-allowlist` or `$SECRETS_ALLOWLIST`: `<path glob> TAB <literal> TAB <reason>`, scoped by path, reason required |
| `lane-disarm.sh` | A lane worktree's copied env spending a single-use token, a metered key, or sending real mail/SMS. A disarm "verified" by a grep that cannot see ignored files. | after copying the gitignored env into the worktree, before booting anything: `scripts/lane-disarm.sh <worktree>` · `--verify-only <worktree>` | `lane-disarm.keys` (from `lane-disarm.keys.example`): `KEY=blank\|false\|mock\|set:<value>`; `$DISARM_BOOT_ENV`, `$DISARM_GREP` |
| `usage-meter.mjs` | Running out of plan mid-item; spilling onto paid overage; pacing on guesses instead of the provider's own accounting. | `node scripts/usage-meter.mjs` before and during a batch · `--json` · `--session N --week N` by hand | env: `USAGE_WEEKLY_STOP_PCT` (97), `USAGE_SESSION_CONSERVE_PCT`, `USAGE_SESSION_WINDOW_HOURS`, `USAGE_PREMIUM_CAP_PCT`, `USAGE_CMD`. The `/usage` parser is a named adapter. |
| `run-gate.sh` | False greens: a piped exit code, a notifier reporting the wrapper's exit, an exit 0 over zero tests, an empty log, a gate over a dirty tree. | `scripts/run-gate.sh "<name>" -- <GATE_CMD>` then read `$?` yourself · `--self-test` | `RUN_GATE_LOG_DIR`, `RUN_GATE_SUMMARY_RE` (default `^Tests:`; empty for gates with no test summary), `RUN_GATE_ALLOW_DIRTY=1` |
| `npm-audit-gate.mjs` | `npm audit ... \|\| true`; a moderate advisory in shipped code sitting unflagged; allow-list entries that outlive their reason. | `node scripts/npm-audit-gate.mjs` · `--from a.json --from-runtime b.json` · `--self-test` | `security/npm-audit-allowlist.json` (shape: `npm-audit-allowlist.example.json`), `--allowlist` or `$NPM_AUDIT_ALLOWLIST` |
| `recall/recall.mjs` | A compacted or cold session re-deriving a decision it already made because it no longer knows the fact exists; grepping gigabytes of transcripts. | `node scripts/recall/recall.mjs --build` once (hold the test slot), `--update` after work, then `recall.mjs "<id or question>"` · `--self-test` | `recall.config.json` (from `recall/recall.config.example.json`) or `--config` / `$RECALL_CONFIG`; Node 22.5+, no npm deps |
| `skill-approval/check-skill-approval.mjs` | Third-party or self-edited instruction text gaining lasting authority without the owner reading those exact bytes. | `node scripts/skill-approval/check-skill-approval.mjs --skills-dir <dir> --manifest approved-skills.json` · `--hash <dir>/<skill>` · `--self-test` | `approved-skills.json` (shape: `approved-skills.example.json`), `--decision-re`. Two companion checks are described in its README. |
| `slot/slot.sh` | Two whole-workspace test runs at once on one machine (a short run dropping a long run's database; memory exhaustion). Reclaiming a live holder's slot on a guess. | `slot.sh acquire <lane> <what>` · `release <lane>` · `status` · `force-release <who>` (orchestrator only) | `JARVIS_DIR` (default `./.jarvis`), `SLOT_LOCK`, `SLOT_LOG`, `LOW_MEMORY_FLAG` |
| `slot/gate-run.sh` | A test run with no memory ceiling taking the machine down; an OOM kill reported as an ordinary failure; runs during a LOW_MEMORY hold. | `nohup scripts/slot/gate-run.sh <LANE> <what> <logdir> -- <GATE_CMD> &` then poll `<logdir>/<LANE>.<what>.exit` | `JARVIS_DIR`, `SLOT_SH`, `GATE_MEM_MAX` (`none` to disable the systemd scope), `GATE_MIN_AVAIL_MB` |
| `watch/orch-watch.sh` | A long-running head session dying with nobody noticing; the terminal being the only way back. | every 2 minutes from cron or a systemd timer | `ORCH_SESSION`, `ORCH_WORKDIR`, `ORCH_AGENT_PROC`, `ORCH_RESUME_CMD`, `ORCH_FRESH_CMD`, `ORCH_KICKOFF`, `ORCH_BACKOFF_MIN`, `JARVIS_DIR` |
| `watch/pane-nudge.sh` | A scripted keystroke answering a permission dialog nobody saw. **A nudge is never approval.** | sourced by `orch-watch.sh`, or `NUDGE_TARGET=<tmux target> NUDGE_MSG=<text> watch/pane-nudge.sh` | `JARVIS_DIR` (the `DIALOG_WAITING` flag); dialog markers are one CLI's and must be checked for yours |

## Notes

- `lane-disarm.sh` uses `/usr/bin/grep` on purpose. If your shell aliases `grep` to a tool that
  honours `.gitignore`, it cannot see `.env` files and will report a clean tree over an armed one.
- `slot/gate-run.sh` and `run-gate.sh` solve different problems and compose: the slot decides WHEN a
  run may start on a shared machine; `run-gate.sh` decides whether its exit 0 means anything.
  `gate-run.sh <LANE> <what> <logdir> -- scripts/run-gate.sh "<name>" -- <GATE_CMD>` gives you both.
- A crash exit (134, 137, 139, 143) with no test summary is not a result. Re-run once, alone, with
  fewer workers, and say that you re-ran.
