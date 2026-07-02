/**
 * kinematics.js — Forward Kinematics & Inverse Kinematics
 * 
 * FK: DH matris zinciri ile end-effector pozisyonu hesaplar
 *     Three.js sahne grafiğinden tamamen BAĞIMSIZ!
 * 
 * IK: Damped Least Squares — Δθ = Jᵀ(JJᵀ + λ²I)⁻¹e (3×3 çözüm)
 *     Sayısal Jacobian; limit clamp; J5 dünya pitch iken J2/J3 ile eşlenik J5
 */

import { ROBOT_CONFIG, deg2rad, rad2deg, clampAngle } from './config.js';
import { t } from './i18n.js';
import {
  mat4Identity, mat4Multiply, mat4GetPosition, mat4GetEulerZYX,
  mat4RotX, mat4RotY, mat4RotZ, mat4Translation, dhTransform, distance3D
} from './utils.js';

/**
 * 3×3 lineer sistem (Gauss, kısmi pivot). DLS için (JJᵀ + λ²I) y = e.
 * @returns {[number,number,number]|null}
 */
function solveLinearSystem3x3(A, b) {
  const M = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    if (piv !== col) {
      const tmp = M[col];
      M[col] = M[piv];
      M[piv] = tmp;
    }
    const div = M[col][col];
    for (let c = col; c < 4; c++) M[col][c] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-15) continue;
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

export class Kinematics {
  constructor() {
    this.limits = ROBOT_CONFIG.limits;
    this.linkLengths = ROBOT_CONFIG.linkLengths;
  }

  /**
   * Forward Kinematics — DH matris zinciri
   * Girdi: { j1: deg, j2: deg, ..., j6: deg }
   * Çıktı: { position: {x,y,z}, orientation: {rx,ry,rz}, matrix: Float64Array }
   * 
   * Bu fonksiyon sahne grafiğinden bağımsızdır!
   * IK içinde güvenle çağrılabilir.
   */
  computeFK(angles) {
    const dirs = ROBOT_CONFIG.directions;
    const offsets = ROBOT_CONFIG.zeroOffsets;
    const j = [
      deg2rad((angles.j1 || 0) + offsets[0]) * dirs[0],
      deg2rad((angles.j2 || 0) + offsets[1]) * dirs[1],
      deg2rad((angles.j3 || 0) + offsets[2]) * dirs[2],
      deg2rad((angles.j4 || 0) + offsets[3]) * dirs[3],
      deg2rad((angles.j5 || 0) + offsets[4]) * dirs[4],
      deg2rad((angles.j6 || 0) + offsets[5]) * dirs[5],
    ];

    // Robot koordinat sistemi:
    // Y yukarı, X ileri, Z sağa (Three.js standardı)
    // Kinematik hesaplama klasik robotik konvansiyonunda
    // sonra Three.js koordinatlarına dönüştürülür

    let T = mat4Identity();

    // Base platformu (yerden J1'e kadar)
    // J1: Base — Y etrafında roll (turntable)
    T = mat4Multiply(T, mat4Translation(0, 0, 0));
    T = mat4Multiply(T, mat4RotY(j[0]));

    // J1 → J2: Yukarı base_height kadar
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.base_height, 0));

    // J2: Omuz — X etrafında pitch (ileri/geri)
    T = mat4Multiply(T, mat4RotX(j[1]));

    // J2 → J3: Üst kol uzunluğu kadar yukarı
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.upper_arm, 0));

    // J3: Dirsek — X etrafında pitch (yukarı/aşağı)
    T = mat4Multiply(T, mat4RotX(j[2]));

    // J3 → J4: Ön kol ana kısmı yukarı
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.forearm_main, 0));

    // J4: Ön kol roll — Y etrafında roll
    T = mat4Multiply(T, mat4RotY(j[3]));

    // J4 → J5: Bilek gövdesi
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.wrist_body, 0));

    // J5: Bilek pitch — X etrafında pitch
    T = mat4Multiply(T, mat4RotX(j[4]));

    // J5 → J6: Flanş
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.flange, 0));

    // J6: Flanş roll — Y etrafında roll
    T = mat4Multiply(T, mat4RotY(j[5]));

    // TCP ucu = yeşil eksen indikatörünün ucu:
    // J6'dan önce eksen başlangıç ofseti, sonra eksen boyu kadar ilerle.
    const tcpAxisOffset = this.linkLengths.tcpAxisOffset || 0;
    const toolLen = this.linkLengths.tcpToolLength || 0;
    const tcpTip = tcpAxisOffset + toolLen;
    if (tcpTip > 0) {
      T = mat4Multiply(T, mat4Translation(0, tcpTip, 0));
    }

    const position = mat4GetPosition(T);
    const orientation = mat4GetEulerZYX(T);

    return {
      position: { x: position.x, y: position.y, z: position.z },
      orientation: {
        rx: rad2deg(orientation.rx),
        ry: rad2deg(orientation.ry),
        rz: rad2deg(orientation.rz)
      },
      matrix: T
    };
  }

  /**
   * Her eklem için ayrı FK hesapla (collision ve görselleştirme için)
   * Çıktı: [pos0, pos1, pos2, pos3, pos4, pos5, pos6(TCP)]
   */
  computeAllJointPositions(angles) {
    const dirs = ROBOT_CONFIG.directions;
    const offsets = ROBOT_CONFIG.zeroOffsets;
    const j = [
      deg2rad((angles.j1 || 0) + offsets[0]) * dirs[0],
      deg2rad((angles.j2 || 0) + offsets[1]) * dirs[1],
      deg2rad((angles.j3 || 0) + offsets[2]) * dirs[2],
      deg2rad((angles.j4 || 0) + offsets[3]) * dirs[3],
      deg2rad((angles.j5 || 0) + offsets[4]) * dirs[4],
      deg2rad((angles.j6 || 0) + offsets[5]) * dirs[5],
    ];

    const positions = [];
    let T = mat4Identity();

    // Base origin
    positions.push(mat4GetPosition(T));

    // J1 rotation
    T = mat4Multiply(T, mat4RotY(j[0]));
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.base_height, 0));
    positions.push(mat4GetPosition(T));

    // J2 rotation
    T = mat4Multiply(T, mat4RotX(j[1]));
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.upper_arm, 0));
    positions.push(mat4GetPosition(T));

    // J3 rotation
    T = mat4Multiply(T, mat4RotX(j[2]));
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.forearm_main, 0));
    positions.push(mat4GetPosition(T));

    // J4 rotation
    T = mat4Multiply(T, mat4RotY(j[3]));
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.wrist_body, 0));
    positions.push(mat4GetPosition(T));

    // J5 rotation
    T = mat4Multiply(T, mat4RotX(j[4]));
    T = mat4Multiply(T, mat4Translation(0, this.linkLengths.flange, 0));
    positions.push(mat4GetPosition(T));

    // J6 rotation
    T = mat4Multiply(T, mat4RotY(j[5]));
    // TCP ucu (yeşil eksen indikatörü ucu)
    const tcpAxisOffset = this.linkLengths.tcpAxisOffset || 0;
    const toolLen = this.linkLengths.tcpToolLength || 0;
    const tcpTip = tcpAxisOffset + toolLen;
    if (tcpTip > 0) {
      T = mat4Multiply(T, mat4Translation(0, tcpTip, 0));
    }
    positions.push(mat4GetPosition(T));

    return positions;
  }

  /**
   * IK Jacobian pertürbasyonu: dünya pitch kilitliyse J2/J3 ile birlikte J5 güncellenir.
   */
  _anglesForJacobianStep(baseAngles, jointKey, offsetDeg, ctx) {
    const a = { ...baseAngles };
    a[jointKey] = clampAngle(jointKey, baseAngles[jointKey] + offsetDeg);
    if (ctx.hasFixedJ1) a.j1 = ctx.fixedJ1;
    if (ctx.hasFixedJ4) a.j4 = ctx.fixedJ4;
    if (ctx.hasFixedJ6) a.j6 = ctx.fixedJ6;
    if (ctx.hasFixedJ5) {
      a.j5 = ctx.fixedJ5;
    } else if (ctx.hasFixedJ5WorldPitch && (jointKey === 'j2' || jointKey === 'j3')) {
      a.j5 = clampAngle('j5', -ctx.fixedJ5WorldPitchDeg - (a.j2 + a.j3));
    }
    return a;
  }

  /**
   * Inverse Kinematics — Damped Least Squares (DLS)
   * Δθ = Jᵀ(JJᵀ + λ²I)⁻¹ e (3×3 çözüm).
   *
   * Girdi: target {x, y, z}, currentAngles {j1..j6}
   * Çıktı: { success, angles, error, iterations, message }
   *
   * options.damping: λ skaleri (yüksek → daha yumuşak adım)
   * options.includeJ4J6InIkJacobian: true ise (kilitsizse) j4/j6 Jacobian'a eklenir — TCP sürüklerken pozisyon+j6 birlikte.
   */
  solveIK(target, currentAngles, options = {}) {
    const maxIterations = options.maxIterations ?? 220;
    const tolerance = options.tolerance ?? 0.65;
    const dampingLambda = options.damping ?? 2.4;
    const delta = options.jacobianDeltaDeg ?? 0.18;
    const maxJointStepDeg = options.maxJointStepDeg ?? 3.5;
    const limitGuardDeg = options.limitGuardDeg ?? 2.5;
    const wristFollowGain = options.wristFollowGain ?? 0.06;
    const hasFixedJ1 = Number.isFinite(options.fixedJ1);
    const fixedJ1 = hasFixedJ1 ? clampAngle('j1', options.fixedJ1) : null;
    const hasFixedJ4 = Number.isFinite(options.fixedJ4);
    const fixedJ4 = hasFixedJ4 ? clampAngle('j4', options.fixedJ4) : null;
    const hasFixedJ6 = Number.isFinite(options.fixedJ6);
    const fixedJ6 = hasFixedJ6 ? clampAngle('j6', options.fixedJ6) : null;
    const hasFixedJ5 = Number.isFinite(options.fixedJ5);
    const fixedJ5 = hasFixedJ5 ? clampAngle('j5', options.fixedJ5) : null;
    const hasFixedJ5WorldPitch = Number.isFinite(options.fixedJ5WorldPitchDeg);
    const fixedJ5WorldPitchDeg = hasFixedJ5WorldPitch ? options.fixedJ5WorldPitchDeg : null;

    const jacobianCtx = {
      hasFixedJ1,
      fixedJ1,
      hasFixedJ4,
      fixedJ4,
      hasFixedJ6,
      fixedJ6,
      hasFixedJ5,
      fixedJ5,
      hasFixedJ5WorldPitch,
      fixedJ5WorldPitchDeg,
    };

    const useWristJac = options.includeJ4J6InIkJacobian === true;
    const activeJoints = ['j1', 'j2', 'j3', 'j4', 'j6', 'j5'].filter((key) => {
      if (key === 'j1' && hasFixedJ1) return false;
      if (key === 'j4' && (hasFixedJ4 || !useWristJac)) return false;
      if (key === 'j6' && (hasFixedJ6 || !useWristJac)) return false;
      if (key === 'j5' && (hasFixedJ5 || hasFixedJ5WorldPitch)) return false;
      return true;
    });

    let angles = { ...currentAngles };
    if (hasFixedJ1) angles.j1 = fixedJ1;
    if (hasFixedJ4) angles.j4 = fixedJ4;
    if (hasFixedJ6) angles.j6 = fixedJ6;
    if (hasFixedJ5) {
      angles.j5 = fixedJ5;
    } else if (hasFixedJ5WorldPitch) {
      angles.j5 = clampAngle('j5', -fixedJ5WorldPitchDeg - (angles.j2 + angles.j3));
    }

    for (let iter = 0; iter < maxIterations; iter++) {
      const fk = this.computeFK(angles);
      const current = fk.position;

      const ex = target.x - current.x;
      const ey = target.y - current.y;
      const ez = target.z - current.z;
      const error = Math.sqrt(ex * ex + ey * ey + ez * ez);

      if (error < tolerance) {
        return {
          success: true,
          angles: this._clampAll(angles),
          error,
          iterations: iter + 1,
          message: t('ik.solutionFound', { err: error.toFixed(2) })
        };
      }

      const J = [];
      for (let i = 0; i < activeJoints.length; i++) {
        const key = activeJoints[i];
        const anglesPlus = this._anglesForJacobianStep(angles, key, delta, jacobianCtx);
        const anglesMinus = this._anglesForJacobianStep(angles, key, -delta, jacobianCtx);
        const fkPlus = this.computeFK(anglesPlus);
        const fkMinus = this.computeFK(anglesMinus);
        const actualDelta = anglesPlus[key] - anglesMinus[key];
        if (Math.abs(actualDelta) < 1e-10) {
          J.push([0, 0, 0]);
          continue;
        }
        J.push([
          (fkPlus.position.x - fkMinus.position.x) / actualDelta,
          (fkPlus.position.y - fkMinus.position.y) / actualDelta,
          (fkPlus.position.z - fkMinus.position.z) / actualDelta,
        ]);
      }

      const n = activeJoints.length;
      const JJt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < n; i++) {
        const v = J[i];
        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 3; b++) {
            JJt[a][b] += v[a] * v[b];
          }
        }
      }

      const trace = JJt[0][0] + JJt[1][1] + JJt[2][2];
      const adaptiveScale = 1 + Math.min(error / 80, 4);
      const lambdaSq = (dampingLambda * dampingLambda) * adaptiveScale + (trace > 1e-8 ? trace / (n * 900) : 0);

      const A = [
        [JJt[0][0] + lambdaSq, JJt[0][1], JJt[0][2]],
        [JJt[1][0], JJt[1][1] + lambdaSq, JJt[1][2]],
        [JJt[2][0], JJt[2][1], JJt[2][2] + lambdaSq],
      ];
      const eVec = [ex, ey, ez];
      let y = solveLinearSystem3x3(A, eVec);

      let dTheta;
      if (y) {
        dTheta = [];
        for (let i = 0; i < n; i++) {
          const v = J[i];
          dTheta.push(v[0] * y[0] + v[1] * y[1] + v[2] * y[2]);
        }
      } else {
        const fallbackScale = 0.08 / (1 + iter * 0.05);
        dTheta = [];
        for (let i = 0; i < n; i++) {
          const v = J[i];
          dTheta.push((v[0] * ex + v[1] * ey + v[2] * ez) * fallbackScale);
        }
      }

      for (let i = 0; i < n; i++) {
        const key = activeJoints[i];
        let dAngle = dTheta[i];
        if (!Number.isFinite(dAngle)) dAngle = 0;
        if (Math.abs(dAngle) > maxJointStepDeg) {
          dAngle = Math.sign(dAngle) * maxJointStepDeg;
        }
        const [minLim, maxLim] = this.limits[key];
        const nearMin = angles[key] <= minLim + limitGuardDeg;
        const nearMax = angles[key] >= maxLim - limitGuardDeg;
        if ((nearMin && dAngle < 0) || (nearMax && dAngle > 0)) {
          dAngle = 0;
        }
        angles[key] = clampAngle(key, angles[key] + dAngle);
      }

      if (hasFixedJ1) angles.j1 = fixedJ1;
      if (hasFixedJ4) angles.j4 = fixedJ4;
      if (hasFixedJ6) angles.j6 = fixedJ6;

      if (hasFixedJ5) {
        angles.j5 = fixedJ5;
      } else if (hasFixedJ5WorldPitch) {
        angles.j5 = clampAngle('j5', -fixedJ5WorldPitchDeg - (angles.j2 + angles.j3));
      } else {
        const desiredJ5 = clampAngle('j5', -(angles.j2 + angles.j3));
        const wristError = desiredJ5 - angles.j5;
        angles.j5 = clampAngle('j5', angles.j5 + wristError * wristFollowGain);
      }
    }

    const finalFK = this.computeFK(angles);
    const finalError = distance3D(target, finalFK.position);

    return {
      success: finalError < tolerance * 5,
      angles: this._clampAll(angles),
      error: finalError,
      iterations: maxIterations,
      message: finalError < tolerance * 5
        ? t('ik.approxSolution', { err: finalError.toFixed(2) })
        : t('ik.unreachable', { err: finalError.toFixed(2) })
    };
  }

  /**
   * Hedefin workspace içinde olup olmadığını hızlıca kontrol et
   */
  isReachable(target) {
    const maxReach = this.linkLengths.base_height +
      this.linkLengths.upper_arm +
      this.linkLengths.forearm;
    const dist = Math.sqrt(target.x * target.x + target.y * target.y + target.z * target.z);
    return dist <= maxReach * 1.1; // %10 tolerans
  }

  /**
   * TCP (FK matrisi) rotasyonunu dünya eksenleriyle hizalı tutmak için maliyet.
   * Satır-düzenli R'de sütunlar = araç X/Y/Z dünyadaki yönü; ± eksenlere paralellik.
   */
  _tcpMatrixWorldAxesCost(M) {
    const m0 = M[0], m1 = M[1], m2 = M[2];
    const m4 = M[4], m5 = M[5], m6 = M[6];
    const m8 = M[8], m9 = M[9], m10 = M[10];
    const colX = m4 * m4 + m8 * m8 + (Math.abs(m0) - 1) * (Math.abs(m0) - 1);
    const colY = m1 * m1 + m9 * m9 + (Math.abs(m5) - 1) * (Math.abs(m5) - 1);
    const colZ = m2 * m2 + m6 * m6 + (Math.abs(m10) - 1) * (Math.abs(m10) - 1);
    return colX + colY + colZ;
  }

  /**
   * j6 (flanş Y roll) araç Y ≈ dünya Y iken X/Z düzleminde «gövde» hatasını döndürür;
   * dar aralıkta ince tarama ile yerel minimumdan çıkmak için kullanılır.
   */
  _refineSweepJ6ForWorldAxes(baseAngles, targetPos, opts = {}) {
    const posHold = opts.refinePositionHoldMm ?? 1.05;
    const coarse = opts.refineJ6SweepStepDeg ?? 2.5;
    const fineSpan = opts.refineJ6FineSpanDeg ?? 14;
    const fineStep = opts.refineJ6FineStepDeg ?? 0.45;

    const a0 = this._applyTcpDragLocks(baseAngles, opts);
    if (Number.isFinite(opts.fixedJ6)) return a0;
    let best = a0;
    let bestC = Infinity;
    let found = false;

    const score = (trial) => {
      const t = this._applyTcpDragLocks(trial, opts);
      const fk = this.computeFK(t);
      if (distance3D(targetPos, fk.position) > posHold) return null;
      const c = this._tcpMatrixWorldAxesCost(fk.matrix);
      return { t, c };
    };

    const consider = (trial) => {
      const r = score(trial);
      if (!r) return;
      found = true;
      if (r.c < bestC) {
        bestC = r.c;
        best = r.t;
      }
    };

    const baseJ6 = a0.j6 || 0;
    for (let d = -180; d <= 180 + 1e-6; d += coarse) {
      consider({ ...a0, j6: clampAngle('j6', baseJ6 + d) });
    }

    const center = best.j6 || 0;
    for (let d = -fineSpan; d <= fineSpan + 1e-6; d += fineStep) {
      consider({ ...a0, j6: clampAngle('j6', center + d) });
    }

    return found ? best : a0;
  }

  /** solveIK / sürükleme ile aynı J1/J4/J5/J6 kilitlerini uygula */
  _applyTcpDragLocks(angles, opts = {}) {
    const a = { ...angles };
    if (Number.isFinite(opts.fixedJ1)) a.j1 = clampAngle('j1', opts.fixedJ1);
    if (Number.isFinite(opts.fixedJ4)) a.j4 = clampAngle('j4', opts.fixedJ4);
    if (Number.isFinite(opts.fixedJ6)) a.j6 = clampAngle('j6', opts.fixedJ6);
    if (Number.isFinite(opts.fixedJ5)) {
      a.j5 = clampAngle('j5', opts.fixedJ5);
    } else if (Number.isFinite(opts.fixedJ5WorldPitchDeg)) {
      a.j5 = clampAngle('j5', -opts.fixedJ5WorldPitchDeg - (a.j2 + a.j3));
    }
    return this._clampAll(a);
  }

  /**
   * Pozisyonu hedefe yakın tutarak TCP eksenlerini dünya X/Y/Z ile mümkün olduğunca paralel yapar.
   * Dünya pitch kilidi + TCP ofseti j6'yı efektif olarak «araç Y» etrafında döndürür; X/Z için j6 geniş tarama + tırmanış.
   */
  refineTcpParallelWorldAxes(startAngles, targetPos, opts = {}) {
    const maxIter = opts.refineMaxIter ?? 56;
    let stepDeg = opts.refineStepDeg ?? 0.38;
    const posHoldMm = opts.refinePositionHoldMm ?? 1.05;
    const costTol = opts.refineCostTol ?? 0.009;

    let a = this._applyTcpDragLocks(startAngles, opts);
    a = this._refineSweepJ6ForWorldAxes(a, targetPos, opts);
    let lastGood = a;
    const fk0 = this.computeFK(a);
    if (distance3D(targetPos, fk0.position) > posHoldMm + 0.35) {
      return a;
    }

    const hasFixedJ1 = Number.isFinite(opts.fixedJ1);
    const hasFixedJ4 = Number.isFinite(opts.fixedJ4);
    const hasFixedJ6 = Number.isFinite(opts.fixedJ6);
    const jointOrder = ['j6', 'j4', 'j3', 'j2', 'j1'].filter((k) => {
      if (k === 'j1' && hasFixedJ1) return false;
      if (k === 'j4' && hasFixedJ4) return false;
      if (k === 'j6' && hasFixedJ6) return false;
      return true;
    });

    for (let iter = 0; iter < maxIter; iter++) {
      a = this._applyTcpDragLocks(a, opts);
      const fk = this.computeFK(a);
      const pe = distance3D(targetPos, fk.position);
      if (pe > posHoldMm) {
        return lastGood;
      }
      lastGood = a;

      const c = this._tcpMatrixWorldAxesCost(fk.matrix);
      if (c < costTol) {
        return a;
      }

      let bestA = null;
      let bestC = c;
      for (const key of jointOrder) {
        for (const sgn of [-1, 1]) {
          const trial = this._applyTcpDragLocks(
            { ...a, [key]: clampAngle(key, (a[key] || 0) + sgn * stepDeg) },
            opts
          );
          const fk2 = this.computeFK(trial);
          if (distance3D(targetPos, fk2.position) > posHoldMm) continue;
          const c2 = this._tcpMatrixWorldAxesCost(fk2.matrix);
          if (c2 < bestC - 1e-7) {
            bestC = c2;
            bestA = trial;
          }
        }
      }

      if (bestA) {
        a = bestA;
      } else {
        stepDeg *= 0.74;
        if (stepDeg < 0.055) break;
      }
    }

    a = this._refineSweepJ6ForWorldAxes(lastGood, targetPos, opts);
    return this._applyTcpDragLocks(a, opts);
  }

  /**
   * Tüm açıları clamp et (internal)
   */
  _clampAll(angles) {
    const result = {};
    for (const key of ROBOT_CONFIG.jointKeys) {
      result[key] = clampAngle(key, angles[key] || 0);
    }
    return result;
  }
}
