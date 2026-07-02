/**
 * tracking.js — Hedef Takibi (Closed-loop)
 * Position tracking, full pose tracking, look-at mode
 * Stabilite: low-pass filtre, dead zone, hız sınırlama
 */
import { ROBOT_CONFIG, clampAngle } from './config.js';

export class TargetTracker {
  constructor(kinematics) {
    this.kinematics = kinematics;
    this.enabled = false;
    this.mode = 'position'; // 'position' | 'fullpose' | 'lookat'
    this.target = { x: 0, y: 200, z: 0 };
    this.lastAngles = null;
    this.smoothFactor = 0.15; // Low-pass filtre (0-1, düşük = daha yumuşak)
    this.deadZone = 0.5;     // mm — bu mesafe altında hareket etme
    this.maxAngularSpeed = 5; // derece/frame — ani sıçrama önleme
    this.j4TargetAngle = 0;  // Auto IK sırasında sabitlenecek J4 hedef açısı
    this.j5TargetAngle = -90;  // Auto IK sırasında yere göre J5 hedef açısı (UI varsayılanı ile uyumlu)
  }

  setMode(mode) { this.mode = mode; }
  setTarget(target) { this.target = { ...target }; }
  setJ4TargetAngle(angle) { this.j4TargetAngle = Number.isFinite(angle) ? angle : 0; }
  setJ5TargetAngle(angle) { this.j5TargetAngle = Number.isFinite(angle) ? angle : 0; }
  enable() { this.enabled = true; }
  disable() { this.enabled = false; this.lastAngles = null; }
  toggle() { this.enabled ? this.disable() : this.enable(); }

  update(currentAngles) {
    if (!this.enabled) return currentAngles;

    const fk = this.kinematics.computeFK(currentAngles);
    const current = fk.position;
    const dx = this.target.x - current.x;
    const dy = this.target.y - current.y;
    const dz = this.target.z - current.z;
    const error = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Dead zone — çok küçük hatalar için hareket etme
    if (error < this.deadZone) return currentAngles;

    // IK çöz (FK artık TCP ucunu verdiği için doğrudan hedef kullanılır)
    const ik = this.kinematics.solveIK(this.target, currentAngles, {
      maxIterations: 85,
      tolerance: 0.85,
      damping: 2.8,
      maxJointStepDeg: 4,
      fixedJ4: this.j4TargetAngle,
      fixedJ5WorldPitchDeg: this.j5TargetAngle,
      includeJ4J6InIkJacobian: true,
    });

    if (!ik.success && ik.error > 50) return currentAngles;

    let targetAngles = ik.angles;

    // Hız sınırlama — ani sıçrama önleme
    const smoothed = {};
    for (const key of ROBOT_CONFIG.jointKeys) {
      let diff = targetAngles[key] - currentAngles[key];
      // Maksimum açısal hız sınırla
      if (Math.abs(diff) > this.maxAngularSpeed) {
        diff = Math.sign(diff) * this.maxAngularSpeed;
      }
      // Low-pass filtre
      const newAngle = currentAngles[key] + diff * this.smoothFactor;
      smoothed[key] = clampAngle(key, newAngle);
    }

    this.lastAngles = smoothed;
    return smoothed;
  }
}
