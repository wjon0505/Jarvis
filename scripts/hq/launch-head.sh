#!/usr/bin/env bash
# jarvis-kit: generic adaptation of the department-head launcher from a production multi-agent setup; real values replaced with placeholders.
#
# launch-head.sh <dept> [max-web-searches]
# Starts one department head in its own tmux session with its own context and no connectors. The head
# reads $HQ/<dept>/CHARTER.md (and STATE if present) and works from that folder. The repository is
# readable but not writable, and git writes, pushes, cloud CLIs, ssh and installs are denied: a head
# prepares, the orchestrator merges.
#
# This uses Claude Code flags; see adapters/claude-code/README.md. For another tool, keep the shape:
# separate session, working dir = the head's folder, repo read-only, no publishing commands.
#
# Config (env): HQ (default ./hq), REPO (the product repository, default .), MODEL (default opus)
set -eu
D=${1:?usage: launch-head.sh <dept> [max-web-searches]}; S=${2:-300}
HQ=$(cd "${HQ:-./hq}" && pwd); REPO=$(cd "${REPO:-.}" && pwd); MODEL=${MODEL:-opus}
cd "$HQ/$D"
if tmux has-session -t "head-$D" 2>/dev/null; then echo "already running: head-$D"; exit 0; fi
tmux new-session -d -s "head-$D" -x 180 -y 50 -c "$HQ/$D" \
  env CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION="$S" claude --model "$MODEL" --name "head-$D" \
  --permission-mode dontAsk --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --add-dir "$HQ" "$REPO" \
  --allowedTools Read Write Edit Glob Grep Bash WebSearch WebFetch Agent TaskStop TaskOutput ToolSearch Monitor TodoWrite \
  --disallowedTools "Bash(git commit:*)" "Bash(git push:*)" "Bash(git merge:*)" "Bash(git rebase:*)" "Bash(git checkout:*)" \
    "Bash(gcloud:*)" "Bash(aws:*)" "Bash(ssh:*)" "Bash(scp:*)" "Bash(npm:*)" "Bash(gh:*)" "Bash(rm -rf:*)" \
    "Write(/$REPO/**)" "Edit(/$REPO/**)" \
  -- "Read CHARTER.md in this folder, then STATE if it exists, and do what they say. Continue now."
sleep 6; tmux capture-pane -t "head-$D" -p | grep -v '^$' | tail -8 | cut -c1-120
