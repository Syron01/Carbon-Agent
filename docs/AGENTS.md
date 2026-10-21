# AstroAgent Agent Rules

## Çalışma biçimi

- Dil: Kullanıcının dili.
- Stil: Kısa, ciddi, teknik.
- Akış: inspect → act → verify.
- Gereksiz açıklama yok; dosya yolu, sonuç ve test bilgisi var.
- Yeni proje/oturum temiz başlar: eski oturum, eski istek, eski dosya veya kullanıcıya ait başka proje bağlamı varsayılmaz.
- Sadece açıkça `--continue`, `--resume`, `--session`, `/resume` veya kullanıcı isteği varsa eski oturum içeriği referans alınır.

## Kod kalitesi

- Kullanıcı değişikliklerini koru.
- İlgisiz dosyaları revert etme.
- Önce repo bağlamını oku, sonra küçük ve doğru diff üret.
- Büyük refactor sadece açık ihtiyaç varsa.
- Secret, token, auth ve dosya sistemi işlemlerinde güvenlik kontrolü yap.

## Hafıza ve bağlam izolasyonu

- AstroAgent kalıcı “beyin” olarak sadece açıkça yüklenen dosyaları, aktif oturum geçmişini ve geçerli repo bağlamını kullanır.
- Yeni `astroagent` çalıştırması varsayılan olarak yeni session oluşturur; eski hafıza çağırmaz.
- Eski oturum kalıntısı istenmiyorsa `AstroAgent --clear-memory` kaydedilmiş session geçmişini siler.
- Tam temiz çalışma için `AstroAgent --no-session --no-context-files` kullanılabilir.
- Auth, model ve settings dosyaları hafıza değildir; güvenlik için `--clear-memory` bunları silmez.

## Büyük proje / düşük token stratejisi

1. Önce `/index` veya hedefli `rg/find`.
2. Sadece ilgili dosyaları oku.
3. Büyük çıktıları özetle; base64/log dump dökme.
4. Context büyürse `/compact` veya otomatik compaction.
5. Sonuçta kısa doğrulama raporu ver.

## Browser automation

- Browser görevi verilirse Chrome Browser Bridge kullanılabilir; “erişemem” denmeden önce `/browser` veya bridge status kontrol edilir.
- Önce sekme durumu için `browser_tabs list/active`, sayfa için `browser_page read` veya `get_elements` kullan.
- Kör tıklama yok; selector/element anlaşılmadan click/type yapılmaz.
- File picker için `upload_file`, drag/drop için `drag` kullanılır.
- Varsayılan output kısa tutulur; gerekirse `maxChars` / `maxElements` artırılır.
- Görsel overlay ve label varsayılan kapalıdır; sadece gerektiğinde `visual: true` veya `showLabels: true`.
- İş bitince overlay kalıntısı için `clear_ui` çalıştır.

## Automation Mode

Varsayılan kapalıdır. Açıkken AstroAgent çok adımlı terminal/browser/app görevleri yürütebilir. Yüksek etkili dış servis aksiyonlarında açık kullanıcı niyeti ve gerektiğinde onay aranır.

## Final kalite kapısı

Kod değiştiyse:

```bash
npm run check
npm test --workspace=packages/tui
npm run build
```

Güvenlik için:

```bash
npm audit --omit=dev --audit-level=high
```
