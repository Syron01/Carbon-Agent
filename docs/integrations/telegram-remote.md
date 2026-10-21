# AstroAgent Telegram Remote

Telefondan Telegram ile AstroAgent bilgisayarını güvenli komutlarla kontrol etmek için küçük remote servis.

## Kurulum

1. Telegram'da `@BotFather` aç.
2. `/newbot` ile bot oluştur ve token al.
3. Botuna bir mesaj at.
4. Chat ID öğrenmek için geçici olarak servisi `TELEGRAM_ALLOWED_CHAT_IDS` boşken çalıştır; bot sana yetkisiz chat id'yi döner.
5. `.env.telegram.example` dosyasını `.env` içine uygun değerlerle kopyala.

PowerShell örneği:

```powershell
$env:TELEGRAM_BOT_TOKEN="BOT_TOKEN"
$env:TELEGRAM_ALLOWED_CHAT_IDS="CHAT_ID"
$env:ASTRO_REMOTE_ROOT="C:\Users\ozenc\OneDrive\Desktop"
npm run remote:telegram
```

## Komutlar

```txt
/start veya /help  yardım
/status           servis durumu
/projects         ana klasördeki projeler
/cd <klasör>      aktif proje seç
/pwd              aktif klasör
/git              git status
/run <komut>      izinli komut çalıştır
/task <iş>        .astroagent-remote/tasks.jsonl içine görev kaydet
/logs             son remote logları
```

## İzinli /run komutları

Varsayılan güvenli liste:

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

Tehlikeli shell karakterleri ve silme/kapatma/network komutları bloklanır.

## Otomatik başlatma

Windows için en basit yol: Görev Zamanlayıcı ile oturum açınca şu komutu çalıştır:

```powershell
npm run remote:telegram
```

Başlangıç klasörü bu repo olmalı.
