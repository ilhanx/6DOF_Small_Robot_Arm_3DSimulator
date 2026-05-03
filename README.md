# 6-DOF Small Robot Arm — 3D Simulator

Web tabanlı 6 eksen robot kol simülatörü (Three.js, Vite).

## Yerelde çalıştırma (zorunlu)

Projeyi ZIP’ten açıp yalnızca `index.html` dosyasına çift tıklamak **çalışmaz**: tarayıcı `file://` üzerinde geliştirme modülünü (`src/main.js` + `three` vb.) güvenlik nedeniyle düzgün yüklemez; 3B alan siyah kalır.

```bash
cd 6DOF_Small_Robot_Arm_3DSimulator   # veya klonladığınız klasör
npm install
npm run dev
```

Tarayıcıda açılan adres (genelde `http://localhost:5173`) üzerinden kullanın.

Üretim derlemesini denemek için:

```bash
npm run build
npm run preview
```

## GitHub Pages

Depo ayarlarında **Pages → Source: GitHub Actions** seçiliyken `main` dalına push ile site derlenir. Adres: `https://<kullanıcı>.github.io/<depo-adı>/`
