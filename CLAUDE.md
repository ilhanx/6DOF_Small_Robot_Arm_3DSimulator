# 3dSimulator_AG — 6 Eksen Robot Kol Simülatörü

Web tabanlı 6-DOF (R-P-P-R-P-R) robot kol simülatörü. Gerçek donanımla (Arduino Mega + Bluetooth) seri port üzerinden haberleşebilir.

## Çalıştırma

```bash
npm install       # ilk kurulumda
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # üretim derlemesi (dist/)
npm run preview   # derlemeyi yerelde test et
```

`index.html`'e çift tıklayarak açmak ÇALIŞMAZ (`file://` ES module kısıtı) — daima dev server kullan.

## Teknoloji ve Mimari

- **Three.js + Vite + Vanilla JS/CSS** — framework yok, ES Modules.
- **`src/config.js` = Tek Kaynak (Single Source of Truth).** Tüm eklem eksenleri, yön çarpanları, limitler, link uzunlukları (mm), hızlar burada. Başka dosyada robot sabiti TANIMLAMA — config'den oku. (Bu kural önceki prototipin en büyük hatasından çıktı.)
- **FK bağımsız DH matris zinciri** ile hesaplanır (`kinematics.js`) — sahne grafiğinden pozisyon OKUMA (stale data hatası). IK: Jacobian / Gradient Descent.

### Modüller (src/)

| Dosya | Sorumluluk |
|-------|-----------|
| `main.js` (~2270 satır) | Giriş noktası — sahne, UI bağlama, animasyon döngüsü |
| `config.js` | ⭐ Tek kaynak — DH, limitler, eksenler, hızlar |
| `robot.js` | Three.js mesh hiyerarşisi |
| `kinematics.js` | FK (DH) + IK (Jacobian) |
| `trajectory.js` | Joint & Linear interpolasyon |
| `tracking.js` | Hedef takibi (closed-loop) |
| `collision.js` | Self-collision + workspace limiti |
| `scenario.js` | Senaryo kayıt/oynatma, JSON I/O |
| `serialPort.js` | Web Serial API (Chrome/Edge) — gerçek robota bağlantı, 115200 baud |
| `workspaceDrawing.js` | Çalışma alanı çizimi |
| `i18n.js` | TR/EN dil desteği |
| `ui.js`, `panelHelp.js`, `utils.js` | UI senkronu, yardım paneli, yardımcılar |

### Donanım tarafı

- `6DoF_Arm_BT_IO/` — Arduino Mega firmware (`.ino`) + pin haritası. Simülatör Web Serial ile bu firmware'e komut gönderir.
- Web Serial sadece Chrome/Edge'de ve localhost/HTTPS'te çalışır.

## Referans Belgeler

- `6DOF_Robot_Kol_Simulasyon_Uygulamasi_Gereksinim_dosyasi.docx` — SRS v1.0 (gereksinimler)
- `implementation_plan.md` — implementasyon planı + önceki prototipten çıkarılan 5 kritik ders (özellikle bölüm 1'i oku)
- `scenario_simcom_steps.json`, `move1_trajectory.txt` — örnek senaryo/trajectory verileri

## Git / Deploy

- Remote: `https://github.com/ilhanx/6DOF_Small_Robot_Arm_3DSimulator.git` (main)
- GitHub Pages: main'e push → GitHub Actions ile otomatik derlenip yayınlanır (`.github/workflows/`)
- Satır sonu: repo LF, Windows'ta CRLF uyarıları normal — dosyaların satır sonlarını toplu değiştirme.

## Çalışma Kuralları

1. UI metinleri `i18n.js` üzerinden — hardcode Türkçe/İngilizce metin ekleme.
2. Robot geometrisi/limit değişikliği SADECE `config.js`'te yapılır.
3. Kinematik değişikliklerinde hem simülasyonu hem (varsa bağlıysa) seri port çıkışını gözle doğrula.
4. İletişim dili Türkçe, samimi ton; kod ve commit mesajları İngilizce sürdürülür (mevcut gelenek).
