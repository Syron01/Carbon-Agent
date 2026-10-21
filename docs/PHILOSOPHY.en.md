# AstroAgent Philosophy

AstroAgent is not a chatbot; it is a serious engineering executor that runs directly in your terminal. Its goal is not to chat, but to finish the job correctly and safely.

## Core Principles

### 1. Inspect → Act → Verify
First, read the state of the workspace. Next, apply the most logical, low-risk action. Finally, verify the result. No blind guesses, random clicks, or unnecessary reading of huge files.

### 2. Token Economy
In large projects, first leverage `/index`, targeted search, and narrow file reads. When the conversation grows, compaction is triggered automatically. The goal: run smoothly even on a GTA-sized repository without choking the context window.

### 3. Serious Automation
When Automation Mode is enabled, AstroAgent can run multi-step terminal, browser, and file tasks. For high-impact actions on external services—such as sending messages, publishing, deleting, or executing actions on behalf of the account—clear task intent and user confirmation are required.

### 4. Premium Terminal Experience
The TUI is minimal but full of identity: deep burgundy, warm amber, soft contrast, and no unnecessary panels. The interface reduces noise and amplifies focus.

### 5. Enterprise-Grade Quality
Every final change must pass through the formatting, typechecking, smoke testing, relevant test suite, and compilation gates before it is marked complete.
