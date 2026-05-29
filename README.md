<div align="center">

# omo for Claude Code

**The lazy way to run omo inside Claude Code.**
A native Claude Code plugin marketplace by Sisyphus Labs.

<p>
  <a href="https://github.com/code-yeongyu/lazyclaudecode/stargazers">
    <img alt="Stars" src="https://img.shields.io/github/stars/code-yeongyu/lazyclaudecode?style=for-the-badge&color=D97757&logoColor=D9E0EE&labelColor=302D41" />
  </a>
  <a href="#license">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-D97757?style=for-the-badge&labelColor=302D41" />
  </a>
</p>

<p>
  <a href="#what-it-is">What it is</a>
  ·
  <a href="#install">Install</a>
  ·
  <a href="#components">Components</a>
  ·
  <a href="#mcp-servers">MCP</a>
  ·
  <a href="#telemetry">Telemetry</a>
  ·
  <a href="https://github.com/code-yeongyu/oh-my-openagent">omo</a>
</p>

</div>

<hr />

## What it is

**omo for Claude Code** brings the omo experience — rule injection, comment
checking, LSP intelligence, ultrawork orchestration, durable ultragoal
tracking, and start-work continuation — into [Claude Code](https://www.anthropic.com/claude-code)
through Claude Code's native plugin system.

This repository is the **distribution surface**: a native Claude Code plugin
marketplace. The marketplace is named **`sisyphuslabs`** and ships a single
plugin named **`omo`**. The repository name (`lazyclaudecode`) is the install
alias and the home of this marketplace — it is **not** the marketplace name.

> The marketplace name is `sisyphuslabs`. The plugin name is `omo`.
> You install the plugin as `omo@sisyphuslabs`.

Everything is self-contained: hooks, skills, subagents, and the bundled MCP
servers all resolve from `${CLAUDE_PLUGIN_ROOT}`, so the plugin runs correctly
straight from the Claude Code plugin cache.

## Install

### Native (recommended)

Add this marketplace, then install the `omo` plugin:

```text
/plugin marketplace add code-yeongyu/lazyclaudecode
/plugin install omo@sisyphuslabs
```

### Via the omo CLI

```bash
# Claude Code platform (cc is the short alias for claudecode):
bunx omo install --platform=cc

# or via the dedicated alias (same compiled CLI, defaults to Claude Code):
bunx lazyclaudecode install
```

The omo CLI shells out to `claude plugin marketplace add code-yeongyu/lazyclaudecode`
and `claude plugin install omo@sisyphuslabs`. If `claude` is not on your PATH,
it prints the two `/plugin` commands above so you can run them inside a Claude
Code session.

## Components

`omo` is one plugin namespace; each capability stays isolated internally as a
component.

| Component | What it does |
| --- | --- |
| **rules** | Injects `AGENTS.md` / `CLAUDE.md` / `.omo/rules/**` into context via `SessionStart`, `UserPromptSubmit`, `PostToolUse`, and `PostCompact`. |
| **comment-checker** | Runs comment-checker after `Write` / `Edit` / `MultiEdit` tool use to keep comments honest. |
| **lsp** | Exposes Language Server Protocol diagnostics, navigation, symbols, and rename through MCP plus post-edit hooks. |
| **ultrawork** | Detects `ultrawork` / `ulw` in a prompt and injects the full ultrawork orchestration directive. |
| **ultragoal** | Durable, repo-native multi-goal orchestration with embedded success criteria and an observable evidence audit under `.omo/ultragoal/`, scoped per Claude Code session. |
| **start-work-continuation** | A `Stop` / `SubagentStop` continuation hook that resumes `.omo/boulder.json` start-work plans, keyed per Claude Code session. |
| **telemetry** | Anonymous, opt-out daily-active signal emitted on the plugin `SessionStart` hook. |

## MCP servers

`omo` bundles two MCP servers, wired through `${CLAUDE_PLUGIN_ROOT}` so they
spawn cleanly from the plugin cache:

| Server | Purpose |
| --- | --- |
| **ast_grep** | Structural code search and rewrite via [ast-grep](https://ast-grep.github.io/). |
| **lsp** | Language Server Protocol tools: diagnostics, definitions, references, symbols, rename. |

## Skills & subagents

Installing `omo` registers a library of **skills** (init-deep, planning,
refactor, remove-ai-slops, review-work, start-work, and more) and a set of
**subagents** for orchestrated work:

| Subagent | Role | Model |
| --- | --- | --- |
| **reviewer** | Reviews ultrawork output against the directive. | opus |
| **metis** | Strategic planning and decomposition. | opus |
| **planner** | Turns objectives into executable plans. | opus |
| **momus** | Adversarial critique of plans and changes. | opus |
| **explorer** | Fast, read-only codebase reconnaissance. | haiku |
| **librarian** | Fast, read-only documentation and reference lookup. | haiku |

Skills carry a Claude Code Harness Tool Compatibility section so they speak in
Claude Code's native verbs (`Edit`, `Write`, `MultiEdit`, `Task`).

## Telemetry

omo for Claude Code sends an anonymous, at-most-once-per-UTC-day "still alive"
signal so the project can gauge real-world usage. It uses the same PostHog
project as the wider omo family but emits the **distinct** event
`omo_claude_daily_active`. The signal is keyed to a SHA256-hashed installation
identifier, person profiles are suppressed, and the daily dedup state is stored
locally.

### Opt out

```bash
# Claude Code only:
export OMO_CLAUDE_DISABLE_POSTHOG=1
export OMO_CLAUDE_SEND_ANONYMOUS_TELEMETRY=0

# Globally (also silences the rest of the omo family):
export OMO_DISABLE_POSTHOG=1
export OMO_SEND_ANONYMOUS_TELEMETRY=0
```

Setting `OMO_DISABLE_POSTHOG` disables omo for Claude Code telemetry too — the
global flag is inherited.

## Relationship to the omo family

omo ships in editions tuned to each agent harness. They all share the same
core ideas and the same `sisyphuslabs` identity.

| Edition | Harness | Distribution |
| --- | --- | --- |
| **Ultimate** | OpenCode | omo OpenCode plugin |
| **Light (Codex)** | OpenAI Codex | [lazycodex](https://github.com/code-yeongyu/lazycodex) |
| **Light (Claude Code)** | Claude Code | **this repo — lazyclaudecode** |

All editions descend from [oh-my-openagent (omo)](https://github.com/code-yeongyu/oh-my-openagent).

## License

[MIT](./LICENSE) © Yeongyu Kim
