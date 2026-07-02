/**
 * scenario.js — Senaryo Yönetimi
 * Hareket dizisi oluşturma, JSON kaydetme/yükleme, oynatma
 */
import { ROBOT_CONFIG } from './config.js';

export class ScenarioManager {
  constructor(trajectoryPlanner) {
    this.planner = trajectoryPlanner;
    this.steps = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.onStepChange = null;   // callback(index, step)
    this.onPlayComplete = null; // callback()
    /** Adım animasyonu başlamadan önce (Simultane COM): (stepIndex, step, startAngles) => void | Promise */
    this.onBeforeStepPlay = null;
    this._savedPlannerOnComplete = null;
  }

  addStep(step) {
    const s = {
      type: step.type || 'joint',
      target: { ...step.target },
      moveSpeed: step.moveSpeed ?? ROBOT_CONFIG.speed.defaultMove,
      accelSpeed: step.accelSpeed ?? ROBOT_CONFIG.speed.defaultAccel,
      decelSpeed: step.decelSpeed ?? ROBOT_CONFIG.speed.defaultDecel,
      ikOptions: step.ikOptions ? { ...step.ikOptions } : undefined,
      cartesianLockAxis: step.cartesianLockAxis || undefined,
      cartesianLockValue: Number.isFinite(step.cartesianLockValue) ? step.cartesianLockValue : undefined,
      label: step.label || 'Step ' + (this.steps.length + 1),
    };
    if (Number.isFinite(step.linearSmoothFactor)) s.linearSmoothFactor = step.linearSmoothFactor;
    if (Number.isFinite(step.linearMaxJointStep)) s.linearMaxJointStep = step.linearMaxJointStep;
    if (Number.isFinite(step.linearMinDurationSec)) s.linearMinDurationSec = step.linearMinDurationSec;
    this.steps.push(s);
    return this.steps.length - 1;
  }

  removeStep(index) {
    if (index >= 0 && index < this.steps.length) {
      this.steps.splice(index, 1);
    }
  }

  clearSteps() { this.steps = []; this.currentIndex = -1; }

  exportJSON() {
    return JSON.stringify({
      name: 'Robot Senaryosu',
      created: new Date().toISOString(),
      steps: this.steps
    }, null, 2);
  }

  /**
   * İçe aktarılan adımı addStep ile uyumlu hale getirir (eksik type → joint).
   */
  _normalizeImportedStep(step, index) {
    const raw = step && typeof step === 'object' ? step : {};
    const type = raw.type === 'linear' ? 'linear' : 'joint';
    const out = {
      type,
      target: { ...(raw.target || {}) },
      moveSpeed: raw.moveSpeed ?? ROBOT_CONFIG.speed.defaultMove,
      accelSpeed: raw.accelSpeed ?? ROBOT_CONFIG.speed.defaultAccel,
      decelSpeed: raw.decelSpeed ?? ROBOT_CONFIG.speed.defaultDecel,
      ikOptions: raw.ikOptions ? { ...raw.ikOptions } : undefined,
      cartesianLockAxis: raw.cartesianLockAxis || undefined,
      cartesianLockValue: Number.isFinite(raw.cartesianLockValue) ? raw.cartesianLockValue : undefined,
      label: raw.label || `Step ${index + 1}`
    };
    if (Number.isFinite(raw.linearSmoothFactor)) out.linearSmoothFactor = raw.linearSmoothFactor;
    if (Number.isFinite(raw.linearMaxJointStep)) out.linearMaxJointStep = raw.linearMaxJointStep;
    if (Number.isFinite(raw.linearMinDurationSec)) out.linearMinDurationSec = raw.linearMinDurationSec;
    return out;
  }

  /**
   * JSON string veya BOM içeren metin. steps / Steps / scenario.steps veya kök dizi kabul edilir.
   */
  importJSON(jsonString) {
    try {
      const trimmed =
        typeof jsonString === 'string'
          ? jsonString.replace(/^\uFEFF/, '').trim()
          : '';
      if (!trimmed) return false;

      const data = JSON.parse(trimmed);
      let steps = null;

      if (Array.isArray(data)) {
        steps = data;
      } else if (data && typeof data === 'object') {
        steps =
          data.steps ??
          data.Steps ??
          data.STEPS ??
          (data.scenario && Array.isArray(data.scenario.steps) ? data.scenario.steps : null);
      }

      if (!Array.isArray(steps)) return false;

      this.steps = steps.map((s, i) => this._normalizeImportedStep(s, i));
      this.currentIndex = -1;
      return true;
    } catch {
      return false;
    }
  }

  play(currentAngles) {
    if (this.steps.length === 0) return;
    this.isPlaying = true;
    this.currentIndex = 0;
    this._savedPlannerOnComplete = this.planner.onComplete || null;
    void this._playStep(currentAngles);
  }

  stop() {
    this.isPlaying = false;
    this.planner.stop();
    this.currentIndex = -1;
    this.onBeforeStepPlay = null;
    if (this._savedPlannerOnComplete) {
      this.planner.onComplete = this._savedPlannerOnComplete;
      this._savedPlannerOnComplete = null;
    }
  }

  pause() { this.planner.pause(); }
  resume() { this.planner.resume(); }

  async _playStep(currentAngles) {
    if (!this.isPlaying || this.currentIndex >= this.steps.length) {
      this.isPlaying = false;
      if (this._savedPlannerOnComplete) {
        this.planner.onComplete = this._savedPlannerOnComplete;
        this._savedPlannerOnComplete = null;
      }
      if (this.onPlayComplete) this.onPlayComplete();
      return;
    }
    const step = this.steps[this.currentIndex];
    if (this.onStepChange) this.onStepChange(this.currentIndex, step);

    if (typeof this.onBeforeStepPlay === 'function') {
      try {
        await Promise.resolve(this.onBeforeStepPlay(this.currentIndex, step, currentAngles));
      } catch {
        /* COM vb. hata — simülasyon adımı yine de oynatılsın */
      }
    }

    if (!this.isPlaying || this.currentIndex >= this.steps.length) {
      return;
    }

    const opts = {
      moveSpeed: step.moveSpeed,
      accelSpeed: step.accelSpeed,
      decelSpeed: step.decelSpeed,
      ikOptions: step.ikOptions,
      cartesianLockAxis: step.cartesianLockAxis,
      cartesianLockValue: step.cartesianLockValue,
    };
    if (Number.isFinite(step.linearSmoothFactor)) opts.linearSmoothFactor = step.linearSmoothFactor;
    if (Number.isFinite(step.linearMaxJointStep)) opts.linearMaxJointStep = step.linearMaxJointStep;
    if (Number.isFinite(step.linearMinDurationSec)) opts.linearMinDurationSec = step.linearMinDurationSec;

    this.planner.onComplete = () => {
      const stepDone = this.steps[this.currentIndex];
      const plannedLast = this.planner.getLastAngles?.();
      let nextAngles = plannedLast;
      if (!nextAngles) {
        if (stepDone.type === 'joint') {
          nextAngles = stepDone.target;
        } else {
          nextAngles = this.planner.computeLinearEndAngles(currentAngles, stepDone.target, {
            moveSpeed: stepDone.moveSpeed,
            accelSpeed: stepDone.accelSpeed,
            decelSpeed: stepDone.decelSpeed,
            ikOptions: stepDone.ikOptions,
            cartesianLockAxis: stepDone.cartesianLockAxis,
            cartesianLockValue: stepDone.cartesianLockValue,
            linearSmoothFactor: stepDone.linearSmoothFactor,
            linearMaxJointStep: stepDone.linearMaxJointStep,
            linearMinDurationSec: stepDone.linearMinDurationSec,
          });
        }
      }
      this.currentIndex++;
      void this._playStep(nextAngles);
    };

    if (step.type === 'joint') {
      this.planner.moveJoint(currentAngles, step.target, opts);
    } else {
      this.planner.moveLinear(currentAngles, step.target, opts);
    }
  }

  getOutputData(currentAngles, currentStepIndex = -1) {
    const step = currentStepIndex >= 0 && currentStepIndex < this.steps.length
      ? this.steps[currentStepIndex]
      : null;
    return {
      angles: ROBOT_CONFIG.jointKeys.map(k => +(currentAngles[k] || 0).toFixed(2)),
      accelSpeed: step ? step.accelSpeed : ROBOT_CONFIG.speed.defaultAccel,
      moveSpeed: step ? step.moveSpeed : ROBOT_CONFIG.speed.defaultMove,
      decelSpeed: step ? step.decelSpeed : ROBOT_CONFIG.speed.defaultDecel,
      stepIndex: currentStepIndex,
      totalSteps: this.steps.length,
    };
  }
}
