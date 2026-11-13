<!-- jarvis-kit: generic adaptation of the skill-approval controls from a production multi-agent setup; real values replaced with placeholders. -->
# Skill approval: the owner approves bytes, not names

## The idea

A skill (or any instruction file an agent loads: agent briefs, rules, prompt templates) is code for
agents. Its description loads into every session and its body is followed when invoked, often by
sessions that run with permission prompts turned off. If an agent can write into the skills folder,
then the only thing between third-party text and lasting instruction authority is one model's
judgement.

So approval is bound to CONTENT:

- `approved-skills.json` holds, per skill directory, a SHA-256 over its files:
  `sha256( sorted lines "<relpath>\0<sha256(file bytes)>" joined by "\n" )`.
  A renamed, added, removed or edited file changes the hash.
- `check-skill-approval.mjs` recomputes every hash and fails on: a directory with no entry, a hash
  mismatch, an entry with no directory, an `approved` string that names no decision id, a loose file
  at the top of the skills folder, or zero skills found.
- **A byte change re-opens approval.** The agent that changed the skill shows the owner the diff; the
  owner's decision (for example `DEC-017`) is recorded in the decision log; only then is the entry
  updated, with that id in `approved`.
- The agent that improves the environment proposes skill changes; it never writes them directly.
  Put that sentence in its brief.

## Use

```bash
node scripts/skill-approval/check-skill-approval.mjs --skills-dir <skills dir> --manifest approved-skills.json
node scripts/skill-approval/check-skill-approval.mjs --hash <skills dir>/<name>   # entry for a new skill
node scripts/skill-approval/check-skill-approval.mjs --self-test
```

`--decision-re` sets the pattern a decision id must match (default `\bDEC-\d+\b`). Run it in CI and
in your guard suite. Exit: 0 approved, 1 offenders, 2 cannot run.

Where skills live depends on the tool: `.claude/skills/` in Claude Code; other tools keep agent
instructions in `AGENTS.md`, `.cursor/rules/`, `GEMINI.md` or conventions files. The check works on
any directory of directories.

## Two companion checks (described; build them for your own layout)

### 1. Agent text may not fetch-and-run unpinned tools

Scan every instruction file agents read (skills, agent briefs, rules). Read only command-shaped
text: fenced code blocks, inline code spans, frontmatter, CSV cells. Strip HTML comments first (a
review header that mentions an old command is not a command), and throw on an unterminated comment
rather than eating the file. Then refuse:

- `npx` / `bunx` / `pnpm dlx` / `yarn dlx` naming a package that is neither a binary installed from
  your lockfile nor `<package>@<exact version>` equal to the lockfile's version. `@latest`, a range,
  or an unlocked package means the registry's current release runs with no integrity check.
- A download piped to a shell (`curl … | sh`, `wget … | bash`).
- `pip install <pkg>` without `==<exact version>`.
- A permission grant in skill frontmatter that is a blanket shell grant, a fetch-and-run grant that
  fails the rule above, or a `node|python|bash <path>` grant or instruction naming a path that does
  not exist (a stripped directory that some later file could fill).

Pin a non-zero scan count (the corpus really was read) and keep demonstrations that each shape is
refused, beside control cases that are accepted (a local binary, an exact pin, prose about `npx`).

### 2. Every executable script under agent dirs is inventoried

Enumerate everything under your agent-config directory from `git ls-files`, never from memory:

- every skill records where it came from (an origin/review header, an `origin:` field, a line
  naming a repo AND a licence, or a LICENSE file in the directory);
- every agent definition on disk is in a reviewed register, compared by NAME in both directions
  (never by count: two errors of opposite sign sum to health);
- every MCP or plugin server the project config launches is classified, launched on an exact
  version, and that version equals the lockfile's;
- no file under the agent dirs is marked executable, and there is no hooks directory unless it is
  itself inventoried (a hook runs with no human in the loop);
- every file that starts with a shebang sits inside a skill whose header says the script was read.

A new member that is not classified fails the check. That is the point: the set is derived from the
tree, so tomorrow's drop-in is caught the day it appears.
