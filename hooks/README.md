<!-- jarvis-kit: generic description of the hooks used in a production multi-agent setup; real values replaced with placeholders. -->
# Hooks

A hook is a command your agent tool runs on an event (session start, before a tool call, before
compaction). Hooks run with your permissions on every session, so they are outside code at its most
powerful: read every line, keep them project-scoped, and never install a hook from a package you have not
read (docs/05).

## What we run

| Event | What it does | Whose code |
|---|---|---|
| Session start (on startup, resume, clear, compact, fork) | tells the terminal session manager which agent session lives in which pane, so a crashed pane can be resumed into the same conversation; 10 s timeout, exits 0 on any failure | the terminal manager's own integration script (see THIRD_PARTY.md, herdr); it is regenerated on update, so we do not copy it |
| Before compaction | prints a short REMEMBER block (the live buffer and core memories) into the new context | the remember plugin, with our folder layout (docs/02, layer 5) |

## Patterns worth copying
- **Exit 0 on every failure** unless the hook is a deliberate gate. A broken hook must not block a session.
- **Give every hook a timeout.**
- **Ignore subagent events** in a session-level hook (check the event payload for an agent id), or every
  worker fires it.
- **Add custom hooks beside a managed one** instead of editing it; managed files are overwritten on update.
- **Read the event payload from stdin into a temp file** and delete it on exit.

Wiring for Claude Code: `adapters/claude-code/hooks/settings-hooks.example.json`. Other tools: look for
"hooks", "lifecycle events" or "session start commands" in the tool's documentation.
