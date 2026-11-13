#!/usr/bin/env bash
# jarvis-kit: generic adaptation of the coordinator-machine load guard from a production multi-agent setup; real values replaced with placeholders.
#
# The machine that runs the orchestrator must outlive its lanes. Every $INTERVAL seconds this reads free
# memory, swap, load and disk. Past a line it stops ONE department-head tmux session (in $STOP_ORDER
# order), writes $HQ/load-guard/BELL so the orchestrator stops its own lanes, and backs off. It never
# touches the orchestrator's session. Works on Linux and macOS.
#
# Config (env): HQ (default ./hq), STOP_ORDER (space-separated tmux sessions, least important first),
#   MIN_FREE_PCT 20, MAX_SWAP_MB 9000, MAX_LOAD15 16, MIN_DISK_GB 8, INTERVAL 30
set -u
HQ=${HQ:-./hq}; STOP_ORDER=${STOP_ORDER:-}; MIN_FREE_PCT=${MIN_FREE_PCT:-20}; MAX_SWAP_MB=${MAX_SWAP_MB:-9000}
MAX_LOAD15=${MAX_LOAD15:-16}; MIN_DISK_GB=${MIN_DISK_GB:-8}; INTERVAL=${INTERVAL:-30}
mkdir -p "$HQ/load-guard"; LOG="$HQ/load-guard/guard.log"

read_metrics() {
  if [ "$(uname)" = Darwin ]; then
    FREE=$(memory_pressure -Q 2>/dev/null | awk -F': ' '/free percentage/{gsub("%","",$2);print $2}')
    SWAP=$(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/' | cut -d. -f1)
    LOAD=$(sysctl -n vm.loadavg | awk '{print int($4)}')
    DISK=$(df -g / | tail -1 | awk '{print $4}')
  else
    FREE=$(awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print int(a*100/t)}' /proc/meminfo)
    SWAP=$(awk '/SwapTotal/{t=$2}/SwapFree/{f=$2}END{print int((t-f)/1024)}' /proc/meminfo)
    LOAD=$(awk '{print int($3)}' /proc/loadavg)
    DISK=$(df -BG / | tail -1 | awk '{gsub("G","",$4);print $4}')
  fi
}

while true; do
  read_metrics
  echo "$(date '+%F %T') free=${FREE}% swap=${SWAP}M load15=$LOAD disk=${DISK}G" >> "$LOG"
  REASON=""
  [ "${FREE:-100}" -lt "$MIN_FREE_PCT" ] && REASON="memory free ${FREE}%"
  [ "${SWAP:-0}" -gt "$MAX_SWAP_MB" ] && REASON="swap ${SWAP}M"
  [ "${LOAD:-0}" -gt "$MAX_LOAD15" ] && REASON="load15 $LOAD"
  [ "${DISK:-99}" -lt "$MIN_DISK_GB" ] && REASON="disk ${DISK}G"
  if [ -n "$REASON" ]; then
    STOPPED=""
    for S in $STOP_ORDER; do
      if tmux has-session -t "$S" 2>/dev/null; then
        tmux send-keys -t "$S" C-c; sleep 2; tmux kill-session -t "$S"; STOPPED=$S; break
      fi
    done
    echo "LOAD GUARD: $REASON. Stopped: ${STOPPED:-none left}. Orchestrator: stop your own lanes now; resume the head after it clears." > "$HQ/load-guard/BELL"
    echo "$(date '+%F %T') ACTED $REASON stopped=${STOPPED:-none}" >> "$LOG"
    sleep 120
  else
    sleep "$INTERVAL"
  fi
done
