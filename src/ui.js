/**
 * ui.js — UI Yönetimi
 * Slider, input, panel senkronizasyonu
 * Joint kontrollerini config'den dinamik oluşturur
 */
import { ROBOT_CONFIG, clampAngle } from './config.js';
import { roundTo } from './utils.js';
import { t } from './i18n.js';

export class UIManager {
  constructor() {
    this.sliders = {};
    this.inputs = {};
    this.valueDisplays = {};
    this.jointControls = {};
    this.onAngleChange = null;
    this._buildJointControls();
    this._bindSpeedControls();
  }

  _buildJointControls() {
    const container = document.getElementById('joint-controls');
    if (!container) return;
    container.innerHTML = '';

    ROBOT_CONFIG.jointKeys.forEach((key, i) => {
      const [min, max] = ROBOT_CONFIG.limits[key];
      const name = ROBOT_CONFIG.jointNames[i];
      const color = ROBOT_CONFIG.jointColors[i];

      const div = document.createElement('div');
      div.className = 'joint-control';
      div.id = `jc-${key}`;
      div.innerHTML = `
        <div class="joint-label-row">
          <label style="color:${color}">${name}</label>
          <span class="joint-value" id="jv-${key}" style="color:${color}">0.00°</span>
        </div>
        <div class="joint-slider-row">
          <input type="range" min="${min}" max="${max}" value="0" step="0.01" class="slider" id="js-${key}">
          <input type="number" class="joint-input" id="ji-${key}" value="0" step="0.1" min="${min}" max="${max}">
        </div>
        <div class="range-labels"><span>${min}°</span><span>${max}°</span></div>
      `;
      container.appendChild(div);

      this.sliders[key] = document.getElementById(`js-${key}`);
      this.inputs[key] = document.getElementById(`ji-${key}`);
      this.valueDisplays[key] = document.getElementById(`jv-${key}`);
      this.jointControls[key] = div;

      // Slider event
      this.sliders[key].addEventListener('input', (e) => {
        const val = clampAngle(key, parseFloat(e.target.value));
        this.inputs[key].value = roundTo(val, 2);
        this.valueDisplays[key].textContent = `${roundTo(val, 2)}°`;
        this._checkLimitWarning(key, val);
        if (this.onAngleChange) this.onAngleChange(key, val);
      });

      // Numeric input event
      this.inputs[key].addEventListener('change', (e) => {
        const val = clampAngle(key, parseFloat(e.target.value) || 0);
        e.target.value = roundTo(val, 2);
        this.sliders[key].value = val;
        this.valueDisplays[key].textContent = `${roundTo(val, 2)}°`;
        this._checkLimitWarning(key, val);
        if (this.onAngleChange) this.onAngleChange(key, val);
      });
    });
    this.refreshJointLabels();
  }

  refreshJointLabels() {
    for (const key of ROBOT_CONFIG.jointKeys) {
      const div = this.jointControls[key];
      const label = div?.querySelector('.joint-label-row label');
      if (label) label.textContent = t(`joint.${key}`);
    }
  }

  _bindSpeedControls() {
    ['accel', 'move', 'decel'].forEach(type => {
      const slider = document.getElementById(`speed-${type}`);
      const valEl = document.getElementById(`speed-${type}-val`);
      if (slider && valEl) {
        slider.addEventListener('input', () => { valEl.textContent = slider.value; });
      }
    });
  }

  updateAngles(angles, options = {}) {
    const skipSliders = options.skipSliders === true;
    for (const key of ROBOT_CONFIG.jointKeys) {
      const val = roundTo(angles[key] || 0, 2);
      if (!skipSliders && this.sliders[key]) this.sliders[key].value = val;
      if (this.inputs[key]) this.inputs[key].value = val;
      if (this.valueDisplays[key]) this.valueDisplays[key].textContent = `${val}°`;
      this._checkLimitWarning(key, val);
    }
  }

  updatePosition(pos, orient) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = roundTo(v, 2); };
    set('pos-x', pos.x); set('pos-y', pos.y); set('pos-z', pos.z);
    if (orient) { set('pos-rx', orient.rx); set('pos-ry', orient.ry); set('pos-rz', orient.rz); }
  }

  updateOutput(data) {
    const el = document.getElementById('output-display');
    if (!el) return;
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    if (el.tagName === 'TEXTAREA') el.value = text;
    else el.textContent = text;
  }

  updateStatus(mode) {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    if (!text) return;
    const label =
      mode === 'AUTO' ? t('status.auto') :
      mode === 'TRACKING' ? t('status.tracking') :
      t('status.manual');
    text.textContent = label;
    if (dot) {
      dot.style.background = mode === 'AUTO' ? 'var(--accent-green)' :
        mode === 'TRACKING' ? 'var(--accent-cyan)' : 'var(--accent-orange)';
    }
  }

  updateFPS(fps) {
    const el = document.getElementById('fps-display');
    if (el) {
      el.textContent = `${fps} FPS`;
      el.style.color = fps >= 50 ? 'var(--accent-green)' : fps >= 30 ? 'var(--accent-orange)' : 'var(--accent-red)';
    }
  }

  showIKStatus(message, type = 'info') {
    const el = document.getElementById('ik-status');
    if (!el) return;
    el.textContent = message;
    el.className = 'ik-status ' + type;
    el.style.display = 'block';
    clearTimeout(this._ikTimeout);
    this._ikTimeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  getSpeedSettings() {
    return {
      accelSpeed: parseInt(document.getElementById('speed-accel')?.value || '20'),
      moveSpeed: parseInt(document.getElementById('speed-move')?.value || '60'),
      decelSpeed: parseInt(document.getElementById('speed-decel')?.value || '20'),
    };
  }

  getTargetTCP() {
    return {
      x: parseFloat(document.getElementById('tcp-x')?.value || '0'),
      y: parseFloat(document.getElementById('tcp-y')?.value || '200'),
      z: parseFloat(document.getElementById('tcp-z')?.value || '0'),
    };
  }

  getJ5LockAxis() {
    const selected = document.querySelector('input[name="j5-lock-axis"]:checked');
    const axis = selected?.value || 'x';
    return axis === 'x' || axis === 'y' || axis === 'z' ? axis : 'x';
  }

  /** Yeşil TCP sürüklerken J1 sabitlensin mi (varsayılan: true / kilitli) */
  getTcpDragLockJ1() {
    const el = document.querySelector('input[name="tcp-drag-j1-lock"]:checked');
    return (el?.value || 'lock') !== 'free';
  }

  getJ4TargetAngle() {
    const raw = parseFloat(document.getElementById('j4-target-angle')?.value || '0');
    return Number.isFinite(raw) ? raw : 0;
  }

  getJ5TargetAngle() {
    const raw = parseFloat(document.getElementById('j5-target-angle')?.value || '0');
    return Number.isFinite(raw) ? raw : 0;
  }

  getTemplateSettings() {
    const sizeXRaw = parseFloat(document.getElementById('template-size-x')?.value || '100');
    const sizeZRaw = parseFloat(document.getElementById('template-size-z')?.value || '100');
    const stepsRaw = parseInt(document.getElementById('template-steps')?.value || '10', 10);
    const planeRaw = (document.getElementById('template-plane')?.value || 'xz').toLowerCase();
    const plane = planeRaw === 'xy' || planeRaw === 'xz' || planeRaw === 'yz' ? planeRaw : 'xz';
    return {
      sizeX: Math.max(10, Math.min(300, Number.isFinite(sizeXRaw) ? sizeXRaw : 100)),
      sizeZ: Math.max(10, Math.min(300, Number.isFinite(sizeZRaw) ? sizeZRaw : 100)),
      steps: Math.max(4, Math.min(200, Number.isFinite(stepsRaw) ? stepsRaw : 10)),
      plane
    };
  }

  setTargetTCP(pos) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = roundTo(v, 2); };
    set('tcp-x', pos.x); set('tcp-y', pos.y); set('tcp-z', pos.z);
  }

  getAllAngles() {
    const angles = {};
    for (const key of ROBOT_CONFIG.jointKeys) {
      angles[key] = parseFloat(this.sliders[key]?.value || '0');
    }
    return angles;
  }

  _checkLimitWarning(key, val) {
    const [min, max] = ROBOT_CONFIG.limits[key];
    const range = max - min;
    const margin = range * 0.1;
    const ctrl = this.jointControls[key];
    if (!ctrl) return;
    ctrl.classList.remove('limit-warning', 'limit-danger');
    if (val <= min + margin / 2 || val >= max - margin / 2) {
      ctrl.classList.add('limit-danger');
    } else if (val <= min + margin || val >= max - margin) {
      ctrl.classList.add('limit-warning');
    }
  }
}
