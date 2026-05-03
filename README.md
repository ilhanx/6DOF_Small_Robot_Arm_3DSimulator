# 6-DOF Small Robot Arm — 3D Simulator

Web tabanlı 6 eksen robot kol simülatörü (Three.js, Vite).
Mechanic Small Robot Arm  Construction Videos powered by Skyentific...

https://github.com/SkyentificGit/SmallRobotArm

https://www.youtube.com/watch?v=oFCUw1pXlnA&t=130s

# Arduino Mega Codes 
6DoF_Arm_BT_IO.ino
it has included bluetoot HC06 module compatibility

Board Pin Numbers 
PinNumbers_For_ArduinoMega.txt

AX	1	2	3	4	5	6
---------------------------------------------------
PUL	45	41	37	A0	46	A6	
DIR	43	39	35	A1	48	A7
EN	33	33	33	38	A2	A8

RX TX
19 18

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
