<div align="center">

<br />

<p align="center">
  <img src="https://skillicons.dev/icons?i=nodejs&theme=dark" width="56" height="56" alt="Node.js" />
  &nbsp;&nbsp;
  <img src="https://skillicons.dev/icons?i=ts&theme=dark" width="56" height="56" alt="TypeScript" />
  &nbsp;&nbsp;
  <img src="https://skillicons.dev/icons?i=react&theme=dark" width="56" height="56" alt="React" />
  &nbsp;&nbsp;
  <img src="https://skillicons.dev/icons?i=vite&theme=dark" width="56" height="56" alt="Vite" />
  &nbsp;&nbsp;
  <img src="https://skillicons.dev/icons?i=tailwind&theme=dark" width="56" height="56" alt="Tailwind CSS" />
  &nbsp;&nbsp;
  <img src="https://skillicons.dev/icons?i=jest&theme=dark" width="56" height="56" alt="Vitest / Tests" />
</p>

# Carbon Agent &mdash; Engine & Studio

<p>
  <img src="https://img.shields.io/badge/Build-Passing-2ea44f?style=flat-square&logo=githubactions&logoColor=white" alt="Build" />
  &nbsp;
  <img src="https://img.shields.io/badge/Tests-600%2B%20Passed-2ea44f?style=flat-square&logo=jest&logoColor=white" alt="Tests" />
  &nbsp;
  <img src="https://img.shields.io/badge/Node-20.x--24.x%20LTS-0969da?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node" />
  &nbsp;
  <img src="https://img.shields.io/badge/License-MIT-6e7781?style=flat-square" alt="License" />
</p>

<br />

</div>

---

### Project Structure

```
.
├── packages/
│   ├── cli/                  # CLI entry, Web Studio server & Chrome bridge
│   │   ├── src/
│   │   │   ├── cli/          # CLI arguments, help, terminal dashboard
│   │   │   ├── core/         # Engine session, tools, compaction, memory & MCP
│   │   │   ├── modes/        # Studio (Web UI), Interactive (TUI), RPC, Headless
│   │   │   └── utils/        # Utilities (version check, child process, changelog)
│   │   └── ui/               # Modern React + Vite + Tailwind Web Studio
│   ├── core/                 # LLM providers (Antigravity, Anthropic, OpenAI, Gemini), OAuth, types
│   ├── engine/               # Autonomous execution loop, swarm orchestration, state management
│   └── tui/                  # High-performance differential terminal UI library
├── docs/                     # Architectural manuals, ADRs, Antigravity integration guide
└── tools/                    # Bundling, releases, maintenance automation
```

---

### Tech Stack

| Component | Technology | Detail |
| :--- | :--- | :--- |
| **Runtime** | Node.js 20+ LTS / Bun | High-concurrency agent loop & subprocess execution |
| **Language** | TypeScript | `typescript ^5.7.0` |
| **LLM Providers** | Antigravity, Anthropic, OpenAI, Google Gemini, Ollama | Native multi-model routing & streaming |
| **Web Studio UI** | React 19 + Vite + Tailwind CSS | Port 3135 modern browser studio with real-time feedback |
| **Terminal UI** | Differential TUI Engine | Differential ANSI rendering with Kitty/iTerm2 image support |
| **Protocol & Bridge** | MCP (Model Context Protocol) & WebSockets | Bi-directional browser extension automation & custom tools |

---

### Getting Started

```bash
# 1. Install workspace dependencies
npm install

# 2. Build TypeScript & Web Studio UI
npm run build

# 3. Launch Carbon Agent Studio & TUI
npm start

# Or install globally and run:
npm install -g .
carbon
```

---

### CLI & Usage

| Command | Description |
| :--- | :--- |
| `carbon` | Launch interactive TUI and launch Web Studio on port 3135 |
| `carbon --studio` | Start Web Studio UI directly in default browser |
| `carbon --model antigravity-gemini-4-argon` | Launch with Gemini 4 Argon frontier reasoning |
| `carbon --model antigravity-gemini-3-8-flash-high` | Launch with high-effort thinking Gemini 3.8 Flash |
| `carbon --print "prompt"` | One-shot autonomous CLI execution without interactive loop |
| `carbon --headless` | Start API server only without terminal UI |

---

### Key Capabilities

- **Antigravity Frontier Support**: Native zero-latency integration for Gemini 4 Argon, Gemini 3.8 Flash, Claude Opus 5.5, Claude Sonnet 5.5, and GPT-OSS 120B.
- **Bi-Directional Browser Automation**: Seamlessly controls local browser sessions, forms, and cookies via WebSocket bridge.
- **Model Context Protocol (MCP)**: Dynamic tool discovery and server connection manager built directly into Web Studio and CLI.
- **Sub-Agent Swarm Orchestration**: Specialized parallel workers for planning, implementation, and test verification.
- **Fractal Context Compaction**: 10x token efficiency via multi-tier summarization and memory retention.

---

<div align="center">

<br />

<sub>Copyright &copy; 2024-2026 Syron01. All rights reserved.</sub>

<br />

</div>
