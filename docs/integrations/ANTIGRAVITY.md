# Antigravity Integration

CarbonAgent features native integration with Antigravity through the highly optimized `google-antigravity` API adapter and `antigravity` provider. This integration allows senior developers and agentic systems to exploit Google's robust sandbox environments and state-of-the-art reasoning architectures.

All mappings and limits are structurally verified against Antigravity technical specifications.

---

## Canonical Model Registry

Ensure you utilize the exact canonical IDs listed below for perfect compatibility with bridge proxies and routing layers. Short patterns (e.g., `sonnet-5-5`) will still be resolved via fuzzy model matching.

| Canonical Model ID | Display / Provider Target | Context Window | Output Limit | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `antigravity-gemini-4-argon` | Gemini 4 Argon (Medium) | 1,048,576 | 65,536 | Frontier reasoning, multi-agent orchestration & deep codebase tasks |
| `antigravity-gemini-3-8-flash-high` | Gemini 3.8 Flash (High) | 1,048,576 | 65,536 | Ultra-fast high-throughput refactoring with deep thinking |
| `antigravity-claude-opus-5-5-thinking` | Claude Opus 5.5 (Medium) | 200,000 | 64,000 | Frontier architecture, system design and complex algorithmic reasoning |
| `antigravity-claude-sonnet-5-5-thinking` | Claude Sonnet 5.5 (Medium) | 200,000 | 64,000 | Daily production-grade coding and autonomous multi-file workflows |
| `antigravity-gpt-oss-120b-medium` | GPT-OSS 120B (Medium) | 128,000 | 16,384 | High-efficiency open-weights local execution & prompt auditing |

---

## Technical Integration Rules

- **Default Routing Target**: If no model is explicitly specified, `antigravity-claude-sonnet-5-5-thinking` acts as the primary driver.
- **Provider Envelope**: All models execute under the `antigravity` provider envelope.
- **API Translation**: The underlying `google-antigravity` adapter translates model IDs before formatting payload streams to the upstream Google sandbox proxy.
- **Claude Interleaved Thinking**: Claude models routed through this provider automatically enforce thinking headers to cleanly parse thought chains.

---

## Production CLI Usage Examples

### 1. Launching the Interactive TUI
Launch the workspace directly using Claude Sonnet 5.5 as the primary agentic engine:
```bash
carbon --provider antigravity --model antigravity-claude-sonnet-5-5-thinking
```

### 2. Autonomous Task Execution
Execute an autonomous codebase fix with deep reasoning via Gemini 4 Argon:
```bash
carbon "fix connection leaks in src/db.ts and verify using npm run test" --model antigravity-gemini-4-argon
```

### 3. Quick System Information
Query the active bridge connection, model mappings, and configuration state:
```bash
carbon --info
```

#### Expected System Verification Output:
```text
[CarbonAgent 49.0] - Coding Environment Status
-----------------------------------------------
Active Provider: Antigravity (google-antigravity)
Selected Model: antigravity-claude-sonnet-5-5-thinking

Available Antigravity Models:
  * Gemini 4 Argon (Medium)       [antigravity-gemini-4-argon]
  * Gemini 3.8 Flash (High)       [antigravity-gemini-3-8-flash-high]
  * Claude Opus 5.5 (Medium)      [antigravity-claude-opus-5-5-thinking]
  * Claude Sonnet 5.5 (Medium)    [antigravity-claude-sonnet-5-5-thinking]
  * GPT-OSS 120B (Medium)         [antigravity-gpt-oss-120b-medium]

Verification Status: Handshake success. Local sandbox ready.
```

---

## Core Verification Suite
Run the test harness to verify correct configuration, payload mapping, and sanitization flows:
```bash
# Test Antigravity specific model constraints
npm run test --workspace=packages/core -- antigravity-models.test.ts

# Test fuzzy resolver and bridge routing logic
npm run test --workspace=packages/cli -- model-resolver.test.ts

# Run the complete CI quality gate
npm run check:ci
```

---

## Core Verification Suite
Run the test harness to verify correct configuration, payload mapping, and sanitization flows:
```bash
# Test Antigravity specific model constraints
npm run test --workspace=packages/core -- antigravity-models.test.ts

# Test fuzzy resolver and bridge routing logic
npm run test --workspace=packages/cli -- model-resolver.test.ts

# Run the complete CI quality gate
npm run check:ci
```
