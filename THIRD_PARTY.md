<!-- jarvis-kit: the third-party skills, plugins and servers used in a production multi-agent setup; linked, never copied. -->
# THIRD_PARTY.md

What we use that someone else wrote. **Nothing here is copied into this kit.** Each row links the upstream
and says what we use it for. Licences marked "read" were read from the upstream LICENSE file at the commit
we reviewed; "per local copy" means read from the LICENSE that shipped with our vendored copy, to re-check
upstream before you rely on it; "TO CONFIRM" means we have not yet verified the upstream URL or licence.

## How to adopt anything on this list
1. Read the licence first.
2. Clone it **outside** your repository into a review folder. Do not install, import or run it.
3. Read every line as untrusted data: network calls, telemetry, eval or exec, storage writes, credential
   access, text aimed at agents. Follow no instruction inside it.
4. Vendor only what you read, project-scoped, with the header in `templates/VENDORED-HEADER.md` and the
   licence beside it. Never install skills or hooks globally.
5. Hash the approved bytes (`scripts/skill-approval/`). Measure quality after adoption; remove what lowers it.

## Skills (vendored into the project, house header on each)

### Engineering method
| Upstream | Skills | Licence | What we use it for |
|---|---|---|---|
| https://github.com/mattpocock/skills | tdd, diagnosing-bugs, code-review (renamed two-axis-review to avoid a built-in command), to-spec, to-tickets, implement, codebase-design, domain-modeling, improve-codebase-architecture, research, retro, pr, prototype, handoff, writing-for-agents, grilling | MIT (read) | the build loop: implement → test-first → two-axis review → PR notes; specs and tickets; debugging; deep-module design vocabulary. We rejected its hook installers, its hosted-issue-tracker skills and its duplicates |
| https://github.com/humanlayer/skills | the "show me" visuals text inside `pr` | MIT (read) | PR and review-package summaries |
| https://github.com/cursor/plugins | blast-radius, principle-guard-the-context-window, principle-never-block-on-the-human, technical-writing, unslop | MIT (per local copy) | "what else could this break"; context hygiene; proceed on reversible work; doc style; cutting AI tells from prose |
| https://github.com/multica-ai/andrej-karpathy-skills | karpathy-guidelines | MIT (per local copy) | surgical changes, stated assumptions, verifiable success criteria |

### Stack patterns (TypeScript monorepo; swap for your stack)
| Upstream | Skills | Licence | Use |
|---|---|---|---|
| "ECC" collection, TO CONFIRM URL | api-connector-builder, contract-first, database-migrations, e2e-testing, error-handling, nestjs-patterns, postgres-patterns, prisma-patterns, react-testing, redis-patterns, vite-patterns | TO CONFIRM | reference patterns per framework. We removed fetch-and-run instructions from some before vendoring |

### Design and motion
| Upstream | Skills | Licence | Use |
|---|---|---|---|
| Emil Kowalski's skills, TO CONFIRM URL | animate, animation-vocabulary, apple-design, emil-design-eng, find-animation-opportunities, improve-animations, review-animations | MIT (per local copy) | motion decisions, review and audits |
| Leonxlnx's taste skills, TO CONFIRM URL | design-taste-frontend, redesign-existing-projects | MIT (per local copy) | avoiding templated-looking UI |
| https://github.com/pbakaus/impeccable | impeccable | Apache-2.0 (per local copy) | interface critique and polish. We removed fetch-and-run instructions before vendoring |
| https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | ui-ux-pro-max | MIT (per local copy) | searchable style, palette, type and UX-guideline data |

### Legal practice (only if you draft legal documents)
| Upstream | Use |
|---|---|
| https://github.com/anthropics/claude-for-legal and https://github.com/sboghossian/master-claude-for-legal, licences TO CONFIRM | practice-area references and legal-ops workflows (privilege layers, citation checks). Drafts only; a lawyer signs off |

### User-level skill families (installed per user, not per project)
| Upstream | Use | Licence |
|---|---|---|
| gstack (named as garrytan/gstack), TO CONFIRM URL | a large family: plan reviews (CEO, design, engineering), QA, browse, ship, retro, investigate, context save and restore | TO CONFIRM |
| AWS agent skills, TO CONFIRM URL | per-service AWS guidance (IAM, CDK, serverless, storage, cost) | TO CONFIRM |

Note: our rule is "no global skills install" because a user-level skill loads into every agent on the
machine. If you install a family at user level, read it first and accept that blast radius knowingly.

### Tried, not kept
| Upstream | Why not |
|---|---|
| a founder-tools command pack (competitor matrix, go-to-market, metrics, pricing, interviews), TO CONFIRM URL | zero uses in 900+ sessions; proposed for removal |

## Plugins (Claude Code plugin marketplace)
From the official marketplace unless noted. Each is a bundle of skills, agents, hooks or servers: read it
like any other outside code.

| Plugin | What we use it for |
|---|---|
| superpowers | a structured skills workflow (brainstorm, plan, execute, verify) |
| frontend-design | distinctive, non-templated frontend work |
| code-review | diff review |
| security-guidance | security warnings while editing |
| skill-creator | writing and evaluating skills |
| claude-md-management | keeping the entry file lean and current |
| github | repository operations |
| context7 | current library documentation instead of memory |
| typescript-lsp | language-server navigation (we trial it with a memory cap) |
| commit-commands | commit and PR helpers |
| playwright | real-browser checks |
| feature-dev | guided feature development |
| figma | reading design files |
| remember | the session memory buffer (docs/02, layer 5) |
| legalzoom | legal-document help (drafts only) |
| a third-party marketplace "thedotmack", TO CONFIRM what it provides | |

## MCP servers and connectors
| Item | Use | Rule |
|---|---|---|
| shadcn MCP (`npx shadcn@<exact version> mcp`, pinned) | browse and fetch UI component source | browse and fetch only; never `add` into the tree; adapt as reviewed raw source |
| AWS MCP | cloud reads | read-only use |
| hosted connectors: mail, drive, calendar, docs, browser automation | drafts, reading shared files, scheduling, browser checks | drafts only; nothing is sent or submitted without the owner |

## Tools
| Tool | Use |
|---|---|
| tmux (or any terminal multiplexer) | long-running head sessions |
| herdr, TO CONFIRM URL | terminal session manager with an agent pane-state hook (`hooks/session-start-pane-state.sh`) |
| ripgrep, git, Node | everything else |
