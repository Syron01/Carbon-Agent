# AstroAgent Browser Bridge

Chrome extension for local AstroAgent browser automation.

## Install

1. Run `AstroAgent browser-bridge`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select `packages/cli/browser-extension/chrome`.
6. Run `/browser` in AstroAgent. Badge `ON` means connected.

## Tools

- `browser_tabs`: list, active, open, close, focus, reload, navigate.
- `browser_page`: read, read_dom, get_elements, screenshot, click, hover, type, drag, mouse, canvas_info, canvas_draw, upload_file, press_key, scroll, evaluate, console_logs, wait, clear_ui.
- `mouse`: real Chrome DevTools mouse input for canvas apps, block editors, drawing, and simple games (`x`, `y`, optional `toX`, `toY`, `button`, `steps`, `ms`).
- `canvas_info` / `canvas_draw`: finds canvases and draws deliberate point paths without dumping image data.
- `screenshot`: captures the visible tab and returns an image block to the model.
- `scroll`: up, down, left, right, top, bottom. It prefers the nearest scrollable container around the viewport center before falling back to window scrolling.

## Design goals

- Low token output by default.
- No visual noise unless `visual` or `showLabels` is requested.
- File upload via Chrome debugger `DOM.setFileInputFiles`.
- Safer script injection: browser internal pages and other extension pages are rejected.
- Local-only bridge: `127.0.0.1:3133`, extension-origin WebSocket only.
- Smart scroll avoids jumping pages to the top while working inside nested app panels.

## Troubleshooting

- If badge is `OFF`, start `AstroAgent browser-bridge` and click the extension icon once.
- If Chrome was closed, AstroAgent tries to open the browser before failing.
- Use `browser_page clear_ui` to remove temporary labels/overlays.

