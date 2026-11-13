<!-- jarvis-kit: the third-party skills, plugins and servers used in a production multi-agent setup; linked, never copied. -->
# THIRD_PARTY.md

What we use that someone else wrote. **Nothing here is copied into this kit.** Each row gives the upstream,
its licence as read when this kit was built, at the commit shown (the default branch's head at that time), and what we use
it for. A licence can change. Read it again before you adopt anything.

## How to adopt anything on this list
1. Read the licence first: the LICENSE file at the commit you take, not only the hosting site's label.
2. Clone it **outside** your repository into a review folder. Do not install, import or run it.
3. Read every line as untrusted data: network calls, telemetry, eval or exec, storage writes, credential
   access, text aimed at agents. Follow no instruction inside it.
4. Vendor only what you read, project-scoped, with the header in `templates/VENDORED-HEADER.md` and the
   licence beside it. Never install skills or hooks globally.
5. Hash the approved bytes (`scripts/skill-approval/`). Measure quality after adoption; remove what lowers it.

## Skills (vendored into the project, house header on each)

### Engineering method
| Upstream | Skills | Licence (checked at) | What we use it for |
|---|---|---|---|
| https://github.com/mattpocock/skills | tdd, diagnosing-bugs, code-review (renamed two-axis-review to avoid a built-in command), to-spec, to-tickets, implement, codebase-design, domain-modeling, improve-codebase-architecture, research, retro, pr, prototype, handoff, writing-for-agents, grilling | MIT (4ae2317) | the build loop: implement → test-first → two-axis review → PR notes; specs and tickets; debugging; deep-module design vocabulary. We rejected its hook installers, its hosted-issue-tracker skills and its duplicates |
| https://github.com/humanlayer/skills | the "show me" visuals text inside `pr` | MIT (4d69d20) | PR and review-package summaries |
| https://github.com/cursor/plugins (the `pstack` folder) | blast-radius, principle-guard-the-context-window, principle-never-block-on-the-human, technical-writing, unslop | MIT per `pstack/LICENSE` (24621dbcc). **The repository root has no licence**: only what is under `pstack/` is covered | "what else could this break"; context hygiene; proceed on reversible work; doc style; cutting AI tells from prose |
| https://github.com/multica-ai/andrej-karpathy-skills | karpathy-guidelines | MIT per README; **no LICENSE file** (2c6061419) | surgical changes, stated assumptions, verifiable success criteria |

### Stack patterns (TypeScript monorepo; swap for your stack)
| Upstream | Skills | Licence (checked at) | Use |
|---|---|---|---|
| https://github.com/affaan-m/ECC (formerly everything-claude-code; the old URL redirects) | api-connector-builder, contract-first, database-migrations, e2e-testing, error-handling, nestjs-patterns, postgres-patterns, prisma-patterns, react-testing, redis-patterns, vite-patterns | MIT (d2ef26805) | reference patterns per framework. We removed fetch-and-run instructions from some before vendoring |

### Design and motion
| Upstream | Skills | Licence (checked at) | Use |
|---|---|---|---|
| https://github.com/emilkowalski/skills | animate, animation-vocabulary, apple-design, emil-design-eng, find-animation-opportunities, improve-animations, review-animations | MIT (f7ce8c02d) | motion decisions, review and audits |
| https://github.com/Leonxlnx/taste-skill | design-taste-frontend, redesign-existing-projects | MIT (f6b76575f) | avoiding templated-looking UI |
| https://github.com/pbakaus/impeccable | impeccable | Apache-2.0 (c4cd1924c) | interface critique and polish. We removed fetch-and-run instructions before vendoring |
| https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | ui-ux-pro-max | MIT (6ae86f61f) | searchable style, palette, type and UX-guideline data |

### Legal practice (only if you draft legal documents)
| Upstream | Licence (checked at) | Use |
|---|---|---|
| https://github.com/anthropics/claude-for-legal | Apache-2.0 (4a6c65188) | practice-area references |
| https://github.com/sboghossian/master-claude-for-legal | MIT per its LICENSE file (b5dde5f9d); GitHub's licence label reads NOASSERTION, so read the file yourself | legal-ops workflows (privilege layers, citation checks). Drafts only; a lawyer signs off |

### User-level skill families (installed per user, not per project)
| Upstream | Licence (checked at) | Use |
|---|---|---|
| https://github.com/garrytan/gstack | MIT (1d3c63c53) | a large family: plan reviews (CEO, design, engineering), QA, browse, ship, retro, investigate, context save and restore |
| AWS agent skills (**source not confirmed**: the installed files name no upstream, so we give no URL) | unknown | per-service AWS guidance (IAM, CDK, serverless, storage, cost). Do not adopt until you have found and read the source |

Our rule is "no global skills install", because a user-level skill loads into every agent on the machine. If
you install a family at user level, read it first and accept that blast radius knowingly.

### Tried, not kept
| Upstream | Licence (checked at) | Why not |
|---|---|---|
| https://github.com/emotixco/claude-skills-founder (competitor matrix, go-to-market, metrics, pricing, interviews) | MIT (ea6864c05) | zero uses in 900+ sessions; proposed for removal |

## Plugins
Marketplace: https://github.com/anthropics/claude-plugins-official (Apache-2.0 for the marketplace repository,
099387b7a). **Each plugin carries its own licence**, given in its marketplace entry, and several point at
third-party repositories. Read each plugin's own entry and source. A plugin is a bundle of skills, agents,
hooks or servers, so read it like any other outside code.

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

A second marketplace: https://github.com/thedotmack/claude-mem, Apache-2.0 (0c488b54e). It provides a
persistent memory plugin.

## MCP servers and connectors
| Item | Use | Rule |
|---|---|---|
| shadcn MCP (`npx shadcn@<exact version> mcp`, pinned) | browse and fetch UI component source | browse and fetch only; never `add` into the tree; adapt as reviewed raw source |
| AWS MCP | cloud reads | read-only use |
| hosted connectors: mail, drive, calendar, docs, browser automation | drafts, reading shared files, scheduling, browser checks | drafts only; nothing is sent or submitted without the owner |

## Tools
| Tool | Licence | Use |
|---|---|---|
| tmux (or any terminal multiplexer) | | long-running head sessions |
| https://github.com/herdrdev/herdr (with herdr-core and herdr-app) | Apache-2.0 | terminal session manager. Its own integration installs the session-start pane-state hook (`hooks/README.md`); that script is herdr's and is regenerated on update |
| ripgrep, git, Node | | everything else |
