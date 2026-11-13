#!/usr/bin/env bash
# jarvis-kit: generic adaptation of a secrets sweep from a production multi-agent setup; real values replaced with placeholders.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# secrets-sweep.sh: look for credential shapes in the repository before anything is pushed.
#
# WHY A SCRIPT AND NOT A ONE-LINER. Ad-hoc versions of this check tend to fail by returning a
# PLAUSIBLE ZERO:
#   · a long `grep -E` alternation aborts ("exceeds complexity limits") while the wrapper prints
#     "no lines above = clean" underneath it;
#   · `n=$(grep -c ... || echo 0)` yields "0\n0" when nothing matches, so every numeric test errors
#     and the loop still announces CLEAN;
#   · a pattern that starts with a dash is read as an option, so the question is never asked.
# So: every pattern is passed with `-e`, counts come from captured output, and the verdict is
# COMPUTED from the findings, never printed beside them. A pass message that prints
# unconditionally is a caption, not a check.
#
# THE DETECTOR IS SELF-TESTED. `--self-test` runs the real matcher over a deliberately dirty input
# and a clean one, and drives the whole script against scratch repositories. A clean verdict you
# have never seen fail is not a verdict.
#
# USAGE
#   scripts/secrets-sweep.sh                    sweep every TRACKED file (default)
#   scripts/secrets-sweep.sh --range <base>     sweep only lines ADDED in <base>...HEAD (pre-push)
#   scripts/secrets-sweep.sh --self-test        prove the detector fires and stays quiet correctly
#
# ALLOW-LIST: $SECRETS_ALLOWLIST (default: .secrets-allowlist at the repo root). One entry per line,
# three TAB-separated fields:   <path glob>  <literal>  <reason>
#   - the literal is tolerated ONLY in files matching the glob, so the same bytes in product
#     source still fire (scope by FILE, never by loosening a pattern);
#   - an entry with no reason is refused (exit 2): a waiver nobody explained is not a waiver;
#   - lines starting with # are comments.
#
# EXIT: 0 clean · 1 findings · 2 the check could not be performed (NOT a pass)
#
# CHAIN IT WITH `&&`, NEVER `;`:   scripts/secrets-sweep.sh --range origin/main && git push
# With `;` the push runs whatever the sweep said. A real hit and a false positive print the same
# output; only `&&` makes the outcome differ.
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# The ONE place the patterns live. The sweep and the self-test both call this, so a self-test
# green is evidence about the matcher that actually runs. Families:
#   private keys · cloud keys · provider tokens · JWTs · connection strings with a password ·
#   secret-looking assignments.
detect() {
  grep -a -n -E \
    -e 'BEGIN[ A-Z]*PRIVATE KEY' \
    -e 'AKIA[0-9A-Z]{16}' \
    -e '[Aa][Ww][Ss].{0,20}[Ss][Ee][Cc][Rr][Ee][Tt].{0,3}[:=]' \
    -e 'AIza[0-9A-Za-z_-]{30}' \
    -e '"private_key_id"[[:space:]]*:' \
    -e 'sk_live_[0-9A-Za-z]{16}' \
    -e 'xox[baprs]-[0-9A-Za-z-]{10}' \
    -e '(ghp|gho|ghs|ghu)_[0-9A-Za-z]{30}' \
    -e 'github_pat_[0-9A-Za-z_]{30}' \
    -e 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}' \
    -e '[a-zA-Z][a-zA-Z0-9+.-]*://[^:/@[:space:]]+:[^@/[:space:]$<{]+@' \
    -e '[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd][[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'$<{]{8,}' \
    -e '[Pp][Rr][Ii][Vv][Aa][Tt][Ee]_[Kk][Ee][Yy][[:space:]]*[:=]' \
    || true
}

# A tracked env file is a finding on its own, whatever it contains. Templates are allowed.
is_tracked_env() {
  local b; b=$(basename "$1")
  case "$b" in
    .env.example|.env.sample|.env.template|*.env.example) return 1 ;;
    .env|.env.*|*.env) return 0 ;;
  esac
  return 1
}

# Load the allow-list into three parallel arrays. Refuse an entry without a reason.
AL_GLOB=(); AL_LIT=()
load_allowlist() {
  [ -f "$ALLOWLIST" ] || return 0
  local glob lit reason n=0
  while IFS=$'\t' read -r glob lit reason || [ -n "$glob" ]; do
    n=$((n + 1))
    case "$glob" in ''|'#'*) continue ;; esac
    if [ -z "${lit:-}" ] || [ -z "${reason:-}" ]; then
      echo "SWEEP ABORTED (exit 2): $ALLOWLIST line $n needs <glob> TAB <literal> TAB <reason>."
      exit 2
    fi
    AL_GLOB+=("$glob"); AL_LIT+=("$lit")
  done < "$ALLOWLIST"
}

# Drop hits whose line carries a literal the allow-list tolerates IN THIS PATH.
filter_allowed() {   # $1 = path; stdin = hits
  local path="$1" hits i
  hits=$(cat)
  for i in "${!AL_GLOB[@]}"; do
    # shellcheck disable=SC2254
    case "$path" in ${AL_GLOB[$i]}) hits=$(printf '%s\n' "$hits" | grep -v -F -e "${AL_LIT[$i]}" || true) ;; esac
  done
  printf '%s' "$hits"
}

# ── self-test ────────────────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--self-test" ]; then
  fails=0
  ok() { echo "SELF-TEST: $1 [ok]"; }
  bad() { echo "SELF-TEST FAILED: $1"; fails=1; }
  # Canaries are assembled from halves so THIS file carries no matchable literal: the sweep scans
  # its own source like any other file, and a detector that trips on itself is a permanent red.
  canary_key="$(printf '%s%s' "AKIA" "IOSFODNN7EXAMPLE")"
  canary_url="$(printf '%s%s' "postgres://app:" "hunter2hunter2@db.example.com/app")"
  [ -n "$(printf 'k = "%s"\n' "$canary_key" | detect)" ] && ok "fires on a cloud key" || bad "silent on a cloud key"
  [ -n "$(printf 'url = %s\n' "$canary_url" | detect)" ] && ok "fires on a connection string with a password" || bad "silent on a connection string"
  [ -z "$(printf 'url = postgres://localhost:5432/app\n' | detect)" ] && ok "silent on a connection string with no password" || bad "fired on a passwordless URL"
  [ -z "$(printf 'const greeting = "hello world";\n' | detect)" ] && ok "silent on a clean line" || bad "fired on a clean line"
  is_tracked_env "apps/x/.env.local" && ok ".env.local is a tracked-env finding" || bad ".env.local not recognised"
  is_tracked_env ".env.example" && bad ".env.example treated as a secret file" || ok ".env.example is allowed"

  # End to end, through the REAL entry point, in a scratch repo: an allow-listed literal is
  # tolerated in a test path and still fires in product source; a tracked .env fires.
  SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  st="$(mktemp -d "${TMPDIR:-/tmp}/secrets-sweep-selftest.XXXXXX")"
  fixture="$(printf '%s%s' "not-a-real-" "password-Z9")"
  (
    cd "$st" || exit 9
    git init -q . && git config user.email selftest@example.com && git config user.name selftest || exit 9
    mkdir -p src test
    printf "pw = { password: '%s' }\n" "$fixture" > test/auth.spec.ts
    printf 'test/*\t%s\tshared synthetic fixture, test paths only\n' "$fixture" > .secrets-allowlist
    printf 'ok = 1\n' > src/app.ts
    git add -A && git commit -qm base || exit 9
    SECRETS_ALLOWLIST="$st/.secrets-allowlist" bash "$SELF" > clean.out 2>&1; echo $? > clean.code
    printf "pw = { password: '%s' }\n" "$fixture" >> src/app.ts
    git add -A && git commit -qm dirty || exit 9
    SECRETS_ALLOWLIST="$st/.secrets-allowlist" bash "$SELF" > src.out 2>&1; echo $? > src.code
    git checkout -q HEAD~1 -- src/app.ts && printf 'X=1\n' > .env && git add -f .env && git commit -qm env || exit 9
    SECRETS_ALLOWLIST="$st/.secrets-allowlist" bash "$SELF" > env.out 2>&1; echo $? > env.code
  )
  [ "$(cat "$st/clean.code" 2>/dev/null)" = 0 ] && ok "allow-listed literal in a test path reads CLEAN" || bad "allow-list arm (exit $(cat "$st/clean.code" 2>/dev/null))"
  [ "$(cat "$st/src.code" 2>/dev/null)" = 1 ] && grep -q 'src/app.ts' "$st/src.out" && ok "the same literal in product source still fires" || bad "path scoping arm"
  [ "$(cat "$st/env.code" 2>/dev/null)" = 1 ] && grep -q 'TRACKED ENV FILE' "$st/env.out" && ok "a tracked .env fires" || bad "tracked .env arm"
  rm -rf "$st"
  [ "$fails" -eq 0 ] && exit 0 || exit 2
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "SWEEP ABORTED (exit 2): not inside a git repository."; exit 2; }
cd "$ROOT" || exit 2
ALLOWLIST="${SECRETS_ALLOWLIST:-$ROOT/.secrets-allowlist}"

load_allowlist
findings=""; scanned=0; expected=0

if [ "${1:-}" = "--range" ]; then
  BASE="${2:-}"
  git rev-parse --verify "$BASE" >/dev/null 2>&1 || { echo "SWEEP ABORTED (exit 2): base '$BASE' does not resolve. This is NOT a clean result."; exit 2; }
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$ROOT/$f" ] || continue
    is_tracked_env "$f" && findings+="$f: TRACKED ENV FILE"$'\n'
    # --text: a NUL byte early in a file makes git call it binary and hide its lines. Read anyway.
    # --output-indicator-new marks added CONTENT lines only, so a content line that itself starts
    # with '+++' is not mistaken for a file header.
    added=$(git diff "$BASE"...HEAD --text --output-indicator-new='}' -- "$f" | grep -a '^}' | sed 's/^}//' || true)
    [ -n "$added" ] || continue
    scanned=$(( scanned + $(printf '%s\n' "$added" | wc -l) ))
    na=$(git diff "$BASE"...HEAD --text --numstat -- "$f" | awk 'NR==1{print $1}')
    case "$na" in ''|*[!0-9]*) na=0 ;; esac
    expected=$(( expected + na ))
    hits=$(printf '%s\n' "$added" | detect | filter_allowed "$f")
    [ -n "$hits" ] && findings+="$(printf '%s\n' "$hits" | sed "s|^|$f:+|")"$'\n'
  done < <(git diff "$BASE"...HEAD --name-only)
  # Integrity: if we read fewer added lines than git counts, a CLEAN would be about part of the range.
  if [ "$scanned" -lt "$expected" ] && [ -z "$findings" ]; then
    echo "VERDICT: CANNOT VERIFY (exit 2): read $scanned added lines, git counts $expected. NOT a clean result."
    exit 2
  fi
else
  while IFS= read -r -d '' f; do
    [ -f "$ROOT/$f" ] || continue
    scanned=$((scanned + 1))
    is_tracked_env "$f" && findings+="$f: TRACKED ENV FILE"$'\n'
    hits=$(detect < "$ROOT/$f" | filter_allowed "$f")
    [ -n "$hits" ] && findings+="$(printf '%s\n' "$hits" | sed "s|^|$f:|")"$'\n'
  done < <(git -C "$ROOT" ls-files -z)
  if [ "$scanned" -eq 0 ]; then
    echo "VERDICT: CANNOT VERIFY (exit 2): zero tracked files were read. NOT a clean result."
    exit 2
  fi
fi

count=$(printf '%s' "$findings" | grep -c . || true)
if [ "${count:-0}" -gt 0 ]; then
  echo "VERDICT: DIRTY ($count finding(s); $scanned scanned)"
  # Show where, never more than 25 lines. Values are on these lines: do not paste them anywhere.
  printf '%s' "$findings" | cut -c1-200 | head -25
  echo
  echo "Clear each hit deliberately:"
  echo "  · a real credential    -> remove it, ROTATE it, and say so in the commit;"
  echo "  · a test fixture       -> make it obviously fake, then allow-list it for test paths only;"
  echo "  · prose about the check -> reword the prose, never the pattern."
  exit 1
fi
echo "VERDICT: CLEAN ($scanned scanned, ${#AL_GLOB[@]} allow-list entr(y/ies) in force)"
exit 0
