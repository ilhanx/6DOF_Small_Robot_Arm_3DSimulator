/**
 * Çalışma düzleminde çizgi / dörtgen / üçgen / daire çizimi ve yol çıktısı.
 */
import * as THREE from 'three';

const LINE_COLOR = 0x5ec8ff;
const PREVIEW_COLOR = 0xffaa44;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function snapMm(v, step) {
  if (!step || step <= 0) return v;
  return Math.round(v / step) * step;
}

/** Düzlem — kesişim noktası (world) */
function intersectRayPlane(ray, mode, bounds) {
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const coplanar = new THREE.Vector3();
  const plane = new THREE.Plane();

  if (mode === 'xz') {
    n.set(0, 1, 0);
    coplanar.set(0, bounds.plotterY, 0);
  } else if (mode === 'xy') {
    n.set(0, 0, 1);
    coplanar.set(0, 0, bounds.planeZConst);
  } else {
    n.set(1, 0, 0);
    coplanar.set(bounds.planeXConst, 0, 0);
  }

  plane.setFromNormalAndCoplanarPoint(n, coplanar);
  if (!ray.intersectPlane(plane, p)) return null;
  return clampPointToWorkspace(p, mode, bounds);
}

function clampPointToWorkspace(p, mode, bounds) {
  if (mode === 'xz') {
    return new THREE.Vector3(
      clamp(p.x, bounds.xMin, bounds.xMax),
      bounds.plotterY,
      clamp(p.z, bounds.zMin, bounds.zMax),
    );
  }
  if (mode === 'xy') {
    return new THREE.Vector3(
      clamp(p.x, bounds.xMin, bounds.xMax),
      clamp(p.y, bounds.yMin, bounds.yMax),
      bounds.planeZConst,
    );
  }
  return new THREE.Vector3(
    bounds.planeXConst,
    clamp(p.y, bounds.yMin, bounds.yMax),
    clamp(p.z, bounds.zMin, bounds.zMax),
  );
}

function vecToPoint(v) {
  return { x: v.x, y: v.y, z: v.z };
}

function buildRectCorners(p0, p1, mode, bounds) {
  if (mode === 'xz') {
    const minx = Math.min(p0.x, p1.x);
    const maxx = Math.max(p0.x, p1.x);
    const minz = Math.min(p0.z, p1.z);
    const maxz = Math.max(p0.z, p1.z);
    const y = bounds.plotterY;
    return [
      new THREE.Vector3(minx, y, minz),
      new THREE.Vector3(maxx, y, minz),
      new THREE.Vector3(maxx, y, maxz),
      new THREE.Vector3(minx, y, maxz),
    ];
  }
  if (mode === 'xy') {
    const minx = Math.min(p0.x, p1.x);
    const maxx = Math.max(p0.x, p1.x);
    const miny = Math.min(p0.y, p1.y);
    const maxy = Math.max(p0.y, p1.y);
    const z = bounds.planeZConst;
    return [
      new THREE.Vector3(minx, miny, z),
      new THREE.Vector3(maxx, miny, z),
      new THREE.Vector3(maxx, maxy, z),
      new THREE.Vector3(minx, maxy, z),
    ];
  }
  const miny = Math.min(p0.y, p1.y);
  const maxy = Math.max(p0.y, p1.y);
  const minz = Math.min(p0.z, p1.z);
  const maxz = Math.max(p0.z, p1.z);
  const x = bounds.planeXConst;
  return [
    new THREE.Vector3(x, miny, minz),
    new THREE.Vector3(x, maxy, minz),
    new THREE.Vector3(x, maxy, maxz),
    new THREE.Vector3(x, miny, maxz),
  ];
}

function buildCirclePoints(center, rim, mode, segments, bounds) {
  const c = center.clone();
  const rvec = rim.clone().sub(c);
  let r = 0;
  let u = new THREE.Vector3();
  let v = new THREE.Vector3();

  if (mode === 'xz') {
    r = Math.hypot(rvec.x, rvec.z);
    u.set(1, 0, 0);
    v.set(0, 0, 1);
  } else if (mode === 'xy') {
    r = Math.hypot(rvec.x, rvec.y);
    u.set(1, 0, 0);
    v.set(0, 1, 0);
  } else {
    r = Math.hypot(rvec.y, rvec.z);
    u.set(0, 1, 0);
    v.set(0, 0, 1);
  }

  if (r < 1e-3) return [c.clone(), c.clone()];

  const pts = [];
  const n = Math.max(12, segments);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const p = c.clone().addScaledVector(u, r * Math.cos(t)).addScaledVector(v, r * Math.sin(t));
    pts.push(clampPointToWorkspace(p, mode, bounds));
  }
  return pts;
}

function axisAlignSecondPointXZ(p0, p1) {
  const out = p1.clone();
  if (Math.abs(out.x - p0.x) >= Math.abs(out.z - p0.z)) {
    out.z = p0.z;
  } else {
    out.x = p0.x;
  }
  return out;
}

function axisAlignSecondPointXY(p0, p1) {
  const out = p1.clone();
  if (Math.abs(out.x - p0.x) >= Math.abs(out.y - p0.y)) {
    out.y = p0.y;
  } else {
    out.x = p0.x;
  }
  return out;
}

function axisAlignSecondPointYZ(p0, p1) {
  const out = p1.clone();
  if (Math.abs(out.y - p0.y) >= Math.abs(out.z - p0.z)) {
    out.z = p0.z;
  } else {
    out.y = p0.y;
  }
  return out;
}

function applyAxisAlign(p0, p1, mode) {
  if (mode === 'xz') return axisAlignSecondPointXZ(p0, p1);
  if (mode === 'xy') return axisAlignSecondPointXY(p0, p1);
  return axisAlignSecondPointYZ(p0, p1);
}

function samplePolyline(points, targetCount) {
  if (!points.length) return [];
  if (points.length === 1) return [vecToPoint(points[0])];
  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += points[i].distanceTo(points[i - 1]);
    lengths.push(total);
  }
  const n = Math.max(2, targetCount);
  const result = [];
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    let idx = 1;
    while (idx < lengths.length && lengths[idx] < d) idx++;
    const i1 = Math.max(1, idx);
    const i0 = i1 - 1;
    const span = Math.max(1e-9, lengths[i1] - lengths[i0]);
    const t = (d - lengths[i0]) / span;
    const a = points[i0];
    const b = points[i1];
    result.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
  }
  return result;
}

function disposeLine(line) {
  if (!line) return;
  line.parent?.remove(line);
  line.geometry?.dispose();
  if (Array.isArray(line.material)) line.material.forEach((m) => m.dispose());
  else line.material?.dispose();
}

function isFormFieldTarget(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export class WorkspaceDrawingManager {
  /**
   * @param {{
   *   scene: THREE.Scene,
   *   camera: THREE.Camera,
   *   getCanvas: () => HTMLElement,
   *   getPlane: () => 'xz'|'xy'|'yz',
   *   getTool: () => string,
   *   getPathSamples: () => number,
   *   getSnapStep: () => number,
   *   bounds: {
   *     plotterY: number,
   *     planeZConst: number,
   *     planeXConst: number,
   *     xMin: number, xMax: number,
   *     zMin: number, zMax: number,
   *     yMin: number, yMax: number,
   *   },
   *   t: (key: string, params?: object) => string,
   *   onToast: (msg: string, kind: 'success'|'error'|'warning') => void,
   * }} opts
   */
  constructor(opts) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.getCanvas = opts.getCanvas;
    this.getPlane = opts.getPlane;
    this.getTool = opts.getTool;
    this.getPathSamples = opts.getPathSamples;
    this.getSnapStep = opts.getSnapStep;
    this.bounds = opts.bounds;
    this.t = opts.t;
    this.onToast = opts.onToast;

    this.group = new THREE.Group();
    this.group.name = 'WorkspaceDrawings';
    this.scene.add(this.group);

    this.shapes = [];
    this.draftPoints = [];
    this.previewLine = null;
    this._raycaster = new THREE.Raycaster();
    this._raycaster.params.Line = { threshold: 16 };
    this._ndc = new THREE.Vector2();
    this._shapeDrag = null;

    this._onMove = (e) => this.onPointerMove(e);
    this._onKey = (e) => this.onKeyDown(e);
    this._onUp = (e) => this.endShapeDrag(e);
    this.getCanvas().addEventListener('pointermove', this._onMove);
    this.getCanvas().addEventListener('pointerup', this._onUp);
    this.getCanvas().addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKey);
  }

  dispose() {
    this.endShapeDrag({});
    this.clearAll();
    this.getCanvas()?.removeEventListener('pointermove', this._onMove);
    this.getCanvas()?.removeEventListener('pointerup', this._onUp);
    this.getCanvas()?.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('keydown', this._onKey);
    this.scene.remove(this.group);
  }

  isDrawingActive() {
    const tool = this.getTool();
    return tool && tool !== 'none';
  }

  _ndcFromEvent(event) {
    const el = this.getCanvas();
    const rect = el.getBoundingClientRect();
    this._ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pickOnPlane(event) {
    this._ndcFromEvent(event);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const mode = this.getPlane();
    return intersectRayPlane(this._raycaster.ray, mode, this.bounds);
  }

  _applySnap(v, event) {
    const step = event?.altKey ? this.getSnapStep() : 0;
    if (!step) return v;
    return new THREE.Vector3(
      snapMm(v.x, step),
      snapMm(v.y, step),
      snapMm(v.z, step),
    );
  }

  _clearDraft() {
    this.draftPoints = [];
    if (this.previewLine) {
      disposeLine(this.previewLine);
      this.previewLine = null;
    }
  }

  _updatePreview(cursorWorld) {
    if (!this.draftPoints.length || !cursorWorld) {
      if (this.previewLine) {
        disposeLine(this.previewLine);
        this.previewLine = null;
      }
      return;
    }
    const pts = [...this.draftPoints, cursorWorld];
    if (this.previewLine) {
      this.previewLine.geometry.dispose();
      this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    } else {
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: PREVIEW_COLOR,
        depthTest: true,
        transparent: true,
        opacity: 0.85,
      });
      this.previewLine = new THREE.Line(geom, mat);
      this.previewLine.frustumCulled = false;
      this.group.add(this.previewLine);
    }
  }

  onPointerMove(event) {
    if (this._shapeDrag) {
      this._updateShapeDragFromEvent(event);
      return;
    }
    if (!this.isDrawingActive()) return;
    const tool = this.getTool();
    const p = this._pickOnPlane(event);
    if (!p) return;

    if (tool === 'line' && this.draftPoints.length === 1) {
      let q = p.clone();
      if (event.shiftKey) q = applyAxisAlign(this.draftPoints[0], q, this.getPlane());
      q = this._applySnap(q, event);
      this._updatePreview(q);
      return;
    }
    if (tool === 'rect' && this.draftPoints.length === 1) {
      const corners = buildRectCorners(this.draftPoints[0], p, this.getPlane(), this.bounds);
      const closed = [...corners, corners[0]];
      this._updatePreviewPoly(closed);
      return;
    }
    if (tool === 'triangle' && (this.draftPoints.length === 1 || this.draftPoints.length === 2)) {
      const pts = [...this.draftPoints, p];
      const closed = pts.length === 3 ? [...pts, pts[0]] : pts;
      this._updatePreviewPoly(closed);
      return;
    }
    if (tool === 'circle' && this.draftPoints.length === 1) {
      const ring = buildCirclePoints(this.draftPoints[0], p, this.getPlane(), 48, this.bounds);
      if (ring.length) this._updatePreviewPoly([...ring, ring[0]]);
      return;
    }
  }

  _updatePreviewPoly(pointsVec) {
    if (this.previewLine) {
      this.previewLine.geometry.dispose();
      this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(pointsVec);
    } else {
      const geom = new THREE.BufferGeometry().setFromPoints(pointsVec);
      const mat = new THREE.LineBasicMaterial({
        color: PREVIEW_COLOR,
        transparent: true,
        opacity: 0.85,
      });
      this.previewLine = new THREE.Line(geom, mat);
      this.previewLine.frustumCulled = false;
      this.group.add(this.previewLine);
    }
  }

  onKeyDown(event) {
    if (isFormFieldTarget(event.target)) return;
    const key = event.key?.toLowerCase?.() || '';
    if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.popLastShape();
      return;
    }
    if (event.key === 'Escape' && this.isDrawingActive() && this.draftPoints.length) {
      this._clearDraft();
      this.onToast(this.t('draw.toastCancelled'), 'warning');
    }
  }

  popLastShape() {
    if (!this.shapes.length) return;
    const s = this.shapes.pop();
    disposeLine(s.line);
    this.onToast(this.t('draw.toastUndo'), 'success');
  }

  _ensureShapePlane(shape) {
    if (!shape.plane) shape.plane = 'xz';
  }

  endShapeDrag(event) {
    if (!this._shapeDrag) return;
    const id = this._shapeDrag.pointerId;
    if (event?.pointerId != null && event.pointerId !== id) return;
    try {
      if (this.getCanvas()?.hasPointerCapture?.(id)) {
        this.getCanvas().releasePointerCapture(id);
      }
    } catch (_) {
      /* ignore */
    }
    this._shapeDrag = null;
  }

  _rebuildShapeGeometry(shape) {
    const pts = shape.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    shape.line.geometry.dispose();
    shape.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  _updateShapeDragFromEvent(event) {
    if (!this._shapeDrag) return;
    const shape = this.shapes[this._shapeDrag.index];
    if (!shape) {
      this.endShapeDrag(event);
      return;
    }
    this._ensureShapePlane(shape);
    this._ndcFromEvent(event);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hit = intersectRayPlane(this._raycaster.ray, shape.plane, this.bounds);
    if (!hit) return;
    const d = hit.clone().sub(this._shapeDrag.last);
    this._shapeDrag.last.copy(hit);
    for (const p of shape.points) {
      p.x += d.x;
      p.y += d.y;
      p.z += d.z;
      const c = clampPointToWorkspace(new THREE.Vector3(p.x, p.y, p.z), shape.plane, this.bounds);
      p.x = c.x;
      p.y = c.y;
      p.z = c.z;
    }
    this._rebuildShapeGeometry(shape);
  }

  /**
   * Taşı/bak modunda çizginin üzerine Ctrl+basılı sol tıklanırsa sürüklemeyi başlatır.
   * @returns {boolean}
   */
  tryBeginShapeDrag(event) {
    if (this.isDrawingActive()) return false;
    if (event.button !== 0) return false;
    if (!event.ctrlKey) return false;
    if (isFormFieldTarget(event.target)) return false;
    if (!this.shapes.length) return false;

    this._ndcFromEvent(event);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const lines = this.shapes.map((s) => s.line);
    const hits = this._raycaster.intersectObjects(lines, false);
    if (!hits.length) return false;

    const lineObj = hits[0].object;
    const idx = this.shapes.findIndex((s) => s.line === lineObj);
    if (idx < 0) return false;

    this._shapeDrag = {
      index: idx,
      last: hits[0].point.clone(),
      pointerId: event.pointerId,
    };
    try {
      this.getCanvas().setPointerCapture(event.pointerId);
    } catch (_) {
      /* ignore */
    }
    return true;
  }

  /**
   * @returns {boolean} true ise olay tüketildi (TCP sürükleme vb. çalışmasın)
   */
  consumePointerDown(event) {
    if (!this.isDrawingActive()) return false;
    if (event.button !== 0) return false;

    const tool = this.getTool();
    let p = this._pickOnPlane(event);
    if (!p) return false;
    p = this._applySnap(p, event);

    const mode = this.getPlane();

    if (tool === 'line') {
      if (this.draftPoints.length === 0) {
        this.draftPoints.push(p.clone());
        return true;
      }
      let p1 = p.clone();
      if (event.shiftKey) p1 = applyAxisAlign(this.draftPoints[0], p1, mode);
      const strip = [this.draftPoints[0].clone(), p1];
      this._addLineMesh(strip, false);
      this._clearDraft();
      this.onToast(this.t('draw.toastShapeDone'), 'success');
      return true;
    }

    if (tool === 'rect') {
      if (this.draftPoints.length === 0) {
        this.draftPoints.push(p.clone());
        return true;
      }
      const corners = buildRectCorners(this.draftPoints[0], p, mode, this.bounds);
      this._addLineMesh(corners, true); // LineLoop: 4 köşe
      this._clearDraft();
      this.onToast(this.t('draw.toastShapeDone'), 'success');
      return true;
    }

    if (tool === 'triangle') {
      this.draftPoints.push(p.clone());
      if (this.draftPoints.length < 3) return true;
      const strip = [
        this.draftPoints[0].clone(),
        this.draftPoints[1].clone(),
        this.draftPoints[2].clone(),
      ];
      this._addLineMesh(strip, true);
      this._clearDraft();
      this.onToast(this.t('draw.toastShapeDone'), 'success');
      return true;
    }

    if (tool === 'circle') {
      if (this.draftPoints.length === 0) {
        this.draftPoints.push(p.clone());
        return true;
      }
      const ring = buildCirclePoints(this.draftPoints[0], p, mode, 48, this.bounds);
      this._addLineMesh(ring, true);
      this._clearDraft();
      this.onToast(this.t('draw.toastShapeDone'), 'success');
      return true;
    }

    return false;
  }

  _addLineMesh(pointsVec, asLoop) {
    const geom = new THREE.BufferGeometry().setFromPoints(pointsVec);
    const mat = new THREE.LineBasicMaterial({ color: LINE_COLOR });
    const line = asLoop ? new THREE.LineLoop(geom, mat) : new THREE.Line(geom, mat);
    line.frustumCulled = false;
    this.group.add(line);
    this.shapes.push({
      kind: this.getTool(),
      plane: this.getPlane(),
      points: pointsVec.map(vecToPoint),
      closed: asLoop,
      line,
    });
  }

  clearAll() {
    for (const s of this.shapes) disposeLine(s.line);
    this.shapes = [];
    this._clearDraft();
  }

  /** Düzlem değişince yarım kalan tıklamaları sıfırla */
  clearPlaneDraft() {
    this._clearDraft();
  }

  /**
   * Çizimi Adımla: çokgenlerde köşe sırası (kapalıysa son hedef = ilk köşe); dairede yay örneklemesi.
   * @returns {{ path: {x:number,y:number,z:number}[], closed: boolean }|null}
   */
  getLastRobotWaypointPath() {
    if (!this.shapes.length) return null;
    const last = this.shapes[this.shapes.length - 1];
    this._ensureShapePlane(last);
    let vecs = last.points.map((pt) => new THREE.Vector3(pt.x, pt.y, pt.z));
    if (!vecs.length) return null;

    const closed = last.closed && vecs.length >= 2;
    if (closed) {
      vecs = [...vecs, vecs[0].clone()];
    }

    if (last.kind === 'circle' && closed) {
      const n = Math.max(3, Math.min(200, this.getPathSamples() | 0));
      return { path: samplePolyline(vecs, n), closed: true };
    }

    return { path: vecs.map(vecToPoint), closed };
  }
}
