# AstroAgent Derinlemesine Teknik İnceleme ve Mimari Kılavuz

Bu belge; AstroAgent'un tasarım felsefesini, repo yapısını, çalışma modlarını, araç mimarisini, MCP entegrasyonlarını ve geliştirme akışlarını en detaylı şekilde bir araya getirir. Belge, projeye yeni dahil olan veya sistem üzerinde köklü değişiklikler yapmak isteyen kıdemli mühendisler için teknik bir referans olarak hazırlanmıştır.

---

## 1. AstroAgent Nedir ve Hangi Problemleri Çözer?

AstroAgent, terminal merkezli çalışmayı prensip edinmiş, yüksek odaklı bir otonom yazılım geliştirme ajanıdır. Geleneksel yapay zeka asistanlarının aksine, süslü açıklamalar veya gereksiz kod tekrarlarıyla token harcamak yerine, **en az kaynakla en doğru sonucu üretmeye** odaklanır.

### Temel Hedefler ve İlkeler
*   **Token Verimliliği ve Bağlam Yönetimi**: Model bağlamını (context) gereksiz yere şişirmekten kaçınır. Otomatik sıkıştırma (compaction) algoritmalarıyla uzun oturumları yönetilebilir kılar.
*   **Minimalizm ve Doğruluk**: Sadece hedef alandaki en küçük doğru satırı değiştirir. Geniş kapsamlı yıkıcı düzenlemeler yapmaz.
*   **Çok Yönlü Entegrasyon**: Terminal komut yürütme, tarayıcı otomasyonu (Browser Bridge), MCP sunucuları ve yerel kod araçlarını tek bir akışta birleştirir.
*   **Otonom Geliştirme Akışı**: `inspect → act → verify` (incele → uygula → doğrula) döngüsünü tam otonom şekilde çalıştırır.

---

## 2. Hızlı Kurulum ve Yol Ayarları

AstroAgent, hızlıca ayağa kaldırılmak üzere tasarlanmıştır. Aşağıdaki adımları takip ederek projeyi derleyebilir ve yerel sisteminizde çalıştırabilirsiniz.

### Çekirdek Kurulum Adımları
```bash
# 1. Depoyu yerel sisteminize klonlayın
git clone https://github.com/theayzek01/astroagent.git
cd astroagent

# 2. Monorepo bağımlılıklarını yükleyin
npm install

# 3. Tüm paketleri derleyin
npm run build

# 4. CLI paketini yerel olarak global şekilde bağlayın
npm install -g ./packages/cli
```

### Yol (Path) Yapılandırma Seçenekleri
AstroAgent, varsayılan olarak kullanıcı ana dizinindeki yapılandırma dizinlerini kullanır. Ancak ortam değişkenleri üzerinden tam denetim sağlayabilirsiniz:

*   **`ASTRO_PACKAGE_DIR`**: CLI'ın temaları, şablonları ve `package.json` dosyasını arayacağı ana dizini tanımlar. Varsayılan olarak kendi dizinini çözümler.
*   **`ASTRO_SHARE_VIEWER_URL`**: Paylaşılan oturum kayıtlarının görüntüleneceği web sunucu adresini belirler.
*   **`ASTRO_CODING_AGENT_DIR`**: Kullanıcının özel temalarının, geçmiş modellerinin ve model ayarlarının tutulacağı ana dizindir. Varsayılan olarak `~/.astroagent/engine/` yoludur.

---

## 3. Olası Hatalar ve Çözüm Kılavuzu

Geliştirme esnasında karşılaşabileceğiniz olası sorunlar ve bunların kesin çözüm adımları aşağıda listelenmiştir.

### Hata 1: UND_ERR_BODY_TIMEOUT (SSE Bağlantı Zaman Aşımı)
*   **Nedeni**: Yerel sağlayıcılar (örneğin Ollama) veya Antigravity büyük kod blokları üretirken veya yavaş yanıt verirken Undici varsayılan 300s zaman aşımına takılır.
*   **Çözüm**: AstroAgent, global Undici dispatcher ayarlarında zaman aşımını otomatik olarak devre dışı bırakır. Sorunun devam etmesi durumunda sağlayıcı zaman aşımı parametrelerini (`provider.timeoutMs`) kontrol edin.

### Hata 2: Tarayıcı Köprüsü Bağlantı Hatası (Browser Bridge Offline)
*   **Nedeni**: WebSocket sunucusunun arka planda başlatılamaması veya Chrome uzantısının izinsiz modda kalması.
*   **Çözüm**: Terminalden `/browser` komutunu çalıştırarak köprü durumunu denetleyin. Port çakışmalarını önlemek için `11434` portunun başka bir servis tarafından kullanılmadığından emin olun.

### Hata 3: TUI Ekranında Kayma veya Bozulma
*   **Nedeni**: Terminal penceresinin aniden yeniden boyutlandırılması esnasında scroll anchor kayıpları yaşanması.
*   **Çözüm**: TUI arayüzünü yenilemek için terminalden `Ctrl + R` veya `/reload` komutunu gönderin.

---

## 4. Monorepo Mimari Katmanları

AstroAgent, sorumlulukların net şekilde ayrıldığı 4 ana monorepo katmanına sahiptir:

*   **`packages/tui`**: Terminal ekranına doğrudan çizim yapan, performans odaklı ve düşük seviyeli kullanıcı arayüzü kütüphanesidir.
*   **`packages/core`**: Ortak veri tiplerini, model yapılandırmalarını (Registry) ve servis sağlayıcı (Provider) adaptörlerini barındıran temel katmandır.
*   **`packages/engine`**: Araçların (Tools) çalıştırılmasından, süreç yönetiminden ve MCP (Model Context Protocol) sunucu bağlantılarından sorumlu motor katmanıdır.
*   **`packages/cli`**: Kullanıcı etkileşiminin, oturum yönetiminin (Session), komut sisteminin (Slash Commands), headless modun ve tarayıcı köprüsünün yönetildiği ana kontrol merkezidir.

---

## 5. Bootstrapping ve Çalışma Akışı

Bir kullanıcı terminale `astroagent` yazdığında arka planda şu işlemler sırayla gerçekleşir:

1.  **Başlatma ve Yol Tespiti**: CLI çalıştırıldığında kurulum yöntemi (global npm, pnpm vb.) tespit edilir ve `.astroagent` yapılandırma dizini çözümlenir.
2.  **Oturumun Kurulması (`EngineSession`)**: Aktif bir çalışma oturumu ayağa kaldırılır. Eğer devam eden bir oturum varsa `/resume` veya `--session` argümanı ile bu durum yüklenir.
3.  **Sağlayıcı ve Model Eşleştirme**: `antigravity` veya diğer aktif sağlayıcıların model listesi taranır, geçerli model (`antigravity-claude-sonnet-4-6-thinking` gibi) yüklenir.
4.  **Sistem Prompt Yapılandırması**: Seçili araçlar, aktif roller, tasarım rehberleri ve o anki oturum parametreleri taranarak dinamik bir sistem promptu inşa edilir.
5.  **I/O Arayüzünün Seçilmesi**: CLI, kullanıcının parametrelerine göre etkileşimli TUI arayüzünü, sessiz headless (komut satırı) modunu veya RPC sunucusunu tetikler.

---

## 6. Sıkıştırma (Compaction) ve Token Yönetimi

AstroAgent'un token tüketimini düşürme sırrı, `packages/cli/src/core/compaction/` altındaki akıllı sıkıştırma algoritmalarıdır:

*   **Context Limit Tespiti**: Gelen ve giden mesajların token sayısı sürekli olarak hesaplanır. Limit değerinin %85'ine ulaşıldığında otomatik bir `compaction` tetiklenir.
*   **Semantik Haritalama**: Geçmiş sohbet adımları, anlamsal bir yapısal özete dönüştürülür. Detaylı loglar veya büyük kod blokları atılır, yalnızca yapılan değişikliklerin mantığı ve ulaşılan durum korunur.
*   **`/compact` Komutu**: Geliştirici dilerse oturum esnasında `/compact` yazarak bu süreci elle tetikleyebilir.

---

## 7. Tarayıcı Otomasyonu (Browser Bridge)

Yerel web uygulamalarını test etmek ve görsel arayüz doğrulaması yapmak için AstroAgent, kendi Chrome uzantısını kullanır:

*   **Çift Katmanlı Mimari**: `browser-bridge-server.ts` üzerinden yerel bir WebSocket sunucusu ayağa kaldırılır. Chrome uzantısı bu sunucuya bağlanarak sekmelerin kontrol edilmesini sağlar.
*   **Güvenli DOM Kontrolü**: `browser_page read`, `click` ve `type` gibi yüksek hassasiyetli komutlar otonom olarak yürütülür.
*   **Görsel Hata Ayıklama**: `visual: true` bayrağı ile tarayıcı ekranından canlı anlık görüntüler alınabilir ve analiz edilebilir.

---

## 8. Lisans

MIT Lisansı ile korunmaktadır. Detaylar için `LICENSE` dosyasına göz atabilirsiniz.
