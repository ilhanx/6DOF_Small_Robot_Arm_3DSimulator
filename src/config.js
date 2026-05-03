/**
 * config.js — Tek Kaynak (Single Source of Truth)
 * Tüm robot geometrisi, limit, eksen ve hız bilgileri burada tanımlanır.
 * Diğer modüller bu dosyadan okur — asla kendi sabitlerini tanımlamaz.
 */

export const ROBOT_CONFIG = {
  // Eklem isimleri
  jointNames: ['J1 Base', 'J2 Omuz', 'J3 Dirsek', 'J4 Ön Kol', 'J5 Bilek', 'J6 Flanş'],

  // Kısa isimler
  jointKeys: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'],

  // Hareket tipleri — R: Roll (kendi etrafında), P: Pitch (ileri/geri veya yukarı/aşağı)
  // R-P-P-R-P-R konfigürasyonu
  motionType: ['roll', 'pitch', 'pitch', 'roll', 'pitch', 'roll'],

  // Three.js dönüş eksenleri — setAngles() bu eksenleri kullanır
  // J1: Y (turntable), J2: X (pitch), J3: X (pitch), J4: Y (roll), J5: X (pitch), J6: Y (roll)
  axes: ['y', 'x', 'x', 'y', 'x', 'y'],

  // Yön çarpanları — açıyı ters çevirmek için -1 kullan
  directions: [-1, -1, -1, 1, -1, 1],  // J1, J2, J3 ve J5 ters yön

  // Sıfır noktası ofsetleri (derece) — eklemin 0° pozisyonunu kaydırır
  // J3: 90° → J3=0° iken ön kol, üst kola 90° açıyla (dik) durur
  zeroOffsets: [0, 0, 90, 0, 0, 0],

  // Eklem limitleri (derece)
  limits: {
    j1: [-130.0, 130.0],
    j2: [-80.0, 130.0],
    j3: [-170.0, 74.0],
    j4: [-270.0, 270.0],
    j5: [-130.0, 130.0],
    j6: [-360.0, 360.0],
  },

  // Link uzunlukları (mm)
  linkLengths: {
    base_height: 35,         // Base → Omuz (J1→J2)
    upper_arm: 77,            // Omuz → Dirsek (J2→J3) — 115 * 2/3
    forearm: 58,              // Dirsek → Bilek (J3→J5/J6) — 115 / 2
    // Forearm alt segmentleri (orantılı yarıya indirildi)
    forearm_main: 40,         // J3→J4 (silindirik ön kol)
    wrist_body: 10,           // J4→J5 (bilek gövdesi)
    flange: 8,                // J5→J6 (flanş)
    tcpAxisOffset: 12,        // J6 merkezi -> eksen indikatörü başlangıcı (mm)
    tcpToolLength: 12,        // Eksen indikatörü boyu (yeşil çubuk uzunluğu, mm)
  },

  // DH Parametreleri [a, alpha, d, theta_offset]
  // Standard DH konvansiyonu
  dh: [
    { a: 0,   alpha: -Math.PI / 2, d: 35,  offset: 0 },   // J1
    { a: 115, alpha: 0,             d: 0,   offset: 0 },   // J2
    { a: 0,   alpha: -Math.PI / 2, d: 0,   offset: 0 },   // J3
    { a: 0,   alpha: Math.PI / 2,  d: 80,  offset: 0 },   // J4
    { a: 0,   alpha: -Math.PI / 2, d: 0,   offset: 0 },   // J5
    { a: 0,   alpha: 0,             d: 35,  offset: 0 },   // J6
  ],

  // Başlangıç pozisyonları (derece)
  homePosition: { j1: 0, j2: -78.0, j3: 73.0, j4: 0, j5: -93, j6: 0 },
  startPosition: { j1: 0, j2: 0, j3: 0, j4: 0, j5: 90, j6: 0 },

  // Hız varsayılanları (0-100 arası)
  speed: {
    defaultMove: 60,      // Hareket hızı
    defaultAccel: 20,     // Kalkış hızı
    defaultDecel: 20,     // Duruş hızı
    minSpeed: 0,
    maxSpeed: 100,
  },

  // Slider renkleri — her eklem için ayrı renk
  jointColors: [
    '#4caf50',  // J1 — Yeşil
    '#2196f3',  // J2 — Mavi
    '#ff9800',  // J3 — Turuncu
    '#9c27b0',  // J4 — Mor
    '#e91e63',  // J5 — Pembe
    '#00bcd4',  // J6 — Cyan
  ],

  // Robot gövde renkleri
  bodyColors: {
    primary: '#D8845A',     // Turuncu (3D baskı gövde)
    accent: '#1a1a2e',      // Koyu lacivert (motor/kasnak)
    metal: '#8a8a8a',       // Gri (metal parçalar)
    joint: '#222222',       // Siyah (eklem diskleri)
    endEffector: '#cc3333', // Kırmızı (uç işlevci)
  },
};

/**
 * Yardımcı: Derece → Radyan
 */
export function deg2rad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Yardımcı: Radyan → Derece
 */
export function rad2deg(rad) {
  return rad * 180 / Math.PI;
}

/**
 * Yardımcı: Açıyı limitlere göre clamp et
 */
export function clampAngle(jointKey, angleDeg) {
  const [min, max] = ROBOT_CONFIG.limits[jointKey];
  return Math.max(min, Math.min(max, angleDeg));
}

/**
 * Yardımcı: Tüm açıları clamp et
 */
export function clampAllAngles(angles) {
  const clamped = {};
  for (const key of ROBOT_CONFIG.jointKeys) {
    clamped[key] = clampAngle(key, angles[key] || 0);
  }
  return clamped;
}
