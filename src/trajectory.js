/**
 * trajectory.js — Yörünge Planlama
 * Joint interpolation ve Linear (Cartesian) interpolation
 * Trapez hız profili: kalkış → hareket → duruş
 */
import { ROBOT_CONFIG, clampAngle, clampAllAngles } from './config.js';
import { lerp, trapezoidalProfile } from './utils.js';

export class TrajectoryPlanner {
  constructor(kinematics) {
    this.kinematics = kinematics;
    this.isPlaying = false;
    this.isPaused = false;
    this.onUpdate = null;
    this.onComplete = null;
    this.onError = null;
    this._animFrame = null;
    this._startTime = 0;
    this._lastAngles = null;
  }

  moveJoint(startAngles, endAngles, options = {}) {
    const moveSpeed = options.moveSpeed ?? ROBOT_CONFIG.speed.defaultMove;
    const accelSpeed = options.accelSpeed ?? ROBOT_CONFIG.speed.defaultAccel;
    const decelSpeed = options.decelSpeed ?? ROBOT_CONFIG.speed.defaultDecel;
    const duration = options.duration || this._speedToDuration(moveSpeed, startAngles, endAngles);
    const accelRatio = (100 - accelSpeed) / 200 + 0.05;
    const decelRatio = (100 - decelSpeed) / 200 + 0.05;
    this._startAnimation(startAngles, endAngles, duration, accelRatio, decelRatio);
  }

  /**
   * TCP düz hattı — oynatıcı ile aynı ara-IK zinciri; animasyon yok.
   * Senaryo çıktısı ve COM önizlemesi bu uç açıları kullanmalı (tek nokta IK sapmasını önler).
   */
  computeLinearEndAngles(startAngles, targetPosition, options = {}) {
    const { frames } = this._precomputeLinearMotion(startAngles, targetPosition, options);
    if (!frames.length) return clampAllAngles({ ...startAngles });
    return clampAllAngles({ ...frames[frames.length - 1] });
  }

  /** TCP düz hattı için ara eklem kareleri (COM eşzamanlı çoklu simcom zinciri). */
  getLinearMotionFrames(startAngles, targetPosition, options = {}) {
    const { frames } = this._precomputeLinearMotion(startAngles, targetPosition, options);
    return frames.map((a) => clampAllAngles({ ...a }));
  }

  /**
   * @returns {{ frames: object[], failedSolveCount: number }}
   */
  _precomputeLinearMotion(startAngles, targetPosition, options = {}) {
    const moveSpeed = options.moveSpeed ?? ROBOT_CONFIG.speed.defaultMove;
    const accelSpeed = options.accelSpeed ?? ROBOT_CONFIG.speed.defaultAccel;
    const decelSpeed = options.decelSpeed ?? ROBOT_CONFIG.speed.defaultDecel;
    const ikOptions = options.ikOptions || {};
    const cartesianLockAxis = options.cartesianLockAxis;
    const hasCartesianLock = (cartesianLockAxis === 'x' || cartesianLockAxis === 'y' || cartesianLockAxis === 'z')
      && Number.isFinite(options.cartesianLockValue);
    const cartesianLockValue = hasCartesianLock ? options.cartesianLockValue : null;
    const startFK = this.kinematics.computeFK(startAngles);
    const startPos = { ...startFK.position };
    const targetPos = { ...targetPosition };

    if (hasCartesianLock) {
      startPos[cartesianLockAxis] = cartesianLockValue;
      targetPos[cartesianLockAxis] = cartesianLockValue;
    }
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-5) {
      return { frames: [], failedSolveCount: 0 };
    }

    const maxSpeed = 200;
    const speed = (moveSpeed / 100) * maxSpeed;
    const baseDuration = dist / Math.max(speed, 1);
    const minSeg = Number.isFinite(options.linearMinDurationSec) ? options.linearMinDurationSec : 0;
    const duration = Math.max(baseDuration, minSeg);
    const accelRatio = (100 - accelSpeed) / 200 + 0.05;
    const decelRatio = (100 - decelSpeed) / 200 + 0.05;
    const steps = Math.max(Math.ceil(duration * 60), 10);
    const linearSmoothFactor = options.linearSmoothFactor ?? 0.35;
    const linearMaxJointStep = options.linearMaxJointStep ?? 2.2;
    let currentAngles = { ...startAngles };
    const precomputedAngles = [];
    let failedSolveCount = 0;

    for (let i = 1; i <= steps; i++) {
      const t = Math.min(i / steps, 1);
      const s = trapezoidalProfile(t, accelRatio, decelRatio);
      const interpPos = {
        x: lerp(startPos.x, targetPos.x, s),
        y: lerp(startPos.y, targetPos.y, s),
        z: lerp(startPos.z, targetPos.z, s),
      };

      const ik = this.kinematics.solveIK(interpPos, currentAngles, ikOptions);
      let solved = ik;
      const worldPitchLocked = Number.isFinite(ikOptions.fixedJ5WorldPitchDeg);
      if (!solved.success && !worldPitchLocked) {
        const relaxed = { ...ikOptions };
        delete relaxed.fixedJ5WorldPitchDeg;
        solved = this.kinematics.solveIK(interpPos, currentAngles, relaxed);
      }

      if (solved.success) {
        const filteredAngles = { ...currentAngles };
        for (const key of ROBOT_CONFIG.jointKeys) {
          const desired = clampAngle(key, solved.angles[key]);
          let deltaA = desired - filteredAngles[key];
          if (Math.abs(deltaA) > linearMaxJointStep) {
            deltaA = Math.sign(deltaA) * linearMaxJointStep;
          }
          filteredAngles[key] = clampAngle(key, filteredAngles[key] + deltaA * linearSmoothFactor);
        }
        currentAngles = filteredAngles;
        if (worldPitchLocked) {
          const fp = ikOptions.fixedJ5WorldPitchDeg;
          currentAngles.j5 = clampAngle('j5', -fp - (currentAngles.j2 + currentAngles.j3));
        }
        if (Number.isFinite(ikOptions.fixedJ6)) {
          currentAngles.j6 = clampAngle('j6', ikOptions.fixedJ6);
        }
      } else {
        failedSolveCount++;
      }

      precomputedAngles.push({ ...currentAngles });
    }

    // Yumuşatma nedeniyle son karede TCP hedeften sapabiliyor; sonraki segment birikim hatası yapıyor.
    const snapOpts = { ...ikOptions, maxIterations: 260, tolerance: 0.45 };
    let snap = this.kinematics.solveIK(targetPos, currentAngles, snapOpts);
    if (!snap.success && !Number.isFinite(ikOptions.fixedJ5WorldPitchDeg)) {
      const relaxed = { ...snapOpts };
      delete relaxed.fixedJ5WorldPitchDeg;
      snap = this.kinematics.solveIK(targetPos, currentAngles, relaxed);
    }
    if (snap.success) {
      currentAngles = clampAllAngles({ ...snap.angles });
      if (precomputedAngles.length) {
        precomputedAngles[precomputedAngles.length - 1] = { ...currentAngles };
      }
    }

    return { frames: precomputedAngles, failedSolveCount };
  }

  moveLinear(startAngles, targetPosition, options = {}) {
    this.stop();
    const { frames, failedSolveCount } = this._precomputeLinearMotion(startAngles, targetPosition, options);
    if (!frames.length) {
      this._lastAngles = clampAllAngles({ ...startAngles });
      if (this.onComplete) this.onComplete();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;

    const numFrames = frames.length;
    let stepIndex = 0;

    const animate = () => {
      if (!this.isPlaying) return;
      if (this.isPaused) { this._animFrame = requestAnimationFrame(animate); return; }
      stepIndex++;
      const t = Math.min(stepIndex / numFrames, 1);
      const idx = Math.min(stepIndex - 1, numFrames - 1);
      const frameAngles = frames[idx];
      this._lastAngles = { ...frameAngles };
      if (this.onUpdate) this.onUpdate(frameAngles, t);

      if (t >= 1) { this.isPlaying = false; if (this.onComplete) this.onComplete(); return; }
      this._animFrame = requestAnimationFrame(animate);
    };

    if (failedSolveCount > 0 && this.onError) {
      this.onError(`Lineer IK: ${failedSolveCount} ara noktada yaklaşık çözüm kullanıldı`);
    }
    this._animFrame = requestAnimationFrame(animate);
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }
  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }
  }

  _startAnimation(startAngles, endAngles, duration, accelRatio, decelRatio) {
    this.stop();
    this.isPlaying = true;
    this.isPaused = false;
    this._startTime = performance.now();
    const durationMs = duration * 1000;

    const animate = (timestamp) => {
      if (!this.isPlaying) return;
      if (this.isPaused) { this._animFrame = requestAnimationFrame(animate); return; }
      const elapsed = timestamp - this._startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const s = trapezoidalProfile(t, accelRatio, decelRatio);
      const angles = {};
      for (const key of ROBOT_CONFIG.jointKeys) {
        const start = startAngles[key] || 0;
        const end = endAngles[key] || 0;
        angles[key] = clampAngle(key, lerp(start, end, s));
      }
      this._lastAngles = { ...angles };
      if (this.onUpdate) this.onUpdate(angles, t);
      if (t >= 1) { this.isPlaying = false; if (this.onComplete) this.onComplete(); return; }
      this._animFrame = requestAnimationFrame(animate);
    };
    this._animFrame = requestAnimationFrame(animate);
  }

  _speedToDuration(speed, startAngles, endAngles) {
    let maxDiff = 0;
    for (const key of ROBOT_CONFIG.jointKeys) {
      const diff = Math.abs((endAngles[key] || 0) - (startAngles[key] || 0));
      if (diff > maxDiff) maxDiff = diff;
    }
    const baseTime = 0.3 + (maxDiff / 360) * 4;
    const factor = 1 + (100 - speed) / 15;
    return baseTime * factor;
  }

  getLastAngles() {
    return this._lastAngles ? { ...this._lastAngles } : null;
  }
}
