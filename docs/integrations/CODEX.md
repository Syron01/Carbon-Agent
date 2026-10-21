# Codex Entegrasyonu

> [!NOTE]
> **Codex**, AstroAgent'ın günlük kodlama görevlerinde ve yüksek hız gerektiren büyük repo (repository) analizlerinde kullandığı amiral gemisi dil modelidir.

AstroAgent, Codex modellerini standart bir API entegrasyonundan çok daha öteye taşır. Codex, AstroAgent'ın terminal okuma ve dosya sistemi (file system) özellikleriyle birleştiğinde **benzersiz bir kod asistanına** dönüşür.

## Desteklenen Codex Varyasyonları

AstroAgent v1.27-v2 ile birlikte Codex, farklı donanım ve kullanım senaryolarına göre 5 farklı varyasyonda sunulmaktadır:

| Model Adı | Kullanım Alanı | Hız | Bağlam Penceresi (Context) |
| :--- | :--- | :--- | :--- |
| **GPT-5.1 Codex** | Standart günlük kullanım, refactoring | Çok Hızlı | 128K Token |
| **GPT-5.1 Codex Max** | Dev monorepo'lar ve uzun kod tabanları | Orta | **256K Token** |
| **GPT-5.1 Codex Mini** | Hızlı hata düzeltme, syntax hataları | Ultra Hızlı | 32K Token |
| **GPT-5.2 Codex** | Gelişmiş mimari kararlar, kompleks testler | Yavaş | 128K Token |
| **GPT-5.3 / 5.4 Codex** | Gelecek vizyonu (Deneysel), üst düzey zeka | Orta | 256K Token |

---

## Neden Codex?

Codex modelleri doğrudan kod yazmak için eğitilmiştir. AstroAgent, Codex'i şu işlemlerde öncelikli olarak tercih eder:
1. **Büyük Çaplı Refactoring:** Binlerce satırlık dosyalarda değişken ve fonksiyon adlarını güvenle değiştirmek.
2. **Terminal Hataları:** Terminalde alınan `Error: MODULE_NOT_FOUND` gibi hataları mili-saniyeler içinde anlayıp çözüm üretmek.
3. **Regex ve Algoritma:** Karmaşık algoritmik problemleri optimize edilmiş şekillerde yazmak.

> [!IMPORTANT]
> Codex modelleri, AstroAgent'ın **Quality Gate** (Kalite Kapısı) testlerinden geçirildiğinde en az %99 başarı oranına sahip kodlar üretir.

## Codex Nasıl Seçilir?
AstroAgent TUI (Terminal User Interface) üzerinden `Modeller` menüsüne giderek istediğiniz Codex versiyonunu tek tıkla aktif edebilirsiniz. Seçtiğiniz andan itibaren tüm arka plan analizleri ve kodlamalar bu model üzerinden gerçekleşir.
