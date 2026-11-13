#!/usr/bin/env bash
# jarvis-kit: generic adaptation of the orchestrator's doorbell from a production multi-agent setup; real values replaced with placeholders.
#
# One background watcher for the orchestrator. It EXITS (so the orchestrator wakes) when:
#   1. any department BELL file appears under $HQ/<dept>/BELL;
#   2. a reviewer BELL appears on a build machine (optional, over ssh);
#   3. a head is waiting on a dialog in its terminal pane (optional, tmux);
#   4. a head has stalled: its STATE file is older than $STALL_SECS while the machine is idle and
#      the pane shows no busy marker (model thinking barely loads the CPU, so load alone is not proof).
# The orchestrator reads what it printed, acts, and starts it again. Each BELL is appended to
# $HQ/BELL-ARCHIVE.log and removed. Run it in the background; never poll lanes instead.
#
# Config (env):
#   HQ               department folders (default ./hq)
#   REMOTE           ssh host of a build machine, empty for none
#   REMOTE_STATE     STATE file to age-check on REMOTE
#   REMOTE_PANE      tmux session of the remote head (default orch)
#   REMOTE_BELLS     space-separated reviewer BELL paths on REMOTE
#   STALL_SECS       default 3600; LOAD_IDLE default 0.5; SLEEP_SECS default 120
#   PAUSED_FLAG      if this file exists in $HQ, stall detection is off (default PAUSED)
set -u
HQ=${HQ:-./hq}; REMOTE=${REMOTE:-}; REMOTE_STATE=${REMOTE_STATE:-}; REMOTE_PANE=${REMOTE_PANE:-orch}
REMOTE_BELLS=${REMOTE_BELLS:-}; STALL_SECS=${STALL_SECS:-3600}; LOAD_IDLE=${LOAD_IDLE:-0.5}
SLEEP_SECS=${SLEEP_SECS:-120}; PAUSED_FLAG=${PAUSED_FLAG:-PAUSED}
ARCHIVE="$HQ/BELL-ARCHIVE.log"

while true; do
  if [ -n "$(find "$HQ" -maxdepth 2 -name BELL -print -quit 2>/dev/null)" ]; then
    find "$HQ" -maxdepth 2 -name BELL | while read -r f; do
      echo "== $f"; head -30 "$f" | cut -c1-900
      { echo "== $(date '+%F %T') $f"; cat "$f"; } >> "$ARCHIVE"; rm -f "$f"
    done
    exit 0
  fi

  if [ -n "$REMOTE" ]; then
    # One ssh call returns: state-age load dialog-waiting reviewer-bell-present.
    # The [g] in the pgrep pattern stops it matching its own command line.
    S=$(timeout 20 ssh -o ConnectTimeout=8 "$REMOTE" "
      m=\$(stat -c %Y '$REMOTE_STATE' 2>/dev/null || echo 0)
      pgrep -f '[g]ate-run[.]sh' >/dev/null && m=\$(date +%s)
      p=\$(tmux capture-pane -p -t '$REMOTE_PANE' 2>/dev/null | tail -12)
      d=0; echo \"\$p\" | grep -q 'Enter to select' && d=1
      echo \"\$p\" | grep -q 'esc to' && m=\$(date +%s)
      u=0; for q in $REMOTE_BELLS; do [ -e \"\$q\" ] && u=1; done
      echo \$(( \$(date +%s) - m )) \$(cut -d' ' -f1 /proc/loadavg) \$d \$u" 2>/dev/null)
    read -r age load dlg ui <<< "$S"
    if [ "${ui:-0}" = 1 ]; then
      B=$(timeout 20 ssh -o ConnectTimeout=8 "$REMOTE" "for q in $REMOTE_BELLS; do [ -e \"\$q\" ] || continue; echo \"== remote:\$q\"; cat \"\$q\"; mv \"\$q\" \"\$q.read-\$(date +%s)\"; done" 2>/dev/null)
      echo "== REMOTE REVIEWER BELL"; echo "$B" | head -30 | cut -c1-900
      { echo "== $(date '+%F %T') remote reviewer BELL"; echo "$B"; } >> "$ARCHIVE"; exit 0
    fi
    if [ "${dlg:-0}" = 1 ]; then
      echo "== DIALOG: the remote head is waiting on a question in its pane ($REMOTE_PANE). Answer through its BELL protocol; a keystroke is not approval."; exit 0
    fi
    if [ ! -e "$HQ/$PAUSED_FLAG" ] && [ -n "${age:-}" ] && [ "$age" -gt "$STALL_SECS" ] && awk "BEGIN{exit !(${load:-9} < $LOAD_IDLE)}"; then
      echo "== STALL: remote STATE ${age}s old, load $load, pane not busy"; exit 0
    fi
  fi
  sleep "$SLEEP_SECS"
done
