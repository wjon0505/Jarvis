#!/usr/bin/env bash
# jarvis-kit: generic adaptation of a tmux pane nudge gate from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# pane-nudge.sh: type a line into a long-running agent session ONLY when its input box is empty.
#
# ⚠️ A NUDGE KEYSTROKE MUST NEVER COUNT AS APPROVAL OF A DIALOG.
# An agent CLI running without a permission-bypass flag regularly sits in a permission or choice
# dialog. An Enter (or a digit in a typed line) answers that dialog at its highlighted option, as
# the machine's user, for a sender who never saw the question. So:
#   · the pane is READ first, and keys are sent only when the bottom of the screen positively shows
#     the idle input box and shows NO dialog;
#   · the pane is read AGAIN before the Enter, because the Enter is the key that answers a dialog;
#   · anything else is logged and skipped. The mailbox is the protocol; the nudge is a courtesy, so a
#     skipped nudge loses nothing;
#   · every typed line starts with `[automated]`, so a transcript reader can tell script from person;
#   · when a dialog is seen, a DIALOG_WAITING flag file is raised so the orchestrator knows a person
#     is needed. Deleting anything, approving anything, spending anything needs the owner's own words.
#
# The marker strings below are what one agent CLI (Claude Code) draws. Check them against your tool's
# screen and keep the bias: when in doubt, it is a dialog. A wrong "dialog" costs a skipped nudge; a
# wrong "no dialog" answers a question for nobody.
#
# Use it two ways: source it (`. pane-nudge.sh`, then call pane_gate / pane_nudge), or run it with
# NUDGE_TARGET=<tmux target> NUDGE_MSG=<text>.
# ENV: JARVIS_DIR (default ./.jarvis; the DIALOG_WAITING flag lives there)
# ─────────────────────────────────────────────────────────────────────────────────────────────

# Only the bottom of the screen counts: scrollback keeps old dialog text. 16 lines fits a full
# choice dialog with its footer.
pane_bottom () { printf '%s\n' "$1" | sed '/^[[:space:]]*$/d' | tail -n 16; }

# 0 when the bottom of the screen shows a permission or choice dialog.
pane_shows_dialog () {
  local bottom; bottom="$(pane_bottom "$1")"
  case "$bottom" in
    *"Enter to confirm"*|*"Enter to select"*|*"to navigate"*|*"Esc to cancel"*|*"Tab to amend"*|*"Do you want"*|\
    *"Yes, I accept"*|*"Bypass Permissions mode"*|*"(y/n)"*|*"don't ask again"*|*"Yes, and"*|\
    *"No, and tell"*|*"trust the files"*|*"trust this folder"*)
      return 0 ;;
  esac
  # A cursor on ANY numbered choice, or on a bare Yes or No.
  printf '%s\n' "$bottom" | grep -Eq '^[[:space:]]*(❯|>)[[:space:]]*([0-9]+\.|Yes\b|No\b)' && return 0
  return 1
}

# 0 only when the last lines show the idle input box and no dialog.
pane_ready () {
  pane_shows_dialog "$1" && return 1
  case "$(pane_bottom "$1")" in
    *"shift+tab to cycle"*|*"? for shortcuts"*) return 0 ;;
  esac
  return 1
}

# pane_gate <tmux target>: every send-keys asks this first. 0 when the pane is readable and shows no
# dialog; otherwise sends nothing, says why, and raises DIALOG_WAITING (removed when the dialog goes).
pane_gate () {
  local target="$1" pane flag="${JARVIS_DIR:-./.jarvis}/DIALOG_WAITING"
  pane="$(tmux capture-pane -p -t "$target" 2>/dev/null)" || { echo "nothing sent: cannot read pane ${target}"; return 3; }
  if pane_shows_dialog "$pane"; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') dialog waiting in pane ${target}; nothing was sent to it" > "$flag" 2>/dev/null
    echo "nothing sent: ${target} shows a dialog"
    return 3
  fi
  rm -f "$flag" 2>/dev/null
  return 0
}

# pane_nudge <tmux target> <message>: 0 when sent, 3 when skipped.
pane_nudge () {
  local target="$1" msg="$2" pane
  pane_gate "$target" || return 3
  pane="$(tmux capture-pane -p -t "$target" 2>/dev/null)" || { echo "nudge skipped: cannot read pane ${target}"; return 3; }
  if ! pane_ready "$pane"; then
    echo "nudge skipped: ${target} does not show an empty input prompt; the mailbox carries the task"
    return 3
  fi
  tmux send-keys -t "$target" -l "[automated] ${msg}"
  pane_gate "$target" || return 3
  tmux send-keys -t "$target" C-m
  echo "nudged ${target}"
}

if [ -n "${NUDGE_TARGET:-}" ]; then
  pane_nudge "$NUDGE_TARGET" "${NUDGE_MSG:?NUDGE_MSG must be set}"
fi
