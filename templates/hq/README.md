<!-- jarvis-kit: template department workspace layout; generic adaptation from a production multi-agent setup. -->
# HQ layout

```text
<HQ>/
  main/               the orchestrator's own notes and its append-only main log
  MORNING.md          the owner's handoff: what finished overnight, what waits on them
  BELL-ARCHIVE.log    every BELL the orchestrator read, appended with the time it read it
  <dept>/             one per department head (copy dept/ from here)
    STATUS.md  BELL  ASKS.md  INBOX.md  STATE  NOTES.md  outbox/
```

Rules: the orchestrator reads STATUS and BELL only; a head writes BELL at most 5 lines when a stage ends or
it is blocked; times come from `date`, never typed; heads never send mail, spend, sign, push, deploy or
contact anyone. The main log gets a line on every orchestrator action: time, what, and the owner's words
verbatim when they prompted it.
