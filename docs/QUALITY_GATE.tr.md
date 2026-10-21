# Kalite Kapısı (Quality Gate)

AstroAgent değişiklikleri, birleştirme (merge) veya sürümleme (release) öncesinde küçük şirket üretim standartlarından (production gate) geçmelidir.

## Gerekli Kontroller

1. Kapsam açık olmalıdır: hedef, kabul kriterleri ve etkilenen paketler belirtilmelidir.
2. Kaynak kod temiz olmalıdır: `src/` dizini içinde üretilmiş (generated) JS, d.ts veya harita (.map) dosyası bulunmamalıdır.
3. Tip/lint/smoke kontrolleri geçmelidir: `npm run check`.
4. Değişen davranışlar için ilgili özel testler başarıyla tamamlanmalıdır.
5. Geçerli olduğunda güvenlik kontrolü geçmelidir: `npm audit --omit=dev`.
6. Kullanıcı değişiklikleri korunmalı; ilgisiz dosyalar eski haline (revert) döndürülmemelidir.

## Sürüm Kontrol Listesi (Release Checklist)

- Çalışma alanlarındaki sürüm numaraları birbiriyle uyumlu (lockstep) olmalıdır.
- Tarayıcı eklentisi (browser extension) manifest sürümü, sürüm numarası ile eşleşmelidir.
- Sağlayıcı veya model verileri değiştiğinde, otomatik üretilen model kaydı (model registry) güncel olmalıdır.
- `docs/PROJECT_STRUCTURE.md` hala depo yerleşimiyle eşleşmelidir.
- Kök dizin yalnızca paket/config/lisans/readme seviyesindeki dosyaları içermelidir.

## İnceleme Standardı (Review Standard)

Yalnızca yapılan değişiklik sorundan daha küçükse, kolayca geri alınabiliyorsa (rollback) ve PR'da listelenen komutlarla doğrulanmışsa onay verin.
