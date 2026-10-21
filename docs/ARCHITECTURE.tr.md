# AstroAgent Mimarisi

## Çalışma Alanları (Workspaces)

- `packages/cli` — komut giriş noktaları, etkileşimli mod (TUI), araçlar, ayarlar, tarayıcı köprüsü.
- `packages/core` — sağlayıcı kaydı (provider registry), model tanımları, API adaptörleri, akış/mesaj dönüşümleri.
- `packages/engine` — ajan/oturum motoru, MCP entegrasyonu, yürütme döngüsü.
- `packages/tui` — terminal çizim temelleri ve bileşenleri.
- `packages/web-ui` — web arayüz katmanı.

## Çalışma Zamanı Akışı (Runtime Flow)

1. CLI argümanları ve ayarları çözümler.
2. Model kaydı, yapılandırılmış/kullanılabilir modelleri çözümler.
3. Motor oturumu (Engine session) sistem promptunu, araçları, bellek/bağlamı ve sağlayıcı çalışma zamanını oluşturur.
4. Etkileşimli (TUI) / RPC / print modları arayüzü çizer veya sonuçları akış olarak sunar.
5. Araçlar (Tools) dosya sistemi, shell, tarayıcı, git, arama ve uzantı aksiyonlarını gerçekleştirir.

## Tasarım Kuralları

- Sağlayıcı (Provider) mantığını `core` içinde tutun; sağlayıcıya özgü yük (payload) kurallarını UI katmanına sızdırmayın.
- Terminal çizim mantığını `tui` içinde tutun; CLI bileşenleri çizim temellerini birleştirmeli (compose), mümkün olduğunca ham ANSI kodlarını kendisi yönetmemelidir.
- Üretilen çıktıları her zaman `dist/` içinde tutun, asla `src/` içine koymayın.
- Davranışı barındıran pakete yakın, odaklanmış testler yazmayı tercih edin.
- Güvenlik açısından hassas olan dosya sistemi/ağ davranışları mutlaka araç (tool) sınırlarında doğrulanmalıdır.
