# Blender MCP

> [!NOTE]
> **Blender MCP (Model Context Protocol)**, AstroAgent'ın doğrudan Blender 3D yazılımı ile konuşmasını, sahneleri analiz etmesini, objeleri otonom bir şekilde oluşturup değiştirmesini sağlayan açık kaynaklı bir sunucu (server) entegrasyonudur.

AstroAgent, Blender işlemlerinde sıradan bir asistan gibi "Sana Python kodu vereyim, sen kopyala yapıştır" demez. **Model Context Protocol** sayesinde kendi yazdığı Python scriptlerini yerel sunucu üzerinden bizzat Blender'a gönderir, sonucu alır ve iş akışını devam ettirir.

## Kurulum ve Konfigürasyon

Blender MCP resmi olarak AstroAgent projesinin bir parçası olmasa da, topluluk tarafından geliştirilen eklentileri (add-on) kurarak saniyeler içinde entegre edilebilir.

### Adım 1: Blender Eklentisini Kurma
1. GitHub üzerinden güncel ve açık kaynaklı bir Blender MCP eklentisini indirin (Örn: `blender-mcp` repo'larındaki en güncel `.zip` dosyası).
2. Blender'ı açın.
3. **Edit > Preferences > Add-ons** menüsüne gidin.
4. Sağ üstteki **Install...** butonuna tıklayıp indirdiğiniz `.zip` dosyasını seçin.
5. Eklenti listesinde beliren eklentinin yanındaki kutucuğu işaretleyerek aktifleştirin.

*Bu aşamada eklenti, genellikle yerel bir porttan (örneğin websocket veya HTTP üzerinden) dinlemeye başlayacaktır.*

### Adım 2: AstroAgent mcp_servers.json Ayarı
AstroAgent'ın Blender MCP sunucusuna bağlanabilmesi için global MCP yapılandırma dosyanızı (genellikle `mcp_servers.json`) güncellemeniz gerekir:

```json
{
  "mcpServers": {
    "blender": {
      "command": "python",
      "args": ["-m", "blender_mcp_server", "--port", "8000"],
      "env": {}
    }
  }
}
```
> [!TIP]
> Sunucunun bağlanma yöntemi (stdio veya websocket) eklentiden eklentiye değişiklik gösterebilir. Kurduğunuz eklentinin kendi Github README sayfasına bakarak `command` ve `args` değerlerini doğrulayın.

---

## AstroAgent Blender ile Nasıl Çalışır?

Kurulum tamamlandıktan ve sunucu bağlandıktan sonra AstroAgent, "Blender MCP" yeteneklerini kazandığında çalışma mantığını otomatik olarak **Staged 3D Workflow (Aşamalı 3D İş Akışı)** moduna alır:

1. **Sahneyi İnceleme (Inspect First):** AstroAgent önce mevcut sahnedeki objeleri, kameraları ve ışıkları analiz eder (`get_scene_info` veya benzeri bir tool çağırarak).
2. **Planlama (Plan Scene Changes):** Yapacağı değişiklikleri planlar (örn. "Küpü 2 birim yukarı taşıyıp kırmızı materyal atayacağım").
3. **Küçük Parçalarla Uygulama (Apply Structure):** Devasa bir kod bloğu gönderip çökmesine yol açmak yerine, Python kodlarını modüler parçalar halinde çalıştırır.
4. **Doğrulama (Verify):** Yaptığı değişikliğin doğru sonuç verip vermediğini tekrar kontrol eder.

> [!WARNING]
> Blender işlemleri sırasında AstroAgent arka arkaya pek çok Python scripti yürütebilir. Ekranınızdaki objelerin aniden şekil değiştirdiğini veya hareket ettiğini görebilirsiniz, panik yapmayın! Ajan otonom iş akışındadır.
