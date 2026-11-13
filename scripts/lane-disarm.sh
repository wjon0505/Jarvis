#!/usr/bin/env bash
# jarvis-kit: generic adaptation of a lane env-disarm script from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# lane-disarm.sh: make a lane's COPIED env unable to reach live systems, then PROVE it by
# re-reading the files.
#
# A lane worktree needs the gitignored runtime env to boot anything. That env holds live
# credentials: a single-use rotating OAuth refresh token (spent from a copy, it dies for everyone),
# a metered API key, a mail or SMS sender (a message that leaves cannot be recalled). So after the
# copy, and BEFORE booting anything, every key in the config is blanked, switched off, forced to a
# mock, or pointed at a local host.
#
# Lessons kept from the full version:
#   · The subject is GITIGNORED-NESS (`git check-ignore`), not the name `.env*`: a tracked
#     `.env.example` documents how to turn things ON and must not be rewritten.
#   · Verify with a grep that cannot be fooled by ignore files. Some shells wrap `grep` in a tool
#     that honours .gitignore and so never sees `.env`; use an absolute path ($GREP below).
#   · The verdict is re-read from the files, never taken from the edit's exit code.
#   · Never print a value. A refusal names file, line and key, and the value's LENGTH only.
#   · Blanking a key is not always a disarm. Some SDKs fall back to a credential chain (a profile
#     file in $HOME, instance metadata). Close the chain with `set:` keys in the config, and APPEND
#     them when absent: an absent key leaves the fallback just as open as a blank one.
#   · Zero files examined is a refusal, not a pass.
#
# CONFIG: $DISARM_KEYS (default: lane-disarm.keys beside this script; see lane-disarm.keys.example)
#   KEY=blank          value becomes ''
#   KEY=false          value becomes 'false'
#   KEY=mock           value becomes 'mock'
#   KEY=set:<value>    value becomes '<value>'; APPENDED to the boot env file if absent
#
# USAGE:  lane-disarm.sh [worktree-root]          disarm, then verify (default root: cwd)
#         lane-disarm.sh --verify-only [root]
# EXIT:   0 disarmed and verified · 1 still armed · 2 cannot run (NOT a pass)
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -uo pipefail
GREP="${DISARM_GREP:-/usr/bin/grep}"; [ -x "$GREP" ] || GREP=/bin/grep
HERE=$(cd "$(dirname "$0")" && pwd)
KEYS_FILE="${DISARM_KEYS:-$HERE/lane-disarm.keys}"
BOOT_ENV="${DISARM_BOOT_ENV:-.env}"   # the file every boot path loads first, relative to root

MODE=disarm; [ "${1:-}" = "--verify-only" ] && { MODE=verify; shift; }
ROOT="${1:-$PWD}"
[ -d "$ROOT" ] || { echo "ABORTED (exit 2): no such directory: $ROOT"; exit 2; }
[ -f "$KEYS_FILE" ] || { echo "ABORTED (exit 2): no keys config at $KEYS_FILE"; exit 2; }

# KEY<US>WANTED-VALUE<US>APPEND(0|1), one per line (US = ASCII unit separator: a TAB would collapse
# an empty value under `read`). An unknown action is refused.
US=$'\x1f'
SPEC=$(awk -F= -v us="$US" '/^[[:space:]]*(#|$)/{next} {k=$1; a=substr($0,length($1)+2)
  if (a=="blank") v=""; else if (a=="false"||a=="mock") v=a; else if (a ~ /^set:/) {v=substr(a,5); ap=1}
  else {print "BAD\t" k; next}
  printf "%s%s%s%s%d\n", k, us, v, us, ap+0; ap=0}' "$KEYS_FILE")
if printf '%s\n' "$SPEC" | "$GREP" -q '^BAD'; then
  echo "ABORTED (exit 2): unknown action for: $(printf '%s\n' "$SPEC" | "$GREP" '^BAD' | cut -f2 | tr '\n' ' ')"; exit 2
fi
[ -n "$SPEC" ] || { echo "ABORTED (exit 2): the keys config is empty"; exit 2; }

# Gitignored env files under ROOT (depth 3, node_modules skipped), NUL-separated.
env_files() {
  ( cd "$ROOT" && find . -maxdepth 3 -name '.env*' -not -path '*/node_modules/*' -type f -print0 \
      | xargs -0 git check-ignore 2>/dev/null ) | while IFS= read -r f; do printf '%s\0' "$ROOT/${f#./}"; done
}

# Rewrite one file. Accepts the dotenv forms a loader reads: `export KEY=`, `  KEY =`, `KEY: v`.
disarm_file() {
  local f="$1" tmp; tmp=$(mktemp) || return 1
  awk -v spec="$SPEC" -v us="$US" -v q="'" 'BEGIN{n=split(spec,L,"\n"); for(i=1;i<=n;i++){split(L[i],c,us); if(c[1]!="") want[c[1]]=c[2]}}
    { line=$0; s=line; sub(/^[ \t]*(export[ \t]+)?/,"",s); k=s; sub(/[ \t]*(=|:[ \t]).*$/,"",k)
      if ((k in want) && s != k) { pre=substr(line,1,index(line,k)-1); print pre k "=" q want[k] q; next } print }' \
    "$f" > "$tmp" && cat "$tmp" > "$f"; rm -f "$tmp"
}

append_missing() {   # set: keys absent from the boot env file are appended to it
  local f="$ROOT/$BOOT_ENV" k v ap
  [ -f "$f" ] || return 0
  while IFS="$US" read -r k v ap; do
    [ "$ap" = 1 ] || continue
    "$GREP" -qE "^[[:space:]]*(export[[:space:]]+)?$k[[:space:]]*[=:]" "$f" && continue
    [ -s "$f" ] && [ -n "$(tail -c1 "$f")" ] && printf '\n' >> "$f"
    printf "%s='%s'\n" "$k" "$v" >> "$f"
  done <<<"$SPEC"
}

# The verdict, re-read from the files with $GREP. Prints `file:line:KEY <redacted, N chars>`.
verify() {
  local bad=0 seen=0 f k v ap hit
  while IFS= read -r -d '' f; do
    seen=$((seen + 1))
    while IFS="$US" read -r k v ap; do
      while IFS= read -r hit; do
        [ -n "$hit" ] || continue
        val=$(printf '%s' "$hit" | sed -E "s/^[0-9]+:[[:space:]]*(export[[:space:]]+)?$k[[:space:]]*(=|:)[[:space:]]*//; s/[[:space:]]+#.*$//; s/^['\"\`](.*)['\"\`]$/\1/")
        if [ "$val" != "$v" ]; then bad=1; echo "  STILL ARMED: ${f#"$ROOT"/}:${hit%%:*}:$k <redacted, ${#val} chars>"; fi
      done < <("$GREP" -nE "^[[:space:]]*(export[[:space:]]+)?$k[[:space:]]*(=|:[[:space:]])" "$f")
    done <<<"$SPEC"
  done < <(env_files)
  if [ -f "$ROOT/$BOOT_ENV" ]; then
    while IFS="$US" read -r k v ap; do
      [ "$ap" = 1 ] || continue
      "$GREP" -qE "^[[:space:]]*(export[[:space:]]+)?$k[[:space:]]*[=:]" "$ROOT/$BOOT_ENV" \
        || { bad=1; echo "  MISSING in $BOOT_ENV: $k (an absent key leaves the fallback open)"; }
    done <<<"$SPEC"
  fi
  [ "$seen" -gt 0 ] || { echo "  REFUSED: zero gitignored env files under $ROOT. Copy the runtime env first, or this is not a git worktree."; return 2; }
  echo "  env files examined: $seen"
  return $bad
}

if [ "$MODE" = disarm ]; then
  while IFS= read -r -d '' f; do disarm_file "$f"; done < <(env_files)
  append_missing
fi
verify; rc=$?
case $rc in
  0) echo "  VERDICT: DISARMED (re-read from the files, not from the edit's exit code)"; exit 0 ;;
  2) exit 2 ;;
  *) echo "  VERDICT: STILL ARMED. Do not boot anything against this tree."; exit 1 ;;
esac
