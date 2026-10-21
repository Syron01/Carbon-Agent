# AstroAgent Final Yapı

Bu paket AstroAgent'u telefondan yönetilebilir, kuyruklu, güvenli ve proje hafızalı hale getirir.

## Eklenen kurumsal katmanlar

1. Telegram görev kuyruğu
2. `/fix` doğrulama döngüsü
3. TUI scroll/mouse wheel iyileştirmeleri
4. `.astro/` proje hafızası
5. Local mobil web panel
6. Sesli komut dosyası algılama altyapısı

## Telegram komutları

```txt
/status
/projects
/cd <proje>
/git
/run <güvenli komut>
/task <iş>
/fix [build|test|check]
/queue
/cancel
/memory
/web
/logs
```

## Proje hafızası

`/memory` veya `/cd` sonrası aktif projede şu yapı oluşur:

```txt
.astro/
├─ memory.md
├─ rules.md
├─ commands.json
└─ project-profile.json
```

## Web panel

Remote çalışırken:

```txt
http://localhost:8787
```

Panel aktif proje, çalışan iş, bekleyen kuyruk ve logları gösterir.

## Güvenlik

- Sadece `TELEGRAM_ALLOWED_CHAT_IDS` içindeki kullanıcılar komut verebilir.
- `/run` whitelist ve tehlikeli karakter filtresiyle korunur.
- İşler kuyrukta tek tek çalışır.
- `/cancel` çalışan süreci sonlandırır.
