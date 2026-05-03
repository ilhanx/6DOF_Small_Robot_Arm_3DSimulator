/**
 * trajectory.js — Yörünge Planlama
 * Joint interpolation ve Linear (Cartesian) interpolation
 * Trapez hız profili: kalkış → hareket → duruş
 */
import { ROBOT_CONFIG, clampAngle } from './config.js';
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

  moveLinear(startAngles, targetPosition, options = {}) {
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

    // Sınır şablonu gibi kenar-izleme hareketlerinde ekseni sabitle.
    if (hasCartesianLock) {
      startPos[cartesianLockAxis] = cartesianLockValue;
      targetPos[cartesianLockAxis] = cartesianLockValue;
    }
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const maxSpeed = 200;
    const speed = (moveSpeed / 100) * maxSpeed;
    const duration = dist / Math.max(speed, 1);
    const accelRatio = (100 - accelSpeed) / 200 + 0.05;
    const decelRatio = (100 - decelSpeed) / 200 + 0.05;
    const steps = Math.max(Math.ceil(duration * 60), 10);
    const linearSmoothFactor = options.linearSmoothFactor ?? 0.35;
    const linearMaxJointStep = options.linearMaxJointStep ?? 2.2;
    let currentAngles = { ...startAngles };
    let stepIndex = 0;
    const precomputedAngles = [];
    let failedSolveCount = 0;

    // Oynatım sırasında her frame IK çözmek yerine, yolu bir kez ön-hesapla.
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
      if (!solved.success && ikOptions.fixedJ5WorldPitchDeg !== undefined) {
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
      } else {
        failedSolveCount++;
      }

      precomputedAngles.push({ ...currentAngles });
    }

    this.isPlaying = true;
    this.isPaused = false;

    const animate = () => {
      if (!this.isPlaying) return;
      if (this.isPaused) { this._animFrame = requestAnimationFrame(animate); return; }
      stepIndex++;
      const t = Math.min(stepIndex / steps, 1);
      const idx = Math.min(stepIndex - 1, precomputedAngles.length - 1);
      const frameAngles = precomputedAngles[idx] || currentAngles;
      currentAngles = frameAngles;
      this._lastAngles = { ...currentAngles };
      if (this.onUpdate) this.onUpdate(currentAngles, t);

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
