# GitHub CLI Entegrasyonu

> [!NOTE]
> AstroAgent, projenizin Git versiyon kontrolünü ve GitHub yönetimini tamamen sizin adınıza otonom olarak yönetebilir. 
> Terminalinizde `gh` (GitHub CLI) yüklüyse, AstroAgent bir **DevOps mühendisi** gibi çalışır.

## Yetenekleri ve Kullanım Şekilleri

AstroAgent'ın GitHub CLI entegrasyonu sayesinde kod editöründen veya tarayıcıdan ayrılmanıza gerek kalmaz. Her şey terminal içinde, otonom kararlarla yürütülür.

### 1. Otonom Pull Request (PR) Açma
AstroAgent yeni bir özellik kodladığında, işlemi sadece `git commit` ile bırakmaz:
- Değişiklikleri yeni bir branch'e alır (örn: `feat/new-auth-system`).
- Github sunucusuna `git push` yapar.
- `gh pr create` komutunu kullanarak, yapılan değişikliklerin detaylı bir özetini, varsa ekran görüntülerini PR açıklaması olarak ekler.

### 2. Issue Yönetimi ve Çözümü
Biri GitHub'da deponuza bir Issue (Hata/Talep) açtığında:
- AstroAgent'a sadece `Şu #45 numaralı issue'yu çöz` diyebilirsiniz.
- AstroAgent `gh issue view 45` ile hatayı okur.
- Kod tabanını tarar, hatayı tespit eder.
- Düzeltmeyi yapar ve commit mesajına `Fixes #45` ekleyerek konuyu kapatır.

### 3. Code Review (Kod İnceleme)
AstroAgent, takım arkadaşlarınızın açtığı Pull Request'leri inceleyip yorum yapabilir.

| İşlem | Komut Karşılığı (AstroAgent bunu otomatik yapar) |
| :--- | :--- |
| **PR Listesi Alma** | `gh pr list --state open` |
| **Kod Farklarını Okuma** | `gh pr diff [ID]` |
| **Yorum Ekleme** | `gh pr review [ID] --comment -b "..."` |

> [!WARNING]
> GitHub CLI entegrasyonunun tam çalışabilmesi için terminalinizde önceden `gh auth login` yapmış olmanız gerekmektedir. Aksi takdirde AstroAgent yetki hatalarıyla karşılaşacaktır.
