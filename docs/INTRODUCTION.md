# AstroAgent: Yeni Nesil Otonom Terminal Asistanı

> [!NOTE]
> **AstroAgent**, salt metin ve kod üretiminin ötesine geçen; kendi başına karar alabilen, terminal ve tarayıcıyı otonom kullanabilen **son derece gelişmiş bir yapay zeka kodlama asistanıdır**.

AstroAgent, piyasadaki standart asistanlardan (Cursor, GitHub Copilot) farklı olarak tamamen **terminal öncelikli** çalışır. Geliştiricinin her adımda yönlendirmesine ihtiyaç duymadan karmaşık repoları okuyabilir, analiz edebilir, PR (Pull Request) açabilir ve hatta tarayıcıyı açarak yazdığı kodu canlı olarak test edebilir.

## Neden AstroAgent?

Geleneksel araçlar sadece kod tamamlamaya veya basit sohbet arayüzlerine odaklanırken, AstroAgent tam bir **"Sistem Mühendisi"** gibi davranır. 

| Özellik | Standart AI Araçları (Örn: Copilot) | AstroAgent |
| :--- | :--- | :--- |
| **Çalışma Alanı** | Editör İçi (IDE kısıtlamaları var) | Tam Terminal ve Sistem Erişimi |
| **Tarayıcı Kullanımı** | Sadece web araması yapabilir | **Headless Chrome** veya **Isolated Window** üzerinden butonlara tıklar, sayfa test eder |
| **Otonomi Seviyesi** | İnsan komutu bekler | **Kendi hedeflerini belirler**, testleri koşar, hata alırsa düzeltir |
| **Model Esnekliği** | Sabit / Kilitli Modeller | **Antigravity, Codex, Anthropic Opus** gibi elit modelleri aynı anda sunar |
| **Terminal Komutları** | Sadece önerir, insan kopyalar | Kendi kendine `npm install`, `git commit` gibi tüm komutları güvenli şekilde çalıştırır |

---

## AstroAgent'ın Core (Çekirdek) Özellikleri

### 1. Kapsamlı Çalışma Alanı (Workspace) Farkındalığı
AstroAgent sadece açtığınız 1-2 dosyayı değil, binlerce dosyadan oluşan dev monorepo'ları bile anlayabilir. 
Gerektiğinde `grep`, `find`, `ls` gibi komutları kullanarak aradığı koda ulaşır.

### 2. Browser Bridge & Isolated Window (İzole Tarayıcı)
AstroAgent'ın en iddialı olduğu nokta **Tarayıcı Kontrolüdür**. Arka planda özel olarak ayrılmış, koyu temalı bir **"İzole Chrome Penceresi"** (Isolated Window) oluşturur. 
Siz kendi işinize devam ederken o, sanal bir fare yardımıyla web projelerinizi test eder, formları doldurur, konsol loglarını okur ve görsel hata ayıklaması yapar.

### 3. Çoklu Model ve Entegrasyon
Farklı görevler için en iyi zekayı seçme özgürlüğüne sahipsiniz:
- **Codex Modelleri:** Gündelik kodlamalar ve devasa repolarda hız.
- **Anthropic (Opus/Sonnet):** Çok karmaşık mimari tasarımlar ve "Thinking (Düşünme)" süreçleri.
- **Antigravity (Local/Private):** Sadece cihazınızda çalışan, ultra güvenli ve gizli kodlamalar.
- **GitHub CLI:** PR açma, inceleme, comment atma yetenekleri.

> [!TIP]
> AstroAgent'ın gerçek gücünü görmek için terminalinize sadece `astroagent` yazın ve arkanıza yaslanın!

---

*AstroAgent, geliştirici deneyimini bir "yardımcıdan" ziyade bir "takım arkadaşına" dönüştürmek için tasarlandı.*
