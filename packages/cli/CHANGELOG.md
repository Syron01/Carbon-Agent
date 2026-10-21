# Changelog

## [Unreleased]

### Added

- 🌟 **TUI Revamp**: Added dynamic TrueColor (Cyan to Purple) gradient ASCII logo to the interactive mode header.
- 🧘 **Zen Mode & Roadmap HUD**: Added `/zen` command for an immersive full-screen focus mode and live roadmap sidebar.
- 🕰️ **Time Machine (`/history`)**: Added professional snapshot recovery interface leveraging the `shadow-git` extension.
- 👁️ **Autonomous Watcher (`/watch`)**: Added a fault-tolerant file system watcher with automated code analysis and suggestions.
- 📊 **Metrics (`/metrics`)**: Added a command to view detailed context usage and performance metrics.
- Added the Chrome browser bridge extension, browser control tools, and `/browser` status command.
- Added the `/mood` command, persistent affective-state control layer, and `/mood explain` journal.
- Added the `/agentmode on|off` command for one-command Agent System toggling.
- Added the `/agents` command and company-style coding Agent System prompt orchestration.
- Added the `/workspace` command to show the company-style agent workspace.

### Changed

- 🚀 **Browser Extension Revamp**: Completely redesigned the browser bridge UI with premium Glassmorphism and Tailwind-like element labels.
- ⚡ **Browser Performance**: Drastically improved DOM tree-walking speed and eliminated layout thrashing for smooth, lag-free operations.
- Updated the `/workspace` view with a colorful pixel-art styled company dashboard.

## [0.72.2]
### Added
- 🎮 **Discord Integration**: Manage servers, channels, and messages using the new `/discord` command and AI-driven tools.
- 🔄 **Dynamic UI Feedback**: Context-aware status messages like "Thinking...", "Writing code...", or "Executing tool..." for better visibility.
- 📊 **Progress Tracking**: Enhanced operational visibility during long-running tasks.

### Fixed
- TypeScript build issues and improved type safety in tool definitions.
- Security: Sensitive tokens are now stored in local settings.
