# Antigravity Entegrasyonu

AstroAgent, optimize edilmiş `google-antigravity` API adaptörü ve `antigravity` sağlayıcısı aracılığıyla Antigravity ortamlarına yerel entegrasyon desteği sunar. Bu entegrasyon, kıdemli geliştiricilerin ve otonom sistemlerin Google'ın güvenli korumalı alan (sandbox) altyapısından ve yeni nesil akıl yürütme (reasoning) mimarilerinden en üst düzeyde yararlanmasını sağlar.

Tüm model eşleştirmeleri ve sınırları `marcodiniz/ag-local-bridge` teknik spesifikasyonlarına göre yapısal olarak doğrulanmıştır.

---

## Resmi Model Listesi

Yerel köprü ve yönlendirme katmanlarıyla kusursuz uyumluluk sağlamak için aşağıda belirtilen resmi kimlikleri (Canonical IDs) kullanın. Kısa arama şablonları (örneğin `sonnet-4-6`) benzerlik eşleşmesi (fuzzy matching) ile çözümlenmeye devam eder.

| Model ID | Sağlayıcı Hedefi | Bağlam (Context) | Çıktı Sınırı | Birincil Kullanım Amacı |
| :--- | :--- | :--- | :--- | :--- |
| `antigravity-gemini-3-5-flash-medium` | Gemini 3.5 Flash (Medium) | 1,048,576 | 65,536 | Yüksek hızlı görevler ve hızlı yeniden yapılandırma |
| `antigravity-gemini-3-5-flash-high` | Gemini 3.5 Flash (High) | 1,048,576 | 65,536 | Akıl yürütme gerektiren karmaşık kod düzenlemeleri |
| `antigravity-gemini-3-5-flash-low` | Gemini 3.5 Flash (Low) | 1,048,576 | 65,536 | Hızlı sözdizimi düzeltmeleri ve basit analizler |
| `antigravity-gemini-3-1-pro-low` | Gemini 3.1 Pro (Low) | 1,048,576 | 65,535 | Düşük yoğunluklu akıl yürütme gerektiren iş akışları |
| `antigravity-gemini-3-1-pro-high` | Gemini 3.1 Pro (High) | 1,048,576 | 65,535 | Yüksek yoğunluklu mantık ve derin hata ayıklama |
| `antigravity-claude-sonnet-4-6-thinking`| Claude Sonnet 4.6 (Thinking) | 200,000 | 64,000 | Üretim kalitesinde yazılım geliştirme görevleri |
| `antigravity-claude-opus-4-6-thinking`  | Claude Opus 4.6 (Thinking) | 200,000 | 64,000 | Mimari tasarım ve yoğun matematiksel mantık |
| `antigravity-gpt-oss-120b-medium` | GPT-OSS 120B (Medium) | 128,000 | 16,384 | Yerel metin görevleri ve hızlı test adımları |

---

## Teknik Entegrasyon Kuralları

- **Varsayılan Yönlendirme**: Model açıkça belirtilmediğinde, `antigravity-claude-sonnet-4-6-thinking` modeli ana otonom sürücü olarak devreye girer.
- **Sağlayıcı Kapsayıcısı**: Tüm modeller `antigravity` sağlayıcı kimliği altında çalıştırılır.
- **API Çevirisi**: Alttaki `google-antigravity` adaptörü, veri akışını üst sağlayıcıya göndermeden önce `antigravity-` önekini otomatik olarak temizler.
- **Claude Düşünme Başlıkları**: Bu sağlayıcı üzerinden yönlendirilen Claude modelleri, düşünce zincirlerini temiz şekilde ayrıştırmak için `thinking-2025-01-31,interleaved-thinking-2025-05-14` beta başlıklarını zorunlu olarak ekler.

---

## Örnek CLI Kullanım Komutları

### 1. Etkileşimli TUI Arayüzünü Başlatma
Projeyi Claude Sonnet 4.6 akıl yürütme motoruyla interaktif TUI modunda açın:
```bash
AstroAgent --provider antigravity --model antigravity-claude-sonnet-4-6-thinking
```

### 2. Otonom Görev Çalıştırma
Gemini 3.5 Flash (High) kullanarak derinlemesine akıl yürütme ile otonom bir düzeltme görevi başlatın:
```bash
AstroAgent "fix connection leaks in src/db.ts and verify using npm run test" --model antigravity-gemini-3-5-flash-high
```

### 3. Sistem Bilgisini Sorgulama
Köprü bağlantı durumunu, model eşleştirmelerini ve aktif yapılandırmayı sorgulayın:
```bash
AstroAgent --info
```

#### Beklenen Sistem Çıktısı (Stdout):
```text
[AstroAgent 1.26-v2] - Local Coding Environment Status
-----------------------------------------------
Active Provider: Antigravity (google-antigravity)
Connected Bridge: OK (Port: 11434, Status: active)
Selected Model: antigravity-claude-sonnet-4-6-thinking

Available Antigravity Models:
  * Gemini 3.5 Flash (Medium)  [antigravity-gemini-3-5-flash-medium]
  * Gemini 3.5 Flash (High)    [antigravity-gemini-3-5-flash-high]
  * Gemini 3.5 Flash (Low)     [antigravity-gemini-3-5-flash-low]
  * Gemini 3.1 Pro (Low)       [antigravity-gemini-3-1-pro-low]
  * Gemini 3.1 Pro (High)      [antigravity-gemini-3-1-pro-high]
  * Claude Sonnet 4.6          [antigravity-claude-sonnet-4-6-thinking]
  * Claude Opus 4.6            [antigravity-claude-opus-4-6-thinking]
  * GPT-OSS 120B (Medium)      [antigravity-gpt-oss-120b-medium]

Verification Status: Handshake success. Local sandbox ready.
```

---

## Doğrulama ve Test Adımları
Model yapılandırmalarını ve API akışlarını yerel ortamınızda test etmek için test paketini çalıştırın:
```bash
# Antigravity model sınırlarını ve eşleşmelerini test eder
npm run test --workspace=packages/core -- antigravity-models.test.ts

# Model çözümleme ve yönlendirme mantığını test eder
npm run test --workspace=packages/cli -- model-resolver.test.ts

# CI kalite kapısını çalıştırarak tüm depo entegrasyonunu doğrular
npm run check:ci
```
