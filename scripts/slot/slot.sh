#!/usr/bin/env bash
# jarvis-kit: generic adaptation of the machine-wide test-slot lock from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# slot.sh: ONE whole-workspace test run (jest / vitest / Playwright / <GATE_CMD>) on this machine
# at a time. Acquire with an atomic `mkdir`; release ONLY by the holder.
#
#   slot.sh acquire <lane> [what]     blocks until held; heartbeat line at least every 70 s
#   slot.sh release <lane>            refuses if <lane> is not the holder
#   slot.sh status
#   slot.sh force-release <who>       ORCHESTRATOR ONLY, after the holder's death is confirmed
#
# There is NO automatic reclaim, by design. The pid recorded at acquire is NOT a liveness signal:
# the acquiring shell exits milliseconds after it takes the lock. A quiet process table is one
# instant, and reclaiming on a guess kills a live run. If a lane dies holding the slot, the
# orchestrator confirms it (the lane's own report or its agent's death) and force-releases.
# Waiters block until then.
#
# While $JARVIS_DIR/LOW_MEMORY exists, acquire waits. Any agent or monitor may create that file.
#
# ENV: JARVIS_DIR (default ./.jarvis) · SLOT_LOCK (default $JARVIS_DIR/SLOT.lock)
#      SLOT_LOG (default $JARVIS_DIR/slot.log) · LOW_MEMORY_FLAG (default $JARVIS_DIR/LOW_MEMORY)
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -u
JARVIS_DIR="${JARVIS_DIR:-./.jarvis}"
LOCK="${SLOT_LOCK:-$JARVIS_DIR/SLOT.lock}"
LOG="${SLOT_LOG:-$JARVIS_DIR/slot.log}"
LOW="${LOW_MEMORY_FLAG:-$JARVIS_DIR/LOW_MEMORY}"
mkdir -p "$(dirname "$LOCK")" "$(dirname "$LOG")"

now() { date '+%Y-%m-%d %H:%M:%S'; }
note() { echo "[slot $(now)] $*"; echo "[slot $(now)] $*" >> "$LOG"; }
holder() { sed -n "${1}p" "$LOCK/holder" 2>/dev/null; }
# Jitter: fixed sleep phases starve the last waiter to join.
nap() { local j=$((50 + RANDOM % 21)); sleep "$j"; waited=$((waited + j)); }

case "${1:-}" in
acquire)
  LANE="${2:?usage: slot.sh acquire <lane> [what]}"; WHAT="${3:-unnamed}"; waited=0
  while true; do
    if [ -e "$LOW" ]; then note "$LANE WAITING: $LOW exists (waited ${waited}s)"; nap; continue; fi
    if mkdir "$LOCK" 2>/dev/null; then
      printf '%s\n%s\n%s\n%s\n' "$LANE" "acquire-shell=$$ (NOT a liveness signal)" "$WHAT" "$(now)" > "$LOCK/holder"
      note "$LANE ACQUIRED for: $WHAT (waited ${waited}s)"
      exit 0
    fi
    note "$LANE WAITING: held by $(holder 1) since $(holder 4) for '$(holder 3)' (waited ${waited}s)"
    nap
  done ;;
release)
  LANE="${2:?usage: slot.sh release <lane>}"
  [ -d "$LOCK" ] || { note "$LANE RELEASE: no lock held (nothing to do)"; exit 0; }
  if [ "$(holder 1)" != "$LANE" ]; then note "$LANE REFUSED to release: held by $(holder 1), not by you"; exit 1; fi
  rm -rf "$LOCK"; note "$LANE RELEASED" ;;
status)
  if [ -d "$LOCK" ]; then echo "HELD:"; cat "$LOCK/holder"; else echo "FREE"; fi ;;
force-release)
  note "FORCE-RELEASE by ${2:-?}: was $(holder 1) for '$(holder 3)'"; rm -rf "$LOCK" ;;
*) echo "usage: slot.sh acquire <lane> [what] | release <lane> | status | force-release <who>"; exit 2 ;;
esac
