# Anthropic Entegrasyonu

> [!NOTE]
> **Anthropic (Claude Opus & Sonnet)**, AstroAgent'ın özellikle **sistem tasarımı**, **mimari kararlar** ve **insan-benzeri düşünme (Thinking)** yeteneğine ihtiyaç duyulan durumlarda başvurduğu üst düzey modeller bütünüdür.

AstroAgent, Anthropic modellerini salt kod yazımından ziyade bir **"Baş Mühendis" (Lead Engineer)** gibi kullanacak şekilde entegre etmiştir.

## Anthropic Modelleri ve Özellikleri

| Model | Karakteristiği | Önerilen Kullanım Senaryosu |
| :--- | :--- | :--- |
| **Claude 3.5 Sonnet** | Son derece hızlı, dengeli zeka. | Yeni özellik geliştirme, orta ölçekli refactoring, UI/UX tasarımı, hızlı API entegrasyonları. |
| **Claude 3.5 Opus** | Derinlemesine zeka, yavaş ama kusursuz sonuç. | Sıfırdan repo kurulumu, veritabanı şema tasarımı, karmaşık güvenlik ve yetkilendirme (Auth) algoritmaları. |

---

## "Thinking" (Düşünme) Yeteneği

AstroAgent üzerinden Anthropic modellerini kullandığınızda, model kodu yazmadan önce **adım adım bir iç düşünme süreci** yürütür:

1. **Bağlamı Analiz Eder:** Repo'nun genel mimarisini inceler (örn. Next.js mi kullanılıyor, Vite mi?).
2. **Olası Hataları Önceden Görür:** "Eğer bu div'i silersem, mobil tasarımda taşma olabilir."
3. **Aksiyon Kararı:** En güvenilir `multi_replace_file_content` argümanlarını hazırlar.

> [!TIP]
> Anthropic Opus'u özellikle uzun ve karmaşık dokümantasyonları okutmak (örn. Stripe API dokümantasyonu) ve ardından bu API'yi projeye hatasız entegre etmek için kullanmanız şiddetle tavsiye edilir.

## Nasıl Kullanılır?
AstroAgent ayarlarından model sağlayıcıyı "Anthropic" olarak seçtiğinizde, CLI araçları otomatik olarak Anthropic'in API kısıtlamalarına göre (rate limit, max output tokens) çalışma mantığını yeniden optimize eder.
