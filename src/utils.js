/**
 * utils.js — Yardımcı fonksiyonlar
 * Matris işlemleri, matematiksel yardımcılar
 */

/**
 * 4x4 birim matris oluştur (Float64Array — hassasiyet için)
 */
export function mat4Identity() {
  return new Float64Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

/**
 * 4x4 matris çarpımı: result = A * B
 */
export function mat4Multiply(A, B) {
  const r = new Float64Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += A[i * 4 + k] * B[k * 4 + j];
      }
      r[i * 4 + j] = sum;
    }
  }
  return r;
}

/**
 * DH Transformasyon matrisi (Standard DH konvansiyonu)
 * T = Rz(theta) * Tz(d) * Tx(a) * Rx(alpha)
 */
export function dhTransform(theta, d, a, alpha) {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  return new Float64Array([
    ct, -st * ca,  st * sa, a * ct,
    st,  ct * ca, -ct * sa, a * st,
    0,   sa,       ca,      d,
    0,   0,        0,       1
  ]);
}

/**
 * Öteleme matrisi
 */
export function mat4Translation(x, y, z) {
  return new Float64Array([
    1, 0, 0, x,
    0, 1, 0, y,
    0, 0, 1, z,
    0, 0, 0, 1
  ]);
}

/**
 * X ekseni etrafında dönüş matrisi
 */
export function mat4RotX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float64Array([
    1, 0,  0, 0,
    0, c, -s, 0,
    0, s,  c, 0,
    0, 0,  0, 1
  ]);
}

/**
 * Y ekseni etrafında dönüş matrisi
 */
export function mat4RotY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float64Array([
     c, 0, s, 0,
     0, 1, 0, 0,
    -s, 0, c, 0,
     0, 0, 0, 1
  ]);
}

/**
 * Z ekseni etrafında dönüş matrisi
 */
export function mat4RotZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float64Array([
    c, -s, 0, 0,
    s,  c, 0, 0,
    0,  0, 1, 0,
    0,  0, 0, 1
  ]);
}

/**
 * 4x4 matrisin pozisyon bileşenini çıkar (x, y, z)
 */
export function mat4GetPosition(m) {
  return { x: m[3], y: m[7], z: m[11] };
}

/**
 * 4x4 matrisin rotasyon bileşeninden Euler açıları çıkar (ZYX konvansiyonu)
 */
export function mat4GetEulerZYX(m) {
  const sy = Math.sqrt(m[0] * m[0] + m[4] * m[4]);
  const singular = sy < 1e-6;

  let rx, ry, rz;
  if (!singular) {
    rx = Math.atan2(m[9], m[10]);
    ry = Math.atan2(-m[8], sy);
    rz = Math.atan2(m[4], m[0]);
  } else {
    rx = Math.atan2(-m[6], m[5]);
    ry = Math.atan2(-m[8], sy);
    rz = 0;
  }

  return { rx, ry, rz };
}

/**
 * Sayıyı belirli ondalık basamağa yuvarla
 */
export function roundTo(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Doğrusal interpolasyon (lerp)
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Trapez hız profili t değeri hesapla
 * accelRatio, decelRatio: 0-1 arası, toplam sürenin ne kadarı
 */
export function trapezoidalProfile(t, accelRatio, decelRatio) {
  if (accelRatio + decelRatio > 1) {
    const scale = 1 / (accelRatio + decelRatio);
    accelRatio *= scale;
    decelRatio *= scale;
  }

  const cruiseStart = accelRatio;
  const cruiseEnd = 1 - decelRatio;

  if (t <= 0) return 0;
  if (t >= 1) return 1;

  if (t < cruiseStart) {
    // Hızlanma bölgesi — S-curve benzeri
    const s = t / cruiseStart;
    return 0.5 * cruiseStart * s * s / (0.5 * cruiseStart + (cruiseEnd - cruiseStart) + 0.5 * decelRatio);
  } else if (t < cruiseEnd) {
    // Sabit hız bölgesi
    const accelDist = 0.5 * cruiseStart;
    const cruiseDist = t - cruiseStart;
    return (accelDist + cruiseDist) / (0.5 * cruiseStart + (cruiseEnd - cruiseStart) + 0.5 * decelRatio);
  } else {
    // Yavaşlama bölgesi
    const s = (t - cruiseEnd) / decelRatio;
    const accelDist = 0.5 * cruiseStart;
    const cruiseDist = cruiseEnd - cruiseStart;
    const decelDist = decelRatio * (s - 0.5 * s * s);
    return (accelDist + cruiseDist + decelDist) / (0.5 * cruiseStart + (cruiseEnd - cruiseStart) + 0.5 * decelRatio);
  }
}

/**
 * İki 3D vektör arasındaki mesafe
 */
export function distance3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
