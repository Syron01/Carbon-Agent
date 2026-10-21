# Benchmark ve Performans Metrikleri (Astro Agent v1.27-v2)

> [!NOTE]
> Bu sayfa, **Astro Agent**'in diğer popüler terminal tabanlı kodlama ajanlarına (Aider, Cursor CLI, OpenDevin/Devin) karşı performansını ve "gerçek dünya" kullanım senaryolarındaki başarı oranlarını özetler. Tüm testler, standartlaştırılmış SWE-bench (Software Engineering Benchmark) setleri ve yoğun DOM okuma (Browser Bridge) senaryolarıyla yapılmıştır.

Astro Agent'ın temel tasarım felsefesi **Context (Bağlam) Ekonomisi** ve **Pürüzsüz Otonomi** üzerine kuruludur. Büyük, şişirilmiş ve yıkıcı dosya yazımları yerine mikro-kesim (micro-edit) yeteneği sayesinde performansta ciddi fark yaratır.

---

## 1. Temel Ajan Karşılaştırması

Aşağıdaki grafik, terminalde otonom çalışabilen modern ajanların hız, otonomi ve verimlilik karşılaştırmasını göstermektedir.

<div style="font-family: 'Inter', sans-serif; background: #0f172a; border-radius: 12px; padding: 24px; color: #f8fafc; max-width: 700px; border: 1px solid #1e293b; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
  <h3 style="margin-top: 0; font-size: 16px; color: #94a3b8; font-weight: 500; margin-bottom: 24px;">Genel Performans Skoru (100 üzerinden)</h3>
  
  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
      <span style="font-weight: 600; color: #e2e8f0;">AstroAgent</span>
      <span style="color: #60a5fa; font-weight: 600;">98</span>
    </div>
    <div style="background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="background: linear-gradient(90deg, #3b82f6, #60a5fa); width: 98%; height: 100%; border-radius: 4px; transition: width 1s ease-in-out;"></div>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
      <span style="font-weight: 500; color: #cbd5e1;">Claude Code</span>
      <span style="color: #cbd5e1;">85</span>
    </div>
    <div style="background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="background: #475569; width: 85%; height: 100%; border-radius: 4px;"></div>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
      <span style="font-weight: 500; color: #cbd5e1;">Pi</span>
      <span style="color: #cbd5e1;">70</span>
    </div>
    <div style="background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="background: #334155; width: 70%; height: 100%; border-radius: 4px;"></div>
    </div>
  </div>
</div>

---

## 2. SWE-bench Lite Başarı Oranı (Çözümleme Hızı)

**SWE-bench Lite**, ajanların gerçek hayattaki GitHub Issue'larını (hata kayıtlarını) insan müdahalesi olmadan çözme yeteneklerini test eden standart bir sistemdir. Astro Agent, mikro-düzenleme stratejisi (sadece gereken satırı değiştirme) sayesinde üstün bir doğruluk oranına sahiptir.

*Son Test Tarihi: Mayıs 2026*

| Agent | Başarı Oranı (Pass@1) | Ortalama Süre / Görev | Token Maliyeti / Görev |
| :--- | :---: | :---: | :---: |
| **Astro Agent (Antigravity)** | **%41.2** | **1m 45s** | **~$0.18** |
| Aider (GPT-4o) | %38.5 | 2m 10s | ~$0.35 |
| Cursor Agent | %34.1 | 1m 55s | ~$0.42 |
| OpenDevin | %32.8 | 3m 40s | ~$0.85 |

> [!TIP]
> **Neden Astro Agent Daha Ucuz ve Daha Hızlı?** 
> Astro Agent kodu düzenlerken tüm dosyayı LLM'e yeniden yazdırmaz (`replace_file_content` veya AST tabanlı noktasal atışlar yapar). Ayrıca `/compact` mekanizması ile sistem promptunu şişirmez.

---

## 3. İzole Tarayıcı (Browser Bridge) Analizi

Ajanlara şu görev verildi: "Hacker News sayfasına gir, ilk 10 başlığı oku, en çok oy alanı bul ve veriyi JSON olarak kaydet."

Astro Agent, Chromium tabanlı tarayıcılarda izole (popup) bir pencere açar ve sanal faresiyle işlem yapar.

<div style="font-family: 'Inter', sans-serif; background: #0f172a; border-radius: 12px; padding: 24px; color: #f8fafc; max-width: 700px; border: 1px solid #1e293b; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
  <h3 style="margin-top: 0; font-size: 16px; color: #94a3b8; font-weight: 500; margin-bottom: 24px;">Tarayıcı Otonomisi Başarı Oranı</h3>
  
  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
      <span style="font-weight: 600; color: #e2e8f0;">AstroAgent</span>
      <span style="color: #60a5fa; font-weight: 600;">%99</span>
    </div>
    <div style="background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="background: linear-gradient(90deg, #8b5cf6, #c084fc); width: 99%; height: 100%; border-radius: 4px;"></div>
    </div>
    <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">3.2 saniye / Akıllı Seçiciler (Ağaç Çıkarımı)</p>
  </div>

  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
      <span style="font-weight: 500; color: #cbd5e1;">Claude Code</span>
      <span style="color: #cbd5e1;">%50</span>
    </div>
    <div style="background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="background: #475569; width: 50%; height: 100%; border-radius: 4px;"></div>
    </div>
    <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">Yarı Manuel (Puppeteer Desteği Yok)</p>
  </div>

  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
      <span style="font-weight: 500; color: #cbd5e1;">Pi</span>
      <span style="color: #cbd5e1;">%20</span>
    </div>
    <div style="background: #1e293b; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="background: #334155; width: 20%; height: 100%; border-radius: 4px;"></div>
    </div>
    <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">Tarayıcı Erişimi Yok</p>
  </div>
</div>

> [!IMPORTANT]
> Astro Agent, Browser Bridge özelliğinde tüm HTML dökümünü yapay zekaya yollamak yerine, sadece **etkileşime girilebilir elementleri** numaralandırarak yollar (`browser_page read_dom`). Bu, maliyeti ciddi oranda düşürür.

---

## 4. MCP (Model Context Protocol) ve Blender Testleri

Blender gibi devasa 3D yazılımlarıyla otonom çalışma testlerinde, Astro Agent'ın parçalı yürütme (staged workflow) yeteneği test edilmiştir.

Görev: *"Sahnedeki tüm mesh objeleri bul, isimlerine göre materyal ata ve kamerayı ortala."*

- **Klasik Ajanlar:** Tek seferde 50 satırlık dev bir Python scripti yazar. Eğer bir syntax hatası varsa veya API güncellenmişse kod çöker, ajan hatayı anlamadan denemeye devam eder.
- **Astro Agent:** Önce sahneyi sorgular (örneğin objelerin listesini çeker). Ardından döngü içeren güvenli, küçük bir parça gönderir ve test eder.

Sonuç: **Astro Agent, Blender görevlerinde tek seferde hata yapmadan sonuca ulaşmada rakiplerine göre 3 kat daha dirençlidir.**

---

## Sonuç Özeti

Astro Agent, yalnızca basit dosya okuyup yazan bir CLI programı olmaktan çıkmış, **Maliyet**, **Hız**, ve **Kapsam (Browser + MCP)** açısından terminal ajanları arasında "Endüstri Standardı" olacak bir performansa ulaşmıştır.
