# AstroAgent UI Design Skill

Bu dosya AstroAgent için UI/TUI üreten ajanlar tarafından okunmalıdır. Amaç: generic AI arayüzü değil, kimliği olan profesyonel tasarım.

## AstroAgent terminal paleti

- Background: `#1b1517`
- Surface: `#241a1d`
- Tool surface: `#21181b`
- Accent red/coral: `#d08a7a`
- Secondary rose: `#c99a8d`
- Amber: `#d6b08a`
- Success sage: `#a8b58f`
- Error soft red: `#d17b83`
- Text: `#eadbd5`
- Muted: `#9a7774`
- Border: `#3a2628`

## TUI kuralları

1. Tek odak alanı: gereksiz sağ/sol paneller ekleme.
2. Footer kısa olmalı: cwd/git, model, automation, context, browser.
3. Header ürün kimliğini taşır: `inspect → act → verify`.
4. Animasyonlar minimal olmalı: spinner, pulse, kısa transition; gürültü yok.
5. Renkler bilgi taşır: accent = odak, amber = dikkat, sage = başarılı, soft red = hata.
6. Uzun listelerde token/ekran tasarrufu: ilk 10-20 öğe, devam için komut öner.

## Browser overlay kuralları

- Overlay varsayılan kapalı.
- `visual: true` verilirse kısa, sağ üstte, yarı saydam ve auto-hide.
- Element label varsayılan kapalı; `showLabels: true` ile açılır.
- `clear_ui` her zaman overlay kalıntılarını temizlemeli.

## Anti-patterns

- Neon mavi/mor aşırı parlak tema.
- Büyük sağ panel, boş roadmap, çalışmayan sayaç.
- Her aksiyonda ekrana etiket basmak.
- Uzun JSON/base64 çıktıyı modele dökmek.
- Generic Bootstrap/Tailwind görünümü.
