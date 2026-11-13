<!-- jarvis-kit: generic adaptation of Claude Code adapter notes from a production multi-agent setup; real values replaced with placeholders. -->

# Claude Code adapter

The rest of the kit is plain Markdown and works with any agent tool. This folder holds the Claude Code-specific pieces: agent wrappers with frontmatter, and a permissions example. If you use another tool, read the equivalents table at the end.

## Files

| Path | What it is | Where it goes in your repo |
|---|---|---|
| `agents/<role>.md` | one wrapper per role in `agents/`: YAML frontmatter (name, description, tools, model, memory) and a body that points at the tool-neutral role file | `.claude/agents/<role>.md` |
| `settings.example.json` | a permissions allow/deny example | merge into `.claude/settings.json` |
| `README.md` | this file | not copied |

### Agent wrappers

- **Line 1 is `---`.** Frontmatter must start on the first line of the file, so the kit's origin header sits on line 2 as a YAML comment.
- **`description`** decides when the orchestrator picks the agent. Keep it to what the role does, when to use it, and what it is NOT for.
- **`tools`** is a comma-separated allow list for that agent. Omit it to inherit every tool. The wrappers narrow it where the role allows (the `verifier` gets no Edit tool, because it never changes source).
- **`model`** is `inherit` in every wrapper, with a comment saying which tier the role wants. Replace it with your tool's model alias. The routing that worked: the strongest model for orchestration, review, verification and security; the next tier down for build lanes; the stronger model again for design-heavy UI work and long-form legal drafting.
- **`memory: project`** gives the agent a persistent memory directory (`.claude/agent-memory/<role>/`). Keep `MEMORY.md` as facts and pointers; rules belong in the role file. If an agent runs without a worktree, its memory writes land in your main checkout; say in the brief whether that is allowed.
- **Worktree isolation** is chosen at dispatch time (the Agent tool's `isolation: "worktree"`), not in the frontmatter. Every build lane needs it. Alternatively, create the worktree yourself and name the path in the brief.
- The body says "read `agents/<role>.md` and follow it". Copy the role files into your repo (for example `.claude/agent-roles/`) and fix that path, or paste the role text into the wrapper body if you prefer one file per agent.

### settings.example.json

- **The deny list is the useful part.** It refuses, to every session including the orchestrator: force pushes, hard resets, `git clean`, history rewrites, `git stash` (a stash between parallel agents can sweep another agent's work off disk), forced worktree removal, `rm -rf` of roots and `.git`, `sudo`, package publishing, and reads of `.env` and `secrets/`.
- **Extend the deny list with your own irreversible commands:** your cloud's deploy, secret-write, DNS and IAM commands. Then the "prepares, never deploys" boundary in the role files is enforced by the tool, not only by the prompt.
- **The allow list is deliberately narrow.** Add your own build, test and container commands. Think before allowing `curl`, `gh` or a cloud CLI wholesale: they reach the network.
- Rule syntax: `Bash(prefix:*)` matches a command prefix; `*` is a wildcard. Deny wins over allow. Check the current Claude Code permissions docs before relying on a pattern, and test a deny rule once by trying the command it should refuse.
- `defaultMode: "acceptEdits"` lets agents edit files without a prompt while shell commands still go through the allow/deny lists.
- JSON has no comments, so this file carries no origin header; this README is its documentation.

### User-level settings (not shipped)

Model choice, reasoning effort and UI preferences live in your user-level settings. Keep account values there, never in the repo.

## Equivalents in other tools

Each of these tools has its own way to express roles, rules and permissions. The names below are the general mechanism; **check your tool's docs for the exact file names and keys**, since they change between versions.

| Kit piece | Claude Code | Codex CLI | Gemini CLI | Cursor | Aider |
|---|---|---|---|---|---|
| Root instructions | `CLAUDE.md` | `AGENTS.md` | `GEMINI.md` (context file) | project rules files | a conventions file passed to the session |
| Roles in `agents/` | `.claude/agents/*.md` subagents | paste a role into the prompt of a separate session per lane, or reference it from `AGENTS.md` | same approach; check the docs for subagent support | a rule file per role, invoked by name | one session per role, the role file loaded read-only |
| Path-scoped rules in `rules/` | `.claude/rules/*.md` with path frontmatter | nested `AGENTS.md` files in subdirectories | nested context files | rules with file globs | load the rule file for the files you edit |
| Skills in `skills/` | `.claude/skills/<name>/SKILL.md` | check your tool's docs | check your tool's docs | check your tool's docs | load the Markdown as a read-only file |
| Permissions | `.claude/settings.json` allow/deny | its sandbox and approval settings | its sandbox and tool-approval settings | its command allow/deny settings | its confirmation settings; run inside a container for hard limits |

Where a tool has no permission deny list, enforce the boundary outside it: run lanes in a container or under a user account that has no deploy credentials, no push rights to the protected branch, and no access to the secret store.
