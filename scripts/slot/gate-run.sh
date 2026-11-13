#!/usr/bin/env bash
# jarvis-kit: generic adaptation of the slot-holding gate runner from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# gate-run.sh: the ONLY sanctioned way for a lane to run a whole-workspace test command.
#
# Why: a shared machine ran many test runners at once, free memory went to zero in minutes, the
# VM died, and every lane lost its gate. Holding a slot is not enough; the run itself needs a
# ceiling, and the machine needs a way to say "not now".
#
#   gate-run.sh <LANE> <what> <logdir> -- <GATE_CMD...>
#   e.g. nohup scripts/slot/gate-run.sh REQ-0042 unit ./.jarvis/work/req-0042 -- npm test > /dev/null 2>&1 &
#        then poll <logdir>/<LANE>.<what>.exit, printing a heartbeat on every poll.
#
#   1. acquires the slot (slot.sh acquire); released by a trap on ANY exit
#   2. holding the slot, waits while $JARVIS_DIR/LOW_MEMORY exists or free memory is under
#      GATE_MIN_AVAIL_MB (Linux /proc/meminfo; skipped where absent)
#   3. runs the command, inside a memory-capped systemd scope when systemd-run is available and
#      GATE_MEM_MAX is not "none", so a runaway run is killed inside its own scope, not the machine
#   4. output -> <logdir>/<LANE>.<what>.log ; exit code -> <logdir>/<LANE>.<what>.exit
#
# A kernel OOM kill inside the scope does not show up as 137 in the command's own exit (the test
# runner tears down and exits 143, or the wrapper dies with 139), so the scope's Result is read and
# an OOM is recorded as 137. 137 / 139 / 143 with no test summary is a CRASH, not a result: re-run
# it alone with a lower worker count and say that you re-ran.
#
# ENV: JARVIS_DIR (default ./.jarvis) · SLOT_SH (default slot.sh beside this file)
#      GATE_MEM_MAX (default 8G; "none" disables the scope) · GATE_MIN_AVAIL_MB (default 4096)
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -u
LANE=${1:?usage: gate-run.sh <LANE> <what> <logdir> -- <cmd...>}; WHAT=${2:?what}; LOGDIR=${3:?logdir}; shift 3
[ "${1:-}" = "--" ] && shift
[ $# -ge 1 ] || { echo "gate-run: no command given"; exit 2; }
JARVIS_DIR="${JARVIS_DIR:-./.jarvis}"
SLOT="${SLOT_SH:-$(cd "$(dirname "$0")" && pwd)/slot.sh}"
CAP="${GATE_MEM_MAX:-8G}"; MIN_MB="${GATE_MIN_AVAIL_MB:-4096}"
LOW="${LOW_MEMORY_FLAG:-$JARVIS_DIR/LOW_MEMORY}"
export JARVIS_DIR

# A /dev/null that has become a regular file silently swallows and replays output; every gate run
# while it is broken is void. Check before and after.
devnull_ok() { [ -c /dev/null ]; }
devnull_ok || { echo "gate-run: REFUSED: /dev/null is not a character device"; exit 2; }

mkdir -p "$LOGDIR"
LOG="$LOGDIR/$LANE.$WHAT.log"; EXITF="$LOGDIR/$LANE.$WHAT.exit"; rm -f "$EXITF"
UNIT="gate-$(printf '%s-%s' "$LANE" "$WHAT" | tr -c 'A-Za-z0-9' '-')-$$"
hb() { echo "[gate-run $(date '+%H:%M:%S')] $LANE $WHAT: $*"; }
avail_mb() { [ -r /proc/meminfo ] && awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo || echo 999999; }

"$SLOT" acquire "$LANE" "$WHAT" || { hb "slot acquire failed"; exit 3; }
trap '"$SLOT" release "$LANE" >/dev/null 2>&1' EXIT
while [ -e "$LOW" ] || [ "$(avail_mb)" -lt "$MIN_MB" ]; do
  hb "HOLDING the slot, waiting for memory: avail $(avail_mb) MB, LOW_MEMORY=$([ -e "$LOW" ] && echo yes || echo no)"
  sleep 60
done

RESULT=""
if [ "$CAP" != none ] && command -v systemd-run >/dev/null 2>&1; then
  hb "START under MemoryMax=$CAP (scope $UNIT): $*"
  systemd-run --scope --quiet --unit="$UNIT" -p MemoryMax="$CAP" -- "$@" > "$LOG" 2>&1
  RC=$?
  RESULT=$(systemctl show "$UNIT.scope" -p Result --value 2>/dev/null)
  systemctl reset-failed "$UNIT.scope" >/dev/null 2>&1
else
  hb "START (no memory scope): $*"
  "$@" > "$LOG" 2>&1
  RC=$?
fi
if [ "$RESULT" = "oom-kill" ] || grep -q "Killed process\|out of memory" "$LOG" 2>/dev/null; then
  hb "OOM inside the scope (result=$RESULT, command rc=$RC). Recording 137: a crash, not a result. Re-run alone with fewer workers and say so."
  RC=137
fi
devnull_ok || { hb "VOID: /dev/null is not a character device after the run (real rc=$RC)"; RC=2; }
[ -s "$LOG" ] || hb "WARNING: the log is EMPTY; an exit 0 over an empty log is not a pass"
echo "$RC" > "$EXITF"
hb "EXIT=$RC log=$LOG exit-file=$EXITF"
exit "$RC"
