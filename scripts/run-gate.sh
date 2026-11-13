#!/usr/bin/env bash
# jarvis-kit: generic adaptation of a gate wrapper from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# run-gate.sh: run ONE gate command and tell the truth about how it exited.
#
# The false greens this closes:
#   · Piping a gate through `tail`/`head`/`grep` for a readable summary replaces the gate's exit
#     code with the LAST pipe stage's code, and `tail` always exits 0.
#   · A background-task notifier reports the WRAPPER's exit, not the command's.
#   · A launcher that resolves to nothing (`node ""`) runs zero tests and exits 0.
#   · A gate run over a dirty tree is evidence about your editor, not about the commit.
#
# So this script:
#   1. refuses a dirty tree (unstaged or untracked changes) unless RUN_GATE_ALLOW_DIRTY=1, in which
#      case the verdict line says DIRTY TREE so nobody quotes it as a commit's result;
#   2. runs the command DIRECTLY (its streams go to FIFOs that `tee` copies to your terminal and the
#      log), so no pipe stage sits between the command and `$?`, and reads `$?` on the next line;
#   3. writes a log and refuses a 0-byte log as a pass;
#   4. when RUN_GATE_SUMMARY_RE is set (default: jest/vitest's `^Tests:` line), requires an exit-0
#      run to show that summary with a non-zero total and at least one passed test, and prints the
#      counts. Set RUN_GATE_SUMMARY_RE= (empty) for a gate with no test summary.
#
# USAGE   scripts/run-gate.sh "<gate name>" -- <GATE_CMD> [args...]
#         scripts/run-gate.sh --self-test
# ENV     RUN_GATE_LOG_DIR (default ./.jarvis/gate-logs)   RUN_GATE_ALLOW_DIRTY=1
#         RUN_GATE_SUMMARY_RE (default '^Tests:')
# EXIT    the command's own code when non-zero · 0 pass · 3 exit 0 but no evidence a test ran or an
#         empty log · 65 dirty tree · 64 usage · 70 could not set up (the gate was NOT run)
#
# Always capture `$?` yourself on an UNPIPED call:   scripts/run-gate.sh unit -- <GATE_CMD>; echo "rc=$?"
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -u
SUMMARY_RE="${RUN_GATE_SUMMARY_RE-^Tests:}"
LOG_DIR="${RUN_GATE_LOG_DIR:-./.jarvis/gate-logs}"

strip_ansi() { LC_ALL=C sed -e $'s/\033\\[[0-9;]*[A-Za-z]//g'; }

# Prints nothing when the evidence is good, otherwise the reason it is not.
evidence_problem() {   # $1 = log file
  [ -s "$1" ] || { echo "the log is EMPTY (0 bytes): nothing shows the gate ran"; return; }
  [ -n "$SUMMARY_RE" ] || return 0
  local line total passed
  line=$(strip_ansi < "$1" | grep -a -E "$SUMMARY_RE" | tail -1)
  [ -n "$line" ] || { echo "the output has no summary line matching /$SUMMARY_RE/"; return; }
  total=$(printf '%s' "$line" | grep -oE '[0-9]+ total' | grep -oE '^[0-9]+' | tail -1)
  passed=$(printf '%s' "$line" | grep -oE '[0-9]+ passed' | grep -oE '^[0-9]+' | tail -1)
  [ -n "$total" ] && [ "$total" -gt 0 ] || { echo "the summary counts zero tests: $line"; return; }
  [ -n "$passed" ] && [ "$passed" -gt 0 ] || { echo "the summary counts no passed test: $line"; return; }
}

run_gate() {   # $1 = name, $2.. = command
  local name="$1" slug scratch log code why t0 t1 summary
  shift
  slug=$(printf '%s' "$name" | tr -c 'A-Za-z0-9_-' '-')
  mkdir -p "$LOG_DIR" || return 70
  log="$LOG_DIR/$(date '+%Y%m%d-%H%M%S').$slug.log"
  scratch=$(mktemp -d "${TMPDIR:-/tmp}/run-gate.XXXXXX") || return 70
  mkfifo "$scratch/out" "$scratch/err" || { rm -rf "$scratch"; return 70; }
  tee -a "$log" < "$scratch/out" & local t_out=$!
  tee -a "$log" < "$scratch/err" >&2 & local t_err=$!
  echo "── run-gate: $name → $* (log: $log)"
  t0=$(date +%s)
  "$@" > "$scratch/out" 2> "$scratch/err"
  code=$?
  wait "$t_out" "$t_err"; t1=$(date +%s); rm -rf "$scratch"
  if [ "$code" -ne 0 ]; then
    echo "── FAIL · $name · REAL exit=$code · $((t1 - t0))s · $(wc -c < "$log" | tr -d ' ') bytes logged${DIRTY_NOTE:-} ──" >&2
    return "$code"
  fi
  why=$(evidence_problem "$log")
  if [ -n "$why" ]; then
    echo "── REFUSED · $name · exit=3 · the command exited 0 but $why${DIRTY_NOTE:-} ──" >&2
    return 3
  fi
  summary=""; [ -n "$SUMMARY_RE" ] && summary=" · $(strip_ansi < "$log" | grep -a -E "$SUMMARY_RE" | tail -1)"
  echo "── PASS · $name · exit=0 · $((t1 - t0))s · $(wc -l < "$log" | tr -d ' ') log lines${summary}${DIRTY_NOTE:-} ──"
  return 0
}

if [ "${1:-}" = "--self-test" ]; then
  fails=0; LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/run-gate-st.XXXXXX")
  st_green() { echo "Tests:       12 passed, 12 total" >&2; }
  st_silent() { return 0; }
  st_zero() { echo "Tests:       0 total"; }
  st_skipped() { echo "Tests:       4 skipped, 4 total"; }
  st_fail() { echo "Tests:       1 failed, 3 passed, 4 total"; return 1; }
  st_crash() { echo "Tests:       4 passed, 4 total"; return 139; }
  st_colour() { printf '\033[1mTests:\033[22m \033[32m4 passed\033[39m, 4 total\n'; }
  expect() {   # $1 label, $2 wanted exit, $3.. command
    local label="$1" want="$2" got; shift 2
    ( run_gate selftest "$@" ) >/dev/null 2>&1 < /dev/null; got=$?
    if [ "$got" -eq "$want" ]; then echo "SELF-TEST: $label -> $got [ok]"; else echo "SELF-TEST FAILED: $label wanted $want got $got"; fails=1; fi
  }
  expect "a run with a passed test is a PASS" 0 st_green
  expect "exit 0 with an empty log is REFUSED" 3 st_silent
  expect "a zero-total summary is REFUSED" 3 st_zero
  expect "all-skipped is REFUSED" 3 st_skipped
  expect "a failure keeps its own exit code" 1 st_fail
  expect "a crash beside a green summary keeps 139" 139 st_crash
  expect "a coloured summary is read" 0 st_colour
  RUN_GATE_SUMMARY_RE='' SUMMARY_RE='' expect "no-summary mode still refuses an empty log" 3 st_silent
  rm -rf "$LOG_DIR"
  [ "$fails" -eq 0 ] && exit 0 || exit 2
fi

[ "${2:-}" = "--" ] && [ $# -ge 3 ] || { echo "usage: run-gate.sh \"<gate name>\" -- <command...> | --self-test" >&2; exit 64; }
name="$1"; shift 2

# Clean-tree check: everything git lists must be staged (index matches what you mean to test).
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  dirty=$(git status --porcelain | grep -E '^(.[MD?]|\?\?)' || true)
  if [ -n "$dirty" ]; then
    if [ "${RUN_GATE_ALLOW_DIRTY:-0}" = 1 ]; then
      DIRTY_NOTE=" · DIRTY TREE ($(printf '%s\n' "$dirty" | wc -l | tr -d ' ') paths): not a result for any commit"
    else
      echo "── REFUSED · $name · exit=65 · the tree has unstaged or untracked changes:" >&2
      printf '%s\n' "$dirty" | head -10 >&2
      echo "   Commit or stage them (git add -A), or set RUN_GATE_ALLOW_DIRTY=1 and say so in the report." >&2
      exit 65
    fi
  fi
fi

run_gate "$name" "$@"
exit $?
