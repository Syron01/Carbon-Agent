# Browser Kontrol & Bridge

> [!NOTE]
> **AstroAgent v1.27-v2** ile birlikte Browser Bridge (Tarayıcı Köprüsü) tamamen baştan yazıldı. Artık AstroAgent, standart yapay zekaların çok ötesinde, size **"Bulaşmayan" (Non-intrusive) Headless-like** bir tarayıcı otomasyonu sunuyor.

Piyasadaki diğer kod asistanları web araması yaparken arka planda görünmez bir sunucu (server) kullanır ve görsel öğeleri algılayamaz. AstroAgent ise **kendi özel tarayıcı eklentisini (Browser Extension)** kullanarak doğrudan sizin tarayıcınızın içinde ama **tamamen size ait alanlardan izole** şekilde çalışır.

## Nasıl Çalışır? (İzole Pencere Mimarisi)

Siz AstroAgent'a "Şu siteye gir ve formu test et" dediğinizde:
1. **İzole Pencere (Isolated Window) Açılır:** Sizin aktif Chrome sekmelerinize asla dokunmaz. Koyu temalı ve yumuşak kenarlıklı (dark soft borders) yepyeni, temiz bir popup penceresi açar.
2. **Sanal Fare (Virtual Mouse):** Açılan bu pencerede AstroAgent'ın ne yaptığını görebilmeniz için her zaman ekranda olan sanal bir fare (cursor) belirir. AstroAgent butona tıklamadan önce fare oraya hareket eder, görsel bir geri bildirim (highlight) oluşturur ve işlemi gerçekleştirir.
3. **Müdahalesizlik:** Bu sayede siz ana Chrome pencerenizde YouTube izlerken veya araştırma yaparken, AstroAgent kendi izole penceresinde testlerini koşmaya devam eder. Hızı ve doğruluğu standart yöntemlere kıyasla **10.000 kat daha iyidir.**

### Rakiplerle Karşılaştırma Tablosu

| Özellik | Standart AI Asistanları (Cursor vs) | AstroAgent v1.27-v2 |
| :--- | :--- | :--- |
| **Görsel Algı (Vision)** | Yok (Sadece HTML okur) | Var (Sayfanın 📸 Ekran Görüntüsünü anlık analiz eder) |
| **Etkileşim Gerçekliği** | API üzerinden sahte (Mock) istekler | Gerçek Chrome V8 Engine, Gerçek Fare Tıklamaları |
| **Çalışma Alanı** | Kullanıcının aktif sekmelerini bozar | Özel, Koyu Temalı, İzole Popup Penceresi |
| **DOM Okuma (read_dom)**| Ağır ve Token israfı | Optimize edilmiş, sadece interaktif elementleri çeken akıllı TreeWalker algoritması |
| **Görsel Geri Bildirim** | Yok | Var (Sanal Fare ve Etkileşim Animasyonları) |

---

## Güvenlik ve Gizlilik
AstroAgent'ın Browser Bridge eklentisi sadece yerel ağınızda (localhost:3133) haberleşir. İnternete açık bir port açmaz veya verilerinizi dışarı aktarmaz. 

> [!IMPORTANT]
> AstroAgent sadece kendi oluşturduğu İzole Pencere içindeki verilere müdahale eder, ana profilinizdeki sekmelere izinsiz erişmez.
