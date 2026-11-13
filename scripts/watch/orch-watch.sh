#!/usr/bin/env bash
# jarvis-kit: generic adaptation of a tmux orchestrator watchdog from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# orch-watch.sh: keep a long-running agent session (the orchestrator, <ORCH>, or a department head)
# alive inside a tmux session, so the terminal is never the only way back.
#
# Run it every 2 minutes from cron or a systemd timer. Each tick:
#   · creates the tmux session if it is gone;
#   · if the agent process is running in the pane: records "alive"; if a resume nudge is pending,
#     delivers it through pane_nudge (empty input box only);
#   · if the agent is NOT running: restarts it (resume the last conversation, or a fresh session
#     with the kickoff prompt when $WATCH_DIR/<session>.fresh exists), at most once per backoff
#     window, and never while the pane shows a dialog.
# It never kills anything and never touches the repository. Every action goes to the log.
#
# ⚠️ A keystroke from this script is NEVER approval of a dialog. The pane is read before any key and
# again before the Enter (see pane-nudge.sh). Approval, deletion and spending need the owner's words.
#
# ENV (all optional):
#   ORCH_SESSION=orch                 tmux session name
#   ORCH_WORKDIR=$PWD                 where the agent runs (<REPO_ROOT>)
#   ORCH_AGENT_PROC=claude            process name that proves the agent is alive in the pane
#   ORCH_RESUME_CMD='claude --continue || claude'   restart command (resume, else fresh)
#   ORCH_FRESH_CMD='claude "$(cat <kickoff file>)"' fresh-start command
#   ORCH_KICKOFF=$JARVIS_DIR/KICKOFF.md
#   ORCH_RESUME_MSG='Resumed by the watchdog. Read the protocol and continue with your inbox.'
#   ORCH_BACKOFF_MIN=10               minimum minutes between restarts
#   JARVIS_DIR=./.jarvis              where the log, state and flags live (use an absolute path from cron)
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -u
JARVIS_DIR="${JARVIS_DIR:-./.jarvis}"; export JARVIS_DIR
S="${ORCH_SESSION:-orch}"
WORKDIR="${ORCH_WORKDIR:-$PWD}"
PROC="${ORCH_AGENT_PROC:-claude}"
KICKOFF="${ORCH_KICKOFF:-$JARVIS_DIR/KICKOFF.md}"
RESUME_CMD="${ORCH_RESUME_CMD:-claude --continue || claude}"
FRESH_CMD="${ORCH_FRESH_CMD:-claude \"\$(cat '$KICKOFF')\"}"
RESUME_MSG="${ORCH_RESUME_MSG:-Resumed by the watchdog after a crash. Read the protocol and standing orders, then continue with the lowest-numbered task in your inbox; report to the outbox as usual.}"
BACKOFF="${ORCH_BACKOFF_MIN:-10}"
mkdir -p "$JARVIS_DIR"
LOG="$JARVIS_DIR/$S-watch.log"; STATE="$JARVIS_DIR/$S-watch.state"
STAMP="$JARVIS_DIR/$S-watch.restart-stamp"; NUDGE="$JARVIS_DIR/$S-watch.nudge-pending"; FRESH="$JARVIS_DIR/$S.fresh"
ts() { date "+%Y-%m-%d %H:%M:%S"; }
. "$(dirname "$0")/pane-nudge.sh"

if ! tmux has-session -t "$S" 2>/dev/null; then
  # Started from a oneshot systemd service, a plain tmux server dies with the service's cgroup when
  # this script exits. Give it its own scope when systemd-run exists.
  if command -v systemd-run >/dev/null 2>&1; then
    systemd-run --user --scope --quiet tmux new-session -d -s "$S" -c "$WORKDIR" 2>/dev/null \
      || systemd-run --scope --quiet tmux new-session -d -s "$S" -c "$WORKDIR"
  else
    tmux new-session -d -s "$S" -c "$WORKDIR"
  fi
  sleep 1
  echo "$(ts) created tmux session $S ($(tmux has-session -t "$S" 2>/dev/null && echo alive || echo MISSING))" >> "$LOG"
fi
pane_pid=$(tmux list-panes -t "$S" -F "#{pane_pid}" 2>/dev/null | head -1)
[ -n "$pane_pid" ] || { echo "$(ts) no pane in $S" >> "$LOG"; exit 0; }

# The agent may run in a subshell, so look at the whole process tree under the pane, not direct children.
agent_alive() {
  if command -v pstree >/dev/null 2>&1; then pstree -p "$pane_pid" | grep -q "$PROC("; return; fi
  ps -eo pid=,ppid=,comm= | awk -v root="$pane_pid" -v name="$PROC" '
    { parent[$1]=$2; comm[$1]=$3 } END { for (p in comm) if (comm[p]==name) { q=p; while (q in parent && q!=root && q>1) q=parent[q]; if (q==root) { found=1 } } exit (found ? 0 : 1) }'
}

if agent_alive; then
  echo "alive $(ts) pane=$pane_pid" > "$STATE"
  if [ -f "$NUDGE" ]; then
    if pane_nudge "$S" "$RESUME_MSG" >> "$LOG" 2>&1; then rm -f "$NUDGE"; echo "$(ts) nudged the resumed session" >> "$LOG"
    else echo "$(ts) resume nudge deferred: no empty input prompt yet" >> "$LOG"; fi
  fi
  exit 0
fi

if [ -f "$STAMP" ] && [ -n "$(find "$STAMP" -mmin "-$BACKOFF" 2>/dev/null)" ]; then
  echo "$(ts) agent down in pane $pane_pid; within ${BACKOFF}m backoff, waiting" >> "$LOG"
  echo "down $(ts) backoff" > "$STATE"; exit 0
fi
# A dialog is never answered. A process check can read a live session as down, so read the pane first.
if ! said="$(pane_gate "$S")"; then echo "$(ts) $said" >> "$LOG"; echo "dialog $(ts)" > "$STATE"; exit 0; fi
touch "$STAMP"
if [ -f "$FRESH" ]; then
  tmux send-keys -t "$S" -l "cd '$WORKDIR' && $FRESH_CMD"; rm -f "$FRESH"
  echo "$(ts) RESTARTED fresh with the kickoff prompt in pane $pane_pid" >> "$LOG"
else
  tmux send-keys -t "$S" -l "cd '$WORKDIR' && ($RESUME_CMD)"
  echo "$(ts) RESTARTED (resume) in pane $pane_pid" >> "$LOG"
fi
if ! said="$(pane_gate "$S")"; then echo "$(ts) $said; Enter withheld" >> "$LOG"; exit 0; fi
tmux send-keys -t "$S" C-m
touch "$NUDGE"
echo "restarted $(ts)" > "$STATE"
