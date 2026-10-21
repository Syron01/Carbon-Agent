# Proje Yapısı

- `packages/` — yayınlanabilir çalışma alanları (`cli`, `core`, `engine`, `tui`, `web-ui`).
- `scripts/` — derleme (build), sürümleme (release), teşhis (diagnostics) ve otomasyon scriptleri.
- `scripts/maintenance/` — eski temizlik, yeniden adlandırma ve tema bakım scriptleri.
- `docs/` — proje dokümantasyonu ve ana dizin.
- `docs/integrations/` — harici sistemler için entegrasyon kılavuzları.
- `docs/roadmaps/` — planlama ve yol haritası belgeleri.
- `docs/reports/` — geçmiş raporlar ve denetim notları.
- `sites/` — statik/pazarlama siteleri.
- `assets/` — dokümantasyon tarafından kullanılan depo düzeyindeki görseller.
- `themes/` — çalışma zamanı paket kodu olmayan işletim sistemi ve tema varlıkları.

Araçların kararlı çalışabilmesi için kök dizini (root) yalnızca paket, yapılandırma (config), lisans ve readme dosyaları ile sınırlı tutun.
