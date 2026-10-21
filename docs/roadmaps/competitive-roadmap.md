# AstroAgent Competitive Roadmap

AstroAgent hedefi: terminalde çalışan, düşük token tüketen, browser automation yapabilen ve kurumsal kalite kapısından geçen en ciddi coding agent deneyimi.

## Rakiplerden öğrenilenler

- **Claude Code**: terminal-native workflow, repo okuma, test, git/PR, MCP, uzun context.
- **Cursor**: composer, custom rules, hızlı multi-file edit, paralel agent/worktree.
- **Windsurf**: Cascade agent, insan-AI akışı, preview/deploy, agent komuta merkezi.
- **Codex CLI**: local-first agent, izin modları, multimodal input, kontrollü full-access.

## AstroAgent farkı

1. **Terminal-first premium TUI**
   - Tek kolon, yumuşak bordo/amber palet.
   - Header: inspect → act → verify.
   - Footer: sadece kritik bilgiler.

2. **Token ekonomisi**
   - Varsayılan kısa browser output.
   - Base64/screenshot dump koruması.
   - Index/search öncelikli büyük repo akışı.
   - Aggressive compaction desteği.

3. **Browser Bridge**
   - Tabs/page/read_dom/get_elements.
   - click/type/hover/press_key.
   - drag/drop ve upload_file.
   - Internal browser sayfalarını reddeden güvenlik katmanı.
   - Overlay/label opt-in.

4. **Automation Mode**
   - Kapalı gelir.
   - Açıkken model yanında görünür.
   - Çok adımlı app/browser/terminal görevleri için özel system prompt.

5. **Release ergonomisi**
   - `AstroAgent update` / `astrocli update` GitHub’dan son sürümü çekip global kurulumu yenileyebilir.

## Sonraki kurumsal backlog

- Permission profiles: read-only, safe-edit, automation, full-access.
- MCP presetleri: GitHub, Jira, Slack, docs.
- Browser selector heuristics için Playwright-benzeri skorlayıcı.
- Session checkpoints ve otomatik rollback.
- TUI içinde kompakt task timeline; boş panel yok.
