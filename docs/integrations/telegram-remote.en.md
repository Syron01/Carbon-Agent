# AstroAgent Telegram Remote

A lightweight remote service to securely control your AstroAgent machine from your phone using Telegram.

## Setup

1. Open `@BotFather` on Telegram.
2. Create a new bot with `/newbot` and get your token.
3. Send a message to your bot.
4. To learn your Chat ID, run the service once while `TELEGRAM_ALLOWED_CHAT_IDS` is empty; the bot will reply with your unauthorized chat ID.
5. Copy `.env.telegram.example` to `.env` and fill in the values.

PowerShell example:

```powershell
$env:TELEGRAM_BOT_TOKEN="BOT_TOKEN"
$env:TELEGRAM_ALLOWED_CHAT_IDS="CHAT_ID"
$env:ASTRO_REMOTE_ROOT="C:\Users\ozenc\OneDrive\Desktop"
npm run remote:telegram
```

## Commands

```txt
/start or /help   help guide
/status           service status
/projects         list projects in root folder
/cd <folder>      select active project
/pwd              print active folder
/git              git status
/run <command>    execute allowed command
/task <work>      record a task into .astroagent-remote/tasks.jsonl
/logs             get recent remote logs
```

## Allowed /run Commands

Default safe list:

- `npm test`
- `npm run test`
- `npm run build`
- `npm run check`
- `npm install`
- `git status`
- `git diff`
- `git log`
- `git pull`
- `node ...`

Dangerous shell characters and deletion/shutdown/network commands are strictly blocked.

## Auto-Start

The simplest way on Windows: run this command on user login using Task Scheduler:

```powershell
npm run remote:telegram
```

The start folder must be this repository root.
