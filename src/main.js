/**
 * main.js — Ana Giriş Noktası
 * Sahne kurulumu, animasyon döngüsü, tüm modüllerin orkestrasyon
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ROBOT_CONFIG, clampAngle, clampAllAngles } from './config.js';
import { RobotArm } from './robot.js';
import { Kinematics } from './kinematics.js';
import { TrajectoryPlanner } from './trajectory.js';
import { TargetTracker } from './tracking.js';
import { CollisionChecker } from './collision.js';
import { ScenarioManager } from './scenario.js';
import { UIManager } from './ui.js';
import { roundTo } from './utils.js';
import {
  SerialPortSession,
  loadComSettings,
  saveComSettings,
  defaultComSettings,
  isWebSerialSupported,
} from './serialPort.js';
import { getPanelHelp } from './panelHelp.js';
import { getLang, setLang, subscribeLang, applyDomTranslations, t } from './i18n.js';

// Slider ile eklem: her karede hedefe kalan farkın bu kadarını kapat (1 = anında). %75 yavaşlatma → 0.25
const MANUAL_JOINT_LERP = 0.25;

// =================== APPLICATION STATE ===================
const state = {
  angles: { ...ROBOT_CONFIG.homePosition },
  /** Slider/hedef açılar (robot `MANUAL_JOINT_LERP` ile buna yaklaşır) */
  manualJointTarget: { ...ROBOT_CONFIG.homePosition },
  mode: 'MANUAL',  // MANUAL | AUTO | TRACKING
  autoIK: false,
};

/** Robot + UI açı senkronu; programatik pozda slider hedefleri de güncellenir */
function applyAnglesToRobotAndUI(angles, options = {}) {
  state.angles = clampAllAngles(angles);
  robot.setAngles(state.angles);
  const skipSliders = options.skipSliders === true;
  ui.updateAngles(state.angles, { skipSliders });
  if (!skipSliders) {
    state.manualJointTarget = { ...state.angles };
  }
}

const PLOTTER_Y = 20.0;
const PLOTTER_X_MIN = -150.0;
const PLOTTER_X_MAX = 150.0;
const PLOTTER_Z_MIN = -300.0;
const PLOTTER_Z_MAX = 0.0;
const BOUNDS_TEMPLATE_X1 = -70.0;
const BOUNDS_TEMPLATE_X2 = 70.0;
const BOUNDS_TEMPLATE_Z1 = -20.0;
const BOUNDS_TEMPLATE_Z2 = -110.0;

// =================== THREE.JS SCENE SETUP ===================
const container = document.getElementById('viewport-3d');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e17);
scene.fog = new THREE.FogExp2(0x0a0e17, 0.0005);

// Camera
const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
camera.position.set(260, 115, 320);
camera.lookAt(0, 42, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
container.appendChild(renderer.domElement);

// =================== LIGHTING ===================
// Ambient — genel aydınlatma (daha parlak)
const ambientLight = new THREE.AmbientLight(0x8090b0, 1.0);
scene.add(ambientLight);

// Key light — ana ışık (endüstriyel üst ışık, sıcak beyaz)
const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
keyLight.position.set(150, 350, 200);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 10;
keyLight.shadow.camera.far = 800;
keyLight.shadow.camera.left = -200;
keyLight.shadow.camera.right = 200;
keyLight.shadow.camera.top = 200;
keyLight.shadow.camera.bottom = -200;
scene.add(keyLight);

// Fill light — dolgu ışık (soğuk mavi, gölgeleri yumuşatır)
const fillLight = new THREE.DirectionalLight(0x8ab4f8, 0.8);
fillLight.position.set(-150, 150, -100);
scene.add(fillLight);

// Rim/Back light — arka kenar ışık (robotun dış hatlarını belirginleştirir)
const rimLight = new THREE.DirectionalLight(0xffd0a0, 0.6);
rimLight.position.set(-50, 100, 250);
scene.add(rimLight);

// Hemisphere — gök/yer renk geçişi
const hemiLight = new THREE.HemisphereLight(0xb0c4de, 0x404050, 0.8);
scene.add(hemiLight);

// Spot light — vurgulayıcı üst spot (robota odaklı)
const spotLight = new THREE.SpotLight(0xffffff, 1.5, 500, Math.PI / 6, 0.5, 1);
spotLight.position.set(0, 350, 0);
spotLight.target.position.set(0, 50, 0);
scene.add(spotLight);
scene.add(spotLight.target);

// =================== GRID + AXES ===================
// Horizontal reference (XZ): flip Z so grid/axes match desired plotter/floor Z direction.
const floorPlaneRef = new THREE.Group();
floorPlaneRef.scale.z = -1;
scene.add(floorPlaneRef);

const gridHelper = new THREE.GridHelper(600, 30, 0x1a2744, 0x111b30);
gridHelper.material.opacity = 0.6;
gridHelper.material.transparent = true;
floorPlaneRef.add(gridHelper);

const axesHelper = new THREE.AxesHelper(100);
floorPlaneRef.add(axesHelper);

// Ground plane (shadow receiver)
const groundGeo = new THREE.PlaneGeometry(600, 600);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
floorPlaneRef.add(ground);

// =================== CONTROLS ===================
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.target.set(0, 42, 0);
orbitControls.minDistance = 100;
orbitControls.maxDistance = 1000;
const cameraAngleDisplay = document.getElementById('camera-angle-display');
const mouseCoordDisplay = document.getElementById('mouse-coord-display');

const mouseCoordPlane = new THREE.Plane();
const mouseCoordRaycaster = new THREE.Raycaster();
const mouseCoordNDC = new THREE.Vector2();
const mouseCoordPoint = new THREE.Vector3();
const mouseCoordPlaneNormal = new THREE.Vector3();

function setInitialCameraAngles(yawDeg, pitchDeg) {
  const target = orbitControls.target;
  const radius = camera.position.distanceTo(target);
  const theta = THREE.MathUtils.degToRad(yawDeg);
  const phi = THREE.MathUtils.degToRad(90 - pitchDeg);
  const sinPhi = Math.sin(phi);

  camera.position.set(
    target.x + radius * sinPhi * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * sinPhi * Math.cos(theta)
  );
  camera.lookAt(target);
  orbitControls.update();
}

setInitialCameraAngles(-90, 10);

function initializePerPanelCollapse() {
  const PANEL_STATE_KEY = 'robotsim.panelCollapseState.v1';
  let persistedState = {};
  try {
    const raw = localStorage.getItem(PANEL_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') persistedState = parsed;
    }
  } catch (_) {
    persistedState = {};
  }

  const savePanelState = () => {
    const nextState = {};
    const panels = document.querySelectorAll('.sidebar .panel');
    panels.forEach((p) => {
      if (p.id) nextState[p.id] = p.classList.contains('panel-collapsed');
    });
    try {
      localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(nextState));
    } catch (_) {
      // ignore persistence errors (private mode/quota)
    }
  };

  const panels = document.querySelectorAll('.sidebar .panel');
  panels.forEach((panel) => {
    const title = panel.querySelector('.panel-title');
    if (!title) return;
    if (panel.id && persistedState[panel.id] === true) {
      panel.classList.add('panel-collapsed');
    }
    const icon = document.createElement('span');
    icon.className = 'panel-collapse-icon';
    icon.textContent = panel.classList.contains('panel-collapsed') ? '▸' : '▾';
    title.appendChild(icon);
    title.addEventListener('click', (e) => {
      if (e.target.closest('.panel-info-btn')) return;
      panel.classList.toggle('panel-collapsed');
      icon.textContent = panel.classList.contains('panel-collapsed') ? '▸' : '▾';
      savePanelState();
      onResize();
    });
  });
  // Ensure persisted state exists even if no user toggle happened in this run.
  savePanelState();
}

applyDomTranslations();
initializePerPanelCollapse();

function initPanelHelpModal() {
  const modal = document.getElementById('panel-help-modal');
  const titleEl = document.getElementById('panel-help-title');
  const bodyEl = document.getElementById('panel-help-body');
  const closeBtn = document.getElementById('btn-panel-help-close');
  if (!modal || !titleEl || !bodyEl) return;

  const close = () => {
    delete modal.dataset.openHelpId;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    bodyEl.innerHTML = '';
  };

  const open = (panelId) => {
    const entry = getPanelHelp(getLang())[panelId];
    modal.dataset.openHelpId = panelId;
    if (entry) {
      titleEl.textContent = entry.title;
      bodyEl.innerHTML = entry.html;
    } else {
      titleEl.textContent = t('panelHelp.missingTitle');
      bodyEl.innerHTML = t('panelHelp.missingBody');
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target?.id === 'panel-help-modal') close();
  });
  document.querySelector('.modal-dialog.panel-help-dialog')?.addEventListener('click', (e) => e.stopPropagation());

  document.querySelectorAll('.panel-info-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-panel-help');
      if (id) open(id);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
}

initPanelHelpModal();

function formatMouseMm(value) {
  const rounded = Math.round(value);
  const absPadded = Math.abs(rounded).toString().padStart(3, '0');
  return `${rounded < 0 ? '-' : ''}${absPadded}mm`;
}

function updateMouseCoordDisplay(event) {
  if (!mouseCoordDisplay) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouseCoordNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseCoordNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  mouseCoordRaycaster.setFromCamera(mouseCoordNDC, camera);

  // Kameraya dik dinamik düzlem kullan:
  // Orbit hedefinden geçtiği için X/Y/Z birlikte değişir.
  camera.getWorldDirection(mouseCoordPlaneNormal).negate();
  mouseCoordPlane.setFromNormalAndCoplanarPoint(mouseCoordPlaneNormal, orbitControls.target);

  if (mouseCoordRaycaster.ray.intersectPlane(mouseCoordPlane, mouseCoordPoint)) {
    mouseCoordDisplay.textContent = t('viewport.mouseCoord', {
      x: formatMouseMm(mouseCoordPoint.x),
      y: formatMouseMm(mouseCoordPoint.y),
      z: formatMouseMm(mouseCoordPoint.z),
    });
  }
}

renderer.domElement.addEventListener('pointermove', updateMouseCoordDisplay);

function updateCameraAngleDisplay() {
  if (!cameraAngleDisplay) return;
  const yawDeg = THREE.MathUtils.radToDeg(orbitControls.getAzimuthalAngle());
  const pitchDeg = THREE.MathUtils.radToDeg(Math.PI / 2 - orbitControls.getPolarAngle());
  cameraAngleDisplay.textContent = t('viewport.camAngles', {
    yaw: yawDeg.toFixed(1),
    pitch: pitchDeg.toFixed(1),
  });
}

// =================== HEDEF KÜRESİ (Bağımsız — serbestçe hareket eder) ===================
const targetGeo = new THREE.SphereGeometry(5, 16, 16);
const targetMat = new THREE.MeshStandardMaterial({
  color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 0.3,
  metalness: 0.3, roughness: 0.5
});
const targetMarker = new THREE.Mesh(targetGeo, targetMat);
const fk0 = new Kinematics().computeFK(state.angles);
targetMarker.position.set(0, 0, 0);
scene.add(targetMarker);

// Hedef eksen belirteçleri (kırmızı küre tıklanınca görünür)
const targetAxisGizmo = new THREE.Group();
const targetAxisHandles = [];
const targetAxisLen = 28;

function createAxisHandle(axis, colorHex) {
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.2,
    metalness: 0.2,
    roughness: 0.5
  });
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, targetAxisLen, 12), mat);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 12), mat);

  if (axis === 'x') {
    body.rotation.z = -Math.PI / 2;
    body.position.x = targetAxisLen / 2;
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = targetAxisLen + 3;
  } else if (axis === 'y') {
    body.position.y = targetAxisLen / 2;
    tip.position.y = targetAxisLen + 3;
  } else {
    body.rotation.x = Math.PI / 2;
    body.position.z = targetAxisLen / 2;
    tip.rotation.x = Math.PI / 2;
    tip.position.z = targetAxisLen + 3;
  }

  group.add(body);
  group.add(tip);
  group.userData.axis = axis;
  body.userData.axis = axis;
  tip.userData.axis = axis;
  targetAxisHandles.push(body, tip);
  return group;
}

targetAxisGizmo.add(createAxisHandle('x', 0xff4d4d));
targetAxisGizmo.add(createAxisHandle('y', 0x33ff66));
targetAxisGizmo.add(createAxisHandle('z', 0x4d88ff));
targetAxisGizmo.visible = false;
targetAxisGizmo.position.copy(targetMarker.position);
scene.add(targetAxisGizmo);

// TransformControls — hedef küresi için (bağımsız)
let transformControls = null;
let transformControlsHelper = null;
try {
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.5);
  transformControls.setMode('translate');
  transformControls.attach(targetMarker);
  transformControlsHelper = transformControls.getHelper ? transformControls.getHelper() : transformControls;
  scene.add(transformControlsHelper);
  // Varsayılan olarak pasif: robot sürükleme öncelikli olsun
  transformControls.enabled = false;
  transformControlsHelper.visible = false;

  transformControls.addEventListener('dragging-changed', (e) => {
    orbitControls.enabled = !e.value;
  });

  transformControls.addEventListener('change', () => {
    if (!transformControls.object) return;
    const pos = transformControls.object.position;
    ui.setTargetTCP({ x: pos.x, y: pos.y, z: pos.z });
    tracker.setTarget({ x: pos.x, y: pos.y, z: pos.z });
  });
} catch (e) {
  console.warn('TransformControls init error:', e);
}

// =================== TCP SÜRÜKLEME (Flanş ucundan mouse ile hareket) ===================
// Yeşil küre — robot ucunda, mouse ile tutulabilir
const tcpHandleGeo = new THREE.SphereGeometry(1.5, 16, 16);
const tcpHandleMat = new THREE.MeshStandardMaterial({
  color: 0x00ff88, emissive: 0x00cc66, emissiveIntensity: 0.4,
  metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.8
});
const tcpHandle = new THREE.Mesh(tcpHandleGeo, tcpHandleMat);
tcpHandle.position.set(fk0.position.x, fk0.position.y, fk0.position.z);
tcpHandle.userData.isTCPHandle = true;
scene.add(tcpHandle);

// Mouse sürükleme state
let isDraggingTCP = false;
let isDraggingTarget = false;
let wasAutoIKEnabledBeforeDrag = false;
let isTargetTransformArmed = false;
let activeTargetAxis = null;
let targetDragStartPoint = new THREE.Vector3();
let targetDragStartPosition = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragIntersection = new THREE.Vector3();

function getMouseNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

// Mouse DOWN — TCP handle'a tıklandı mı kontrol et
renderer.domElement.addEventListener('pointerdown', (event) => {
  getMouseNDC(event);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(tcpHandle);
  const targetHits = raycaster.intersectObject(targetMarker);
  const axisHits = raycaster.intersectObjects(targetAxisHandles, false);

  // Boş alana tıklanınca hedef eksen belirteçlerini gizle
  if (hits.length === 0 && targetHits.length === 0 && axisHits.length === 0) {
    targetAxisGizmo.visible = false;
    activeTargetAxis = null;
  }

  // Eksen tutacağına tıklandıysa: yalnız o eksende sürükle
  if (axisHits.length > 0) {
    const picked = axisHits[0].object.userData.axis || axisHits[0].object.parent?.userData?.axis;
    activeTargetAxis = picked || null;
    isDraggingTarget = true;
    orbitControls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      targetMarker.position.clone()
    );
    raycaster.ray.intersectPlane(dragPlane, targetDragStartPoint);
    targetDragStartPosition.copy(targetMarker.position);
    renderer.domElement.style.cursor = 'grabbing';
    return;
  }

  // Kırmızı hedef küreyi doğrudan sürükleme (TransformControls'a bağımlı değil)
  if (targetHits.length > 0 && hits.length === 0) {
    // İlk tıkta eksenleri göster, ikinci tıkta serbest sürükle
    if (!targetAxisGizmo.visible) {
      targetAxisGizmo.visible = true;
      targetAxisGizmo.position.copy(targetMarker.position);
      activeTargetAxis = null;
      return;
    }

    isDraggingTarget = true;
    activeTargetAxis = null;
    orbitControls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      targetMarker.position.clone()
    );
    raycaster.ray.intersectPlane(dragPlane, targetDragStartPoint);
    targetDragStartPosition.copy(targetMarker.position);
    renderer.domElement.style.cursor = 'grabbing';
    if (transformControls) transformControls.enabled = false;
    if (transformControlsHelper) transformControlsHelper.visible = false;
    return;
  }

  // Hedef küre sadece doğrudan onun üstüne tıklanırsa aktive olsun
  if (transformControls) {
    isTargetTransformArmed = targetHits.length > 0 && hits.length === 0;
    transformControls.enabled = isTargetTransformArmed;
    if (transformControlsHelper) transformControlsHelper.visible = isTargetTransformArmed;
  }

  if (hits.length > 0) {
    // Aynı anda birden fazla hareket kaynağı çalışmasın
    planner.stop();
    wasAutoIKEnabledBeforeDrag = state.autoIK && tracker.enabled;
    if (wasAutoIKEnabledBeforeDrag) {
      tracker.disable();
    }
    if (transformControls) transformControls.enabled = false;
    if (transformControlsHelper) transformControlsHelper.visible = false;

    isDraggingTCP = true;
    renderer.domElement.setPointerCapture(event.pointerId);
    orbitControls.enabled = false;
    // Sürükleme düzlemi — kameraya dik, TCP noktasında
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      tcpHandle.position.clone()
    );
    renderer.domElement.style.cursor = 'grabbing';
    // TransformControls gizmo'yu gizle (çakışma önleme)
    if (transformControls) transformControls.enabled = false;
  }
});

// Mouse MOVE — sürükleme
renderer.domElement.addEventListener('pointermove', (event) => {
  if (isDraggingTarget) {
    getMouseNDC(event);
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
      if (activeTargetAxis) {
        const axisVec = activeTargetAxis === 'x'
          ? new THREE.Vector3(1, 0, 0)
          : activeTargetAxis === 'y'
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);
        const delta = dragIntersection.clone().sub(targetDragStartPoint);
        const projected = axisVec.multiplyScalar(delta.dot(axisVec));
        const constrainedPos = targetDragStartPosition.clone().add(projected);
        targetMarker.position.set(constrainedPos.x, constrainedPos.y, constrainedPos.z);
      } else {
        targetMarker.position.set(dragIntersection.x, dragIntersection.y, dragIntersection.z);
      }
      ui.setTargetTCP({
        x: targetMarker.position.x,
        y: targetMarker.position.y,
        z: targetMarker.position.z
      });
      tracker.setTarget({
        x: targetMarker.position.x,
        y: targetMarker.position.y,
        z: targetMarker.position.z
      });
      targetAxisGizmo.position.copy(targetMarker.position);
    }
    return;
  }

  if (!isDraggingTCP) {
    // Hover efekti
    getMouseNDC(event);
    raycaster.setFromCamera(mouse, camera);
    const tcpHits = raycaster.intersectObject(tcpHandle);
    const redHits = raycaster.intersectObject(targetMarker);
    const gizmoHits = targetAxisGizmo.visible ? raycaster.intersectObjects(targetAxisHandles, false) : [];
    renderer.domElement.style.cursor = (tcpHits.length > 0 || redHits.length > 0 || gizmoHits.length > 0) ? 'grab' : '';
    return;
  }

  getMouseNDC(event);
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
    // IK çöz
    const target = { x: dragIntersection.x, y: dragIntersection.y, z: dragIntersection.z };
    // Tutma küresi fare hedefini takip etsin (kontrol hissini iyileştirir)
    tcpHandle.position.set(target.x, target.y, target.z);
    const ikDragOpts = {
      maxIterations: 100,
      tolerance: 1.2,
      fixedJ4: ui.getJ4TargetAngle(),
      fixedJ5WorldPitchDeg: ui.getJ5TargetAngle(),
    };
    if (ui.getTcpDragLockJ1()) {
      ikDragOpts.fixedJ1 = state.angles.j1;
    }
    const result = solveIKWithReachFallback(target, state.angles, ikDragOpts);

    if (result.success) {
      applyAnglesToRobotAndUI(result.angles);
      updatePositionDisplay();
      updateOutput();
    }
  }
});

// Mouse UP — sürükleme bitir
renderer.domElement.addEventListener('pointerup', (event) => {
  if (isDraggingTarget) {
    isDraggingTarget = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    orbitControls.enabled = true;
    renderer.domElement.style.cursor = '';
  }

  if (isDraggingTCP) {
    isDraggingTCP = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    orbitControls.enabled = true;
    renderer.domElement.style.cursor = '';
    if (transformControls) transformControls.enabled = false;
    if (transformControlsHelper) transformControlsHelper.visible = false;
    if (wasAutoIKEnabledBeforeDrag) {
      tracker.enable();
      tracker.setTarget(ui.getTargetTCP());
      wasAutoIKEnabledBeforeDrag = false;
    }
  }
  // Hedef taşıma pointer bırakınca tekrar pasifleşir
  isTargetTransformArmed = false;
  if (transformControls) transformControls.enabled = false;
  if (transformControlsHelper) transformControlsHelper.visible = false;
});

// =================== MODULES ===================
const robot = new RobotArm(scene);
const kinematics = new Kinematics();
const planner = new TrajectoryPlanner(kinematics);
const tracker = new TargetTracker(kinematics);
const collision = new CollisionChecker(kinematics);
const scenario = new ScenarioManager(planner);
const ui = new UIManager();

function syncStepCountElement() {
  const el = document.getElementById('step-count');
  if (!el) return;
  el.textContent = t('scenario.stepsLine', { n: scenario.steps.length });
}

const serialSession = new SerialPortSession();
let stepCursor = -1; // -1: henüz hiçbir adım yürütülmedi
let wasAutoIKEnabledBeforePlay = false;
let isComWriteInProgress = false;
/** Senaryo çıktısı textarea kullanıcı tarafından elle değiştiyse otomatik yenileme yapılmaz. */
let outputPanelUserEdited = false;

const j4TargetSelect = document.getElementById('j4-target-angle');
const j5TargetSelect = document.getElementById('j5-target-angle');
const syncWristTargets = () => {
  tracker.setJ4TargetAngle(ui.getJ4TargetAngle());
  tracker.setJ5TargetAngle(ui.getJ5TargetAngle());
};
j4TargetSelect?.addEventListener('change', syncWristTargets);
j5TargetSelect?.addEventListener('change', syncWristTargets);
syncWristTargets();

document.getElementById('lang-select')?.addEventListener('change', (e) => {
  setLang(e.target.value);
});

subscribeLang(() => {
  applyDomTranslations();
  ui.refreshJointLabels();
  refreshComConnectionBadge();
  ui.updateStatus(state.mode);
  syncStepCountElement();
  updateCameraAngleDisplay();
  const helpModal = document.getElementById('panel-help-modal');
  const helpId = helpModal?.dataset.openHelpId;
  if (helpModal?.classList.contains('open') && helpId) {
    const titleEl = document.getElementById('panel-help-title');
    const bodyEl = document.getElementById('panel-help-body');
    const entry = getPanelHelp(getLang())[helpId];
    if (entry && titleEl && bodyEl) {
      titleEl.textContent = entry.title;
      bodyEl.innerHTML = entry.html;
    } else if (titleEl && bodyEl) {
      titleEl.textContent = t('panelHelp.missingTitle');
      bodyEl.innerHTML = t('panelHelp.missingBody');
    }
  }
});

syncStepCountElement();
ui.updateStatus(state.mode);

// Set initial angles
applyAnglesToRobotAndUI(state.angles);
updatePositionDisplay();

document.getElementById('output-display')?.addEventListener('input', () => {
  outputPanelUserEdited = true;
});

// =================== UI EVENT HANDLERS ===================

// Joint angle changed from UI — robot MANUAL_JOINT_LERP ile manualJointTarget’a yaklaşır
ui.onAngleChange = (key, val) => {
  state.manualJointTarget = clampAllAngles({ ...state.manualJointTarget, [key]: val });
  state.mode = 'MANUAL';
  ui.updateStatus('MANUAL');
};

// Home button
document.getElementById('btn-home')?.addEventListener('click', () => {
  const home = { ...ROBOT_CONFIG.homePosition };
  animateToAngles(home);
});

// Start button
document.getElementById('btn-start')?.addEventListener('click', () => {
  const start = { ...ROBOT_CONFIG.startPosition };
  animateToAngles(start);
});

// Auto IK toggle
document.getElementById('btn-auto-ik')?.addEventListener('click', (e) => {
  state.autoIK = !state.autoIK;
  e.currentTarget.classList.toggle('active', state.autoIK);
  state.mode = state.autoIK ? 'AUTO' : 'MANUAL';
  ui.updateStatus(state.mode);
  if (state.autoIK) {
    tracker.enable();
    const tcp = ui.getTargetTCP();
    tracker.setTarget(tcp);
  } else {
    tracker.disable();
  }
});

// Go to target (IK)
document.getElementById('btn-go-target')?.addEventListener('click', () => {
  runIK();
});

// Reset target
document.getElementById('btn-reset-target')?.addEventListener('click', () => {
  setInitialTargetPosition();
});

// TCP input change
['tcp-x', 'tcp-y', 'tcp-z'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => {
    const tcp = ui.getTargetTCP();
    targetMarker.position.set(tcp.x, tcp.y, tcp.z);
    tracker.setTarget(tcp);
    if (state.autoIK) runIK();
  });
});

// Tracking mode
document.querySelectorAll('input[name="track-mode"]').forEach(radio => {
  radio.addEventListener('change', (e) => { tracker.setMode(e.target.value); });
});

function getOutputPanelText() {
  const el = document.getElementById('output-display');
  if (!el) return '';
  return el.tagName === 'TEXTAREA' ? el.value : (el.textContent || '');
}

// Copy output
document.getElementById('btn-copy-output')?.addEventListener('click', () => {
  const text = getOutputPanelText();
  navigator.clipboard.writeText(text).then(() => {
    ui.showIKStatus(t('toast.copied'), 'success');
  });
});

function readComSettingsFromForm() {
  const baudRaw = parseInt(document.getElementById('com-baud')?.value || '115200', 10);
  const base = defaultComSettings();
  const parityEl = document.getElementById('com-parity');
  const parityVal = parityEl?.value;
  const lineEl = document.getElementById('com-line-ending');
  const lineVal = lineEl?.value;
  return {
    baudRate: Math.min(2000000, Math.max(300, Number.isFinite(baudRaw) ? baudRaw : base.baudRate)),
    dataBits: parseInt(document.getElementById('com-data-bits')?.value || '8', 10) === 7 ? 7 : 8,
    stopBits: parseInt(document.getElementById('com-stop-bits')?.value || '1', 10) === 2 ? 2 : 1,
    parity: parityVal === 'even' || parityVal === 'odd' ? parityVal : 'none',
    flowControl: document.getElementById('com-flow')?.value === 'hardware' ? 'hardware' : 'none',
    lineEnding: lineVal === 'lf' || lineVal === 'none' ? lineVal : 'crlf',
  };
}

function applyComSettingsToForm(settings) {
  const baudSel = document.getElementById('com-baud');
  if (baudSel) {
    const v = String(settings.baudRate);
    if (![...baudSel.options].some((o) => o.value === v)) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      baudSel.appendChild(opt);
    }
    baudSel.value = v;
  }
  const db = document.getElementById('com-data-bits');
  if (db) db.value = settings.dataBits === 7 ? '7' : '8';
  const sb = document.getElementById('com-stop-bits');
  if (sb) sb.value = settings.stopBits === 2 ? '2' : '1';
  const par = document.getElementById('com-parity');
  if (par) par.value = settings.parity === 'even' || settings.parity === 'odd' ? settings.parity : 'none';
  const fl = document.getElementById('com-flow');
  if (fl) fl.value = settings.flowControl === 'hardware' ? 'hardware' : 'none';
  const le = document.getElementById('com-line-ending');
  if (le) le.value = settings.lineEnding === 'lf' || settings.lineEnding === 'none' ? settings.lineEnding : 'crlf';
}

function setComModalMessage(text, isError = false) {
  const el = document.getElementById('com-modal-message');
  if (!el) return;
  el.textContent = text || '';
  el.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
}

function refreshComConnectionBadge() {
  const el = document.getElementById('com-connection-status');
  if (!el) return;
  if (serialSession.isOpen) {
    el.textContent = t('com.connected');
    el.className = 'com-status-badge ok';
  } else {
    el.textContent = t('com.disconnected');
    el.className = 'com-status-badge off';
  }
}

function openComSettingsModal() {
  const modal = document.getElementById('com-settings-modal');
  applyComSettingsToForm(loadComSettings());
  refreshComConnectionBadge();
  setComModalMessage(isWebSerialSupported() ? '' : t('com.noWebSerial'), true);
  modal?.classList.add('open');
  modal?.setAttribute('aria-hidden', 'false');
}

function closeComSettingsModal() {
  const modal = document.getElementById('com-settings-modal');
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
}

document.getElementById('btn-com-settings')?.addEventListener('click', () => openComSettingsModal());
document.getElementById('btn-com-modal-close')?.addEventListener('click', () => closeComSettingsModal());
document.getElementById('com-settings-modal')?.addEventListener('click', (e) => {
  if (e.target?.id === 'com-settings-modal') closeComSettingsModal();
});
document.querySelector('.modal-dialog.com-modal')?.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('btn-com-save-settings')?.addEventListener('click', () => {
  const s = readComSettingsFromForm();
  saveComSettings(s);
  setComModalMessage(t('com.settingsSaved'), false);
});

document.getElementById('btn-com-request-port')?.addEventListener('click', async () => {
  if (!isWebSerialSupported()) {
    setComModalMessage(t('com.noWebSerialShort'), true);
    return;
  }
  const settings = readComSettingsFromForm();
  saveComSettings(settings);
  try {
    setComModalMessage(t('com.connecting'), false);
    await serialSession.connectWithPicker(settings);
    refreshComConnectionBadge();
    setComModalMessage(t('com.portOpen'), false);
  } catch (err) {
    refreshComConnectionBadge();
    setComModalMessage(err?.message || String(err), true);
  }
});

document.getElementById('btn-com-granted-port')?.addEventListener('click', async () => {
  if (!isWebSerialSupported()) {
    setComModalMessage(t('com.noWebSerialShort'), true);
    return;
  }
  const settings = readComSettingsFromForm();
  saveComSettings(settings);
  try {
    setComModalMessage(t('com.connecting'), false);
    await serialSession.connectGranted(settings);
    refreshComConnectionBadge();
    setComModalMessage(t('com.grantedOpen'), false);
  } catch (err) {
    refreshComConnectionBadge();
    setComModalMessage(err?.message || String(err), true);
  }
});

document.getElementById('btn-com-disconnect')?.addEventListener('click', async () => {
  try {
    await serialSession.disconnect();
  } finally {
    refreshComConnectionBadge();
    setComModalMessage(t('com.disconnectedMsg'), false);
  }
});

document.getElementById('btn-com-write')?.addEventListener('click', async () => {
  if (isComWriteInProgress) {
    ui.showIKStatus(t('err.comBusy'), 'error');
    return;
  }
  if (!isWebSerialSupported()) {
    ui.showIKStatus(t('err.noWebSerial'), 'error');
    return;
  }
  if (!serialSession.isOpen) {
    ui.showIKStatus(t('err.comNotConnected'), 'error');
    return;
  }
  updateOutput({ force: true });
  const queue = parseOutputTextToArduinoQueue(getOutputPanelText());
  if (!queue.length) {
    ui.showIKStatus(t('err.noCommands'), 'error');
    return;
  }
  const btn = document.getElementById('btn-com-write');
  const previousLabel = btn?.textContent || t('footer.comWrite');

  isComWriteInProgress = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('com.sending');
  }

  try {
    await transmitComCommandQueue(queue);
  } catch {
    // transmitComCommandQueue hata mesajını gösterdi
  } finally {
    isComWriteInProgress = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = previousLabel;
    }
  }
});

document.getElementById('btn-output-send')?.addEventListener('click', async () => {
  if (isComWriteInProgress) {
    ui.showIKStatus(t('err.comBusy'), 'error');
    return;
  }
  if (!isWebSerialSupported()) {
    ui.showIKStatus(t('err.noWebSerial'), 'error');
    return;
  }
  if (!serialSession.isOpen) {
    ui.showIKStatus(t('err.comNotConnected'), 'error');
    return;
  }
  const queue = parseOutputTextToArduinoQueue(getOutputPanelText());
  if (!queue.length) {
    ui.showIKStatus(t('err.noCommandsShort'), 'error');
    return;
  }
  const btn = document.getElementById('btn-output-send');
  const prev = btn?.textContent || t('com.sendBtn');

  isComWriteInProgress = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('com.sendShort');
  }
  try {
    await transmitComCommandQueue(queue, { writeLogFile: false });
  } catch {
    /* mesaj transmit içinde */
  } finally {
    isComWriteInProgress = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }
});

/** Örnek: simcom1.00,2.00,3.00,4.00,5.00,6.00 — Eklem Gönder ve senaryo çıktısı aynı biçimi kullanır */
function formatSimcomFromAngles(angles) {
  const parts = ROBOT_CONFIG.jointKeys.map((k) => roundTo(angles[k] ?? 0, 2).toFixed(2));
  return `simcom${parts.join(',')}`;
}

function buildSimcomJointCommandString() {
  return formatSimcomFromAngles(ui.getAllAngles());
}

document.getElementById('btn-joints-simcom-send')?.addEventListener('click', async () => {
  if (isComWriteInProgress) {
    ui.showIKStatus(t('err.comBusy'), 'error');
    return;
  }
  if (!isWebSerialSupported()) {
    ui.showIKStatus(t('err.noWebSerial'), 'error');
    return;
  }
  if (!serialSession.isOpen) {
    ui.showIKStatus(t('err.comNotConnected'), 'error');
    return;
  }
  const cmd = buildSimcomJointCommandString();
  const queue = [{ command: cmd, label: cmd }];
  const btn = document.getElementById('btn-joints-simcom-send');
  const prev = btn?.textContent || t('com.sendBtn');

  isComWriteInProgress = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('com.sendShort');
  }
  try {
    await transmitComCommandQueue(queue, { writeLogFile: false });
  } catch {
    /* mesaj transmit içinde */
  } finally {
    isComWriteInProgress = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }
});

document.getElementById('btn-speed-send')?.addEventListener('click', async () => {
  if (isComWriteInProgress) {
    ui.showIKStatus(t('err.comBusy'), 'error');
    return;
  }
  if (!isWebSerialSupported()) {
    ui.showIKStatus(t('err.noWebSerial'), 'error');
    return;
  }
  if (!serialSession.isOpen) {
    ui.showIKStatus(t('err.comNotConnected'), 'error');
    return;
  }
  const move = ui.getSpeedSettings().moveSpeed;
  const pct = clampSpeedPercent(move, 60);
  const queue = [{ command: `ss${pct}`, label: `ss hız=${pct}%` }];
  const btn = document.getElementById('btn-speed-send');
  const prev = btn?.textContent || t('com.sendBtn');

  isComWriteInProgress = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('com.sendShort');
  }
  try {
    await transmitComCommandQueue(queue, { writeLogFile: false });
  } catch {
    /* mesaj transmit içinde */
  } finally {
    isComWriteInProgress = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }
});

// =================== SCENARIO HANDLERS ===================
document.getElementById('btn-add-step')?.addEventListener('click', () => {
  const speeds = ui.getSpeedSettings();
  scenario.addStep({
    type: 'joint',
    target: { ...state.angles },
    ...speeds,
  });
  syncStepCountElement();
  updateStepProgressDisplay(0, scenario.steps.length);
  updateOutput({ force: true });
  ui.showIKStatus(t('toast.stepAdded', { n: scenario.steps.length }), 'success');
});

document.getElementById('btn-save-json')?.addEventListener('click', () => {
  const json = scenario.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'robot_scenario.json'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-save-output')?.addEventListener('click', () => {
  updateOutput({ force: true });
  const outputText = getOutputPanelText();
  const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'robot_output.txt';
  a.click();
  URL.revokeObjectURL(url);
  ui.showIKStatus(t('toast.outputSaved'), 'success');
});

document.getElementById('file-input-json')?.addEventListener('change', (e) => {
  const input = e.target;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = typeof ev.target?.result === 'string' ? ev.target.result : '';
    try {
      if (scenario.importJSON(text)) {
        syncStepCountElement();
        updateStepProgressDisplay(0, scenario.steps.length);
        updateOutput({ force: true });
        ui.showIKStatus(t('toast.scenarioLoaded'), 'success');
      } else {
        ui.showIKStatus(t('err.badJson'), 'error');
      }
    } finally {
      input.value = '';
    }
  };
  reader.onerror = () => {
    ui.showIKStatus(t('err.fileRead'), 'error');
    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
});

document.getElementById('btn-clear-steps')?.addEventListener('click', () => {
  scenario.clearSteps();
  syncStepCountElement();
  updateStepProgressDisplay(0, 0);
  stepCursor = -1;
  updateOutput({ force: true });
});

document.getElementById('btn-template-eight')?.addEventListener('click', () => {
  generateTemplateTrajectory('eight');
});

document.getElementById('btn-template-plus')?.addEventListener('click', () => {
  generateTemplateTrajectory('plus');
});
document.getElementById('btn-template-bounds')?.addEventListener('click', () => {
  generateTemplateTrajectory('bounds');
});

document.getElementById('btn-gcode-clear')?.addEventListener('click', () => {
  const el = document.getElementById('gcode-input');
  if (el) el.value = '';
});

document.getElementById('btn-gcode-apply')?.addEventListener('click', () => {
  applyGCodeToScenario(false);
});

document.getElementById('btn-gcode-run')?.addEventListener('click', () => {
  applyGCodeToScenario(true);
});

// Playback
document.getElementById('btn-play')?.addEventListener('click', () => {
  startScenarioPlayback();
});
document.getElementById('btn-first-step')?.addEventListener('click', () => {
  jumpToBoundaryStep('first');
});
document.getElementById('btn-prev-step')?.addEventListener('click', () => {
  moveSingleStep(-1);
});
document.getElementById('btn-next-step')?.addEventListener('click', () => {
  moveSingleStep(1);
});
document.getElementById('btn-last-step')?.addEventListener('click', () => {
  jumpToBoundaryStep('last');
});

function startScenarioPlayback() {
  // Play sırasında tracker'ın açıları ezmesini engelle.
  wasAutoIKEnabledBeforePlay = state.autoIK && tracker.enabled;
  if (wasAutoIKEnabledBeforePlay) {
    tracker.disable();
  }

  scenario.onBeforeStepPlay = async (stepIndex, step, startAngles) => {
    const simultane = document.getElementById('player-com-simultane')?.checked;
    if (!simultane) return;
    if (!isWebSerialSupported() || !serialSession.isOpen) {
      ui.showIKStatus(t('warn.simultaneNoCom'), 'warning');
      return;
    }
    const finalAngles = resolveStepFinalAngles(step, startAngles);
    if (!finalAngles) return;
    const queue = buildArduinoQueueForStepMotion(
      { finalAngles, moveSpeed: step.moveSpeed ?? ui.getSpeedSettings().moveSpeed },
      {
        prependStartPos: stepIndex === 0,
        stepLabel: `Adım ${stepIndex + 1}`,
      }
    );
    if (!queue.length) return;
    if (isComWriteInProgress) return;
    isComWriteInProgress = true;
    try {
      await transmitComCommandQueue(queue, { writeLogFile: false });
    } catch {
      /* Hata mesajı transmitComCommandQueue içinde */
    } finally {
      isComWriteInProgress = false;
    }
  };

  planner.onUpdate = (angles, progress) => {
    applyAnglesToRobotAndUI(angles);
    updatePositionDisplay();
    // updateOutput() her frame çağrıldığında ağır IK hesapları nedeniyle player yavaşlıyor.
    // Oynatım sırasında atla; bitişte tek sefer güncelle.
    const slider = document.getElementById('timeline-slider');
    if (slider) slider.value = Math.round(progress * 100);
  };
  planner.onComplete = () => {
    updateStepProgressDisplay(scenario.steps.length, scenario.steps.length);
    updateOutput({ force: true });
    ui.showIKStatus(t('toast.motionDone'), 'success');
  };
  scenario.play(state.angles);
}

scenario.onStepChange = (index) => {
  stepCursor = index;
  updateStepProgressDisplay(index + 1, scenario.steps.length);
};
scenario.onPlayComplete = () => {
  scenario.onBeforeStepPlay = null;
  if (wasAutoIKEnabledBeforePlay) {
    tracker.enable();
    tracker.setTarget(ui.getTargetTCP());
    wasAutoIKEnabledBeforePlay = false;
  }
};

function resolveStepFinalAngles(step, startAngles) {
  if (!step) return null;
  if (step.type === 'joint') return clampAllAngles(step.target || {});
  if (step.type === 'linear') {
    const ik = solveIKWithReachFallback(step.target, startAngles, {
      maxIterations: 120,
      tolerance: 1.2,
      ...(step.ikOptions || {})
    });
    return ik.success ? clampAllAngles(ik.angles) : null;
  }
  return null;
}

function moveSingleStep(direction) {
  if (!scenario.steps.length) {
    ui.showIKStatus(t('err.noSteps'), 'error');
    return;
  }

  scenario.stop();
  planner.stop();

  let targetIndex = direction > 0 ? stepCursor + 1 : stepCursor - 1;
  if (stepCursor < 0 && direction > 0) targetIndex = 0;
  targetIndex = Math.max(0, Math.min(scenario.steps.length - 1, targetIndex));

  const step = scenario.steps[targetIndex];
  const targetAngles = resolveStepFinalAngles(step, state.angles);
  if (!targetAngles) {
    ui.showIKStatus(t('err.stepUnresolved'), 'error');
    return;
  }

  const opts = {
    moveSpeed: step.moveSpeed,
    accelSpeed: step.accelSpeed,
    decelSpeed: step.decelSpeed
  };

  planner.onUpdate = (angles) => {
    applyAnglesToRobotAndUI(angles);
    updatePositionDisplay();
  };
  planner.onComplete = () => {
    stepCursor = targetIndex;
    updateStepProgressDisplay(stepCursor + 1, scenario.steps.length);
    updateOutput({ force: true });
  };
  planner.moveJoint({ ...state.angles }, targetAngles, opts);
}

function jumpToBoundaryStep(which) {
  if (!scenario.steps.length) {
    ui.showIKStatus(t('err.noSteps'), 'error');
    return;
  }

  const targetIndex = which === 'first' ? 0 : scenario.steps.length - 1;
  const step = scenario.steps[targetIndex];
  const targetAngles = resolveStepFinalAngles(step, state.angles);
  if (!targetAngles) {
    ui.showIKStatus(t('err.stepUnresolved'), 'error');
    return;
  }

  scenario.stop();
  planner.stop();

  const opts = {
    moveSpeed: step.moveSpeed,
    accelSpeed: step.accelSpeed,
    decelSpeed: step.decelSpeed
  };

  planner.onUpdate = (angles) => {
    applyAnglesToRobotAndUI(angles);
    updatePositionDisplay();
  };
  planner.onComplete = () => {
    stepCursor = targetIndex;
    updateStepProgressDisplay(stepCursor + 1, scenario.steps.length);
    updateOutput({ force: true });
  };
  planner.moveJoint({ ...state.angles }, targetAngles, opts);
}

document.getElementById('btn-pause')?.addEventListener('click', () => { scenario.pause(); });
document.getElementById('btn-stop')?.addEventListener('click', () => {
  scenario.stop();
  if (wasAutoIKEnabledBeforePlay) {
    tracker.enable();
    tracker.setTarget(ui.getTargetTCP());
    wasAutoIKEnabledBeforePlay = false;
  }
});

// =================== CORE FUNCTIONS ===================

function runIK() {
  const target = ui.getTargetTCP();
  const targetJ4 = ui.getJ4TargetAngle();
  const targetJ5 = ui.getJ5TargetAngle();
  const result = solveIKWithReachFallback(target, state.angles, {
    maxIterations: 320,
    tolerance: 0.7,
    damping: 2.2,
    fixedJ4: targetJ4,
    fixedJ5WorldPitchDeg: targetJ5,
  });

  if (result.success) {
    // IK hedefe giderken mevcut hız ayarlarını kullan
    const speeds = ui.getSpeedSettings();
    planner.onUpdate = (angles) => {
      applyAnglesToRobotAndUI(angles);
      updatePositionDisplay();
      updateOutput();
    };
    planner.onComplete = () => {
      ui.showIKStatus(result.message, 'success');
    };
    planner.moveJoint({ ...state.angles }, clampAllAngles(result.angles), speeds);
  } else {
    ui.showIKStatus(result.message, 'error');
  }
}

/**
 * Hedef erişilemezse, TCP'den hedefe doğru en yakın erişilebilir noktayı bulur.
 * Böylece flanş ucunu sürüklerken hareket kilitlenmez.
 */
function solveIKWithReachFallback(target, startAngles, options = {}) {
  const direct = kinematics.solveIK(target, startAngles, options);
  if (direct.success) return direct;

  const fk = kinematics.computeFK(startAngles);
  const tcp = fk.position;
  const dx = target.x - tcp.x;
  const dy = target.y - tcp.y;
  const dz = target.z - tcp.z;

  // Hedefe doğru kademeli yaklaş; ilk başarıda dur.
  const alphas = [0.9, 0.75, 0.6, 0.45, 0.3, 0.2, 0.12, 0.06];
  let bestAttempt = direct;
  for (const a of alphas) {
    const fallbackTarget = {
      x: tcp.x + dx * a,
      y: tcp.y + dy * a,
      z: tcp.z + dz * a,
    };
    const attempt = kinematics.solveIK(fallbackTarget, startAngles, options);
    if (!bestAttempt || attempt.error < bestAttempt.error) {
      bestAttempt = attempt;
    }
    if (attempt.success) return attempt;
  }

  // Tam çözüm yoksa en iyi yaklaşımı döndür; sürükleme akışı kilitlenmesin.
  if (bestAttempt && Number.isFinite(bestAttempt.error) && bestAttempt.error < (direct.error || Infinity)) {
    return {
      ...bestAttempt,
      success: true,
      message: bestAttempt.message || t('ik.approxFallback')
    };
  }

  return direct;
}

function animateToAngles(targetAngles) {
  const speeds = ui.getSpeedSettings();
  planner.onUpdate = (angles, progress) => {
    applyAnglesToRobotAndUI(angles);
    updatePositionDisplay();
    updateOutput();
  };
  planner.onComplete = () => {
    ui.showIKStatus(t('toast.motionDone'), 'success');
  };
  planner.moveJoint({ ...state.angles }, targetAngles, speeds);
}

function mapTemplatePoint(center, u, v) {
  // Plotter alanı:
  // - Zemin üstünde sabit 20mm (Y=20)
  // - J2+ yönü ileri kabul edilir (simde yaklaşık -Z)
  // - Çalışma alanı: 300mm x 300mm
  const x = Math.max(PLOTTER_X_MIN, Math.min(PLOTTER_X_MAX, center.x + u));
  const z = Math.max(PLOTTER_Z_MIN, Math.min(PLOTTER_Z_MAX, center.z - v));
  return {
    x,
    y: PLOTTER_Y,
    z,
  };
}

function samplePolyline(points, targetCount) {
  if (points.length < 2) return points;
  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dz = points[i].z - points[i - 1].z;
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    lengths.push(total);
  }
  const result = [];
  const n = Math.max(2, targetCount);
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    let idx = 1;
    while (idx < lengths.length && lengths[idx] < d) idx++;
    const i1 = Math.max(1, idx);
    const i0 = i1 - 1;
    const span = Math.max(1e-9, lengths[i1] - lengths[i0]);
    const t = (d - lengths[i0]) / span;
    result.push({
      x: points[i0].x + (points[i1].x - points[i0].x) * t,
      y: points[i0].y + (points[i1].y - points[i0].y) * t,
      z: points[i0].z + (points[i1].z - points[i0].z) * t,
    });
  }
  return result;
}

function sampleSegment(p0, p1, count) {
  const n = Math.max(2, count);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
      z: p0.z + (p1.z - p0.z) * t,
    });
  }
  return pts;
}

function getTemplatePoints(type, center, templateSettings) {
  const sizeX = templateSettings.sizeX;
  const sizeZ = templateSettings.sizeZ;
  const steps = Math.max(2, templateSettings.steps);
  // Plotter çalışma alanı (300x300) içinde merkez:
  // X: [-150, 150], Z: [-300, 0]
  // Varsayılan merkez ileri bölgede: (0, -150)
  const plotterCenter = {
    x: Math.max(PLOTTER_X_MIN, Math.min(PLOTTER_X_MAX, Number.isFinite(center.x) ? center.x : 0)),
    y: PLOTTER_Y,
    z: Math.max(PLOTTER_Z_MIN, Math.min(PLOTTER_Z_MAX, Number.isFinite(center.z) ? center.z : -150)),
  };

  if (type === 'bounds') {
    // Sınır şablonu: net 4 kenarlı dörgen (köşe-köşe, kapalı yol)
    return [
      { x: BOUNDS_TEMPLATE_X1, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z1 },
      { x: BOUNDS_TEMPLATE_X2, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z1 },
      { x: BOUNDS_TEMPLATE_X2, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z2 },
      { x: BOUNDS_TEMPLATE_X1, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z2 },
      { x: BOUNDS_TEMPLATE_X1, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z1 },
    ];
  }

  if (type === 'eight') {
    const pts = [];
    const a = sizeX / 2;
    const b = sizeZ / 2;
    const samples = steps;
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const u = a * Math.sin(t);
      const v = b * Math.sin(2 * t);
      pts.push(mapTemplatePoint(plotterCenter, u, v));
    }
    return pts;
  }

  // plus
  const rx = sizeX / 2;
  const rz = sizeZ / 2;
  const top = mapTemplatePoint(plotterCenter, 0, rz);
  const bottom = mapTemplatePoint(plotterCenter, 0, -rz);
  const left = mapTemplatePoint(plotterCenter, -rx, 0);
  const right = mapTemplatePoint(plotterCenter, rx, 0);

  // İki çizgi vuruşu: dikey ve yatay (merkezde kesişim)
  const verticalCount = Math.max(2, Math.floor(steps / 2));
  const horizontalCount = Math.max(2, steps - verticalCount);
  const vertical = sampleSegment(top, bottom, verticalCount);
  const centerPoint = mapTemplatePoint(plotterCenter, 0, 0);
  // Artı işaretini çapraz kaçmadan tek sürekli yol olarak çiz:
  // top -> center -> bottom -> center -> left -> center -> right
  const hHalf = Math.max(2, Math.floor(horizontalCount / 2) + 1);
  const centerToLeft = sampleSegment(centerPoint, left, hHalf);
  const leftToCenter = sampleSegment(left, centerPoint, hHalf);
  const centerToRight = sampleSegment(centerPoint, right, Math.max(2, horizontalCount - hHalf + 2));

  const rawPath = [
    ...vertical,
    ...sampleSegment(bottom, centerPoint, Math.max(2, Math.floor(verticalCount / 2))).slice(1),
    ...centerToLeft.slice(1),
    ...leftToCenter.slice(1),
    ...centerToRight.slice(1),
  ];
  // Şablon adım sayısı her zaman kullanıcı girdisiyle birebir eşleşsin.
  return samplePolyline(rawPath, steps);
}

function generateTemplateTrajectory(type) {
  const center = ui.getTargetTCP();
  const templateSettings = ui.getTemplateSettings();
  const points = getTemplatePoints(type, center, templateSettings);
  const speeds = ui.getSpeedSettings();
  // Plotter kafası: J5 daima yere doğru baksın.
  const plotterIkOptions = { fixedJ5WorldPitchDeg: -90 };

  scenario.clearSteps();

  if (type === 'bounds' && points.length >= 2) {
    // Sınır şablonu için kenarlar mutlaka eksenlere paralel kalsın:
    // köşe yolunu adım sayısına göre yeniden örnekle, sonra IK ile joint'e çevir.
    const closedCorners = [
      { x: BOUNDS_TEMPLATE_X1, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z1 },
      { x: BOUNDS_TEMPLATE_X2, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z1 },
      { x: BOUNDS_TEMPLATE_X2, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z2 },
      { x: BOUNDS_TEMPLATE_X1, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z2 },
      { x: BOUNDS_TEMPLATE_X1, y: PLOTTER_Y, z: BOUNDS_TEMPLATE_Z1 },
    ];
    const cartesianPath = samplePolyline(closedCorners, Math.max(8, templateSettings.steps));

    let currentAngles = { ...state.angles };
    const fixedJ1 = state.angles.j1;
    let failCount = 0;
    for (const p of cartesianPath) {
      const ik = solveIKWithReachFallback(p, currentAngles, {
        maxIterations: 120,
        tolerance: 1.2,
        ...plotterIkOptions,
        fixedJ1
      });
      if (ik.success) {
        currentAngles = clampAllAngles(ik.angles);
      } else {
        failCount++;
      }
      scenario.addStep({
        type: 'joint',
        target: { ...currentAngles },
        moveSpeed: speeds.moveSpeed,
        accelSpeed: speeds.accelSpeed,
        decelSpeed: speeds.decelSpeed,
        label: 'Bounds edge'
      });
    }
    syncStepCountElement();
    updateStepProgressDisplay(0, scenario.steps.length);
    stepCursor = -1;
    updateOutput({ force: true });
    if (failCount > 0) {
      ui.showIKStatus(
        t('template.boundsApprox', { steps: scenario.steps.length, fail: failCount }),
        'success',
      );
    } else {
      ui.showIKStatus(t('template.boundsOk', { steps: scenario.steps.length }), 'success');
    }
    return;
  }

  let currentAngles = { ...state.angles };

  for (const p of points) {
    // Erişilebilirlik ön kontrolü (akış sürekliliği için)
    const ik = solveIKWithReachFallback(p, currentAngles, {
      maxIterations: 120,
      tolerance: 1.2,
      ...plotterIkOptions
    });
    if (ik.success) {
      currentAngles = clampAllAngles(ik.angles);
    }
    // Oynatımda bozulma/kararsızlık olmaması için şablonu precomputed joint olarak kaydet.
    scenario.addStep({
      type: 'joint',
      target: { ...currentAngles },
      moveSpeed: speeds.moveSpeed,
      accelSpeed: speeds.accelSpeed,
      decelSpeed: speeds.decelSpeed,
      label: type === 'eight' ? 'Eight step' : type === 'plus' ? 'Plus step' : 'Bounds step'
    });
  }

  syncStepCountElement();
  updateStepProgressDisplay(0, scenario.steps.length);
  stepCursor = -1;
  updateOutput({ force: true });
  const typeLabel =
    type === 'eight' ? t('template.labelEight') : type === 'plus' ? t('template.labelPlus') : t('template.labelBounds');
  ui.showIKStatus(t('template.created', { label: typeLabel, steps: scenario.steps.length }), 'success');
}

function updateStepProgressDisplay(currentIndex, totalSteps) {
  const el = document.getElementById('timeline-time');
  if (!el) return;
  const total = Math.max(0, totalSteps || 0);
  if (total === 0) {
    el.textContent = '0/0';
    return;
  }
  const current = Math.min(total, Math.max(1, currentIndex || 1));
  el.textContent = `${current}/${total}`;
}

function parseGCode(gcodeText, startPos) {
  const lines = gcodeText.split(/\r?\n/);
  const moves = [];
  let absoluteMode = true; // G90 default
  let feed = 1200;
  let current = { ...startPos };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\(.*?\)/g, '');
    const line = raw.split(';')[0].trim().toUpperCase();
    if (!line) continue;

    const codeMatch = line.match(/\bG(\d+)\b/);
    if (!codeMatch) continue;
    const g = parseInt(codeMatch[1], 10);

    if (g === 90) { absoluteMode = true; continue; }
    if (g === 91) { absoluteMode = false; continue; }
    if (g !== 0 && g !== 1) continue;

    const xMatch = line.match(/\bX(-?\d+(\.\d+)?)\b/);
    const yMatch = line.match(/\bY(-?\d+(\.\d+)?)\b/);
    const zMatch = line.match(/\bZ(-?\d+(\.\d+)?)\b/);
    const fMatch = line.match(/\bF(\d+(\.\d+)?)\b/);

    if (fMatch) {
      feed = parseFloat(fMatch[1]);
    }

    const next = { ...current };
    if (xMatch) next.x = absoluteMode ? parseFloat(xMatch[1]) : current.x + parseFloat(xMatch[1]);
    if (yMatch) next.y = absoluteMode ? parseFloat(yMatch[1]) : current.y + parseFloat(yMatch[1]);
    if (zMatch) next.z = absoluteMode ? parseFloat(zMatch[1]) : current.z + parseFloat(zMatch[1]);

    if (!xMatch && !yMatch && !zMatch) continue;

    moves.push({
      line: i + 1,
      g,
      target: next,
      feed
    });
    current = next;
  }

  return moves;
}

function feedToMoveSpeed(feed) {
  // Basit doğrusal map: 100..3000 mm/dk => 5..100
  const minF = 100;
  const maxF = 3000;
  const clamped = Math.max(minF, Math.min(maxF, feed || 1200));
  return Math.round(5 + ((clamped - minF) / (maxF - minF)) * 95);
}

function applyGCodeToScenario(autoRun) {
  const gcode = document.getElementById('gcode-input')?.value || '';
  if (!gcode.trim()) {
    ui.showIKStatus(t('err.gcodeEmpty'), 'error');
    return;
  }

  const startPos = ui.getTargetTCP();
  const speeds = ui.getSpeedSettings();
  const moves = parseGCode(gcode, startPos);

  if (moves.length === 0) {
    ui.showIKStatus(t('err.gcodeNoMoves'), 'error');
    return;
  }

  scenario.clearSteps();
  for (const move of moves) {
    scenario.addStep({
      type: 'linear',
      target: move.target,
      moveSpeed: feedToMoveSpeed(move.feed),
      accelSpeed: speeds.accelSpeed,
      decelSpeed: speeds.decelSpeed,
      label: `G${move.g} L${move.line}`
    });
  }

  syncStepCountElement();
  updateStepProgressDisplay(0, scenario.steps.length);
  stepCursor = -1;
  updateOutput({ force: true });
  ui.showIKStatus(t('toast.gcodeImported', { n: scenario.steps.length }), 'success');

  if (autoRun) {
    startScenarioPlayback();
  }
}

function setInitialTargetPosition() {
  const p = { x: 0, y: 140, z: 0 };
  targetMarker.position.set(p.x, p.y, p.z);
  ui.setTargetTCP(p);
  tracker.setTarget(p);
}

function updatePositionDisplay() {
  const fk = kinematics.computeFK(state.angles);
  ui.updatePosition(fk.position, fk.orientation);
}

function updateOutput(options = {}) {
  const force = options.force === true;
  if (!force && outputPanelUserEdited) return;
  if (force) outputPanelUserEdited = false;
  const speeds = ui.getSpeedSettings();
  ui.updateOutput(buildScenarioOutputText(speeds.moveSpeed));
}

/**
 * Senaryo adımlarından üretilen hareket zinciri — çıktı metni ve COM komutları aynı kaynağı kullanır.
 */
function enumerateScenarioMotions(defaultMoveSpeed) {
  const steps = scenario.steps || [];
  const fmt = (v) => roundTo(v || 0, 2).toFixed(2);
  const toStrArr = (angles) => ROBOT_CONFIG.jointKeys.map((k) => fmt(angles[k]));
  const motions = [];

  if (!steps.length) {
    const a = clampAllAngles({ ...state.angles });
    const arr = toStrArr(a);
    motions.push({
      jInitial: arr,
      jFinal: arr,
      finalAngles: { ...a },
      moveSpeed: clampSpeedPercent(defaultMoveSpeed, 60)
    });
    return motions;
  }

  let previousTarget = { ...state.angles };
  for (const step of steps) {
    let finalAngles = null;
    if (step.type === 'joint') {
      finalAngles = clampAllAngles(step.target || {});
    } else if (step.type === 'linear') {
      const ik = solveIKWithReachFallback(
        step.target,
        previousTarget,
        {
          maxIterations: 120,
          tolerance: 1.2,
          ...(step.ikOptions || {})
        }
      );
      if (!ik.success) continue;
      finalAngles = clampAllAngles(ik.angles);
    } else {
      continue;
    }

    motions.push({
      jInitial: toStrArr(previousTarget),
      jFinal: toStrArr(finalAngles),
      finalAngles: { ...finalAngles },
      moveSpeed: clampSpeedPercent(step.moveSpeed ?? defaultMoveSpeed, defaultMoveSpeed)
    });
    previousTarget = { ...finalAngles };
  }

  return motions;
}

function buildScenarioOutputText(defaultMoveSpeed) {
  const motions = enumerateScenarioMotions(defaultMoveSpeed);
  const lines = motions.map((m) => formatSimcomFromAngles(m.finalAngles));
  return lines.join('\n').trim();
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateForFileName(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function createComWriteLogSession(totalCommands) {
  const fileName = `com_write_log_${formatDateForFileName()}.txt`;
  const headerLines = [
    '# Robot COM Write Log',
    `# Started: ${new Date().toISOString()}`,
    `# Command Count: ${totalCommands}`,
    '# ----------------------------------------'
  ];
  const seed = `${headerLines.join('\n')}\n`;
  const session = {
    fileName,
    lines: [...headerLines],
    writable: null,
    useDownloadFallback: false
  };

  try {
    if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Text files',
          accept: { 'text/plain': ['.txt'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(seed);
      session.writable = writable;
      return session;
    }
  } catch (_) {
    // Kullanıcı picker'ı iptal edebilir; bu durumda indirme fallback'i kullan.
  }

  session.useDownloadFallback = true;
  return session;
}

async function appendComWriteLog(session, line) {
  if (!session || !line) return;
  session.lines.push(line);
  if (session.writable) {
    await session.writable.write(`${line}\n`);
  }
}

async function finalizeComWriteLog(session) {
  if (!session) return;
  const footer = `# Ended: ${new Date().toISOString()}`;
  session.lines.push(footer);
  try {
    if (session.writable) {
      await session.writable.write(`${footer}\n`);
      await session.writable.close();
    } else if (session.useDownloadFallback) {
      downloadTextFile(session.fileName, `${session.lines.join('\n')}\n`);
    }
  } catch {
    // Log kaydı akışı COM gönderimini bozmamalı.
  }
}

function formatArduinoNumber(value) {
  return roundTo(Number.isFinite(value) ? value : 0, 2).toFixed(2);
}

function clampSpeedPercent(value, fallback) {
  const raw = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Tek adım hareketi → COM kuyruğu (çıktı ile aynı: simcom0.00,3.56,…). */
function buildArduinoQueueForStepMotion(motion, options = {}) {
  const prependStartPos = options.prependStartPos === true;
  const stepLabel = options.stepLabel || '';
  const queue = [];
  if (prependStartPos) {
    queue.push({ command: 'startpos', label: 'Start pozisyonu' });
  }
  const angles = clampAllAngles(motion.finalAngles || {});
  const cmd = formatSimcomFromAngles(angles).replace(/\s+/g, '');
  queue.push({
    command: cmd,
    label: stepLabel ? `${stepLabel} ${cmd}` : cmd,
  });
  return queue;
}

function buildArduinoQueueFromMotions(motions, options = {}) {
  const prependStartPos = options.prependStartPos !== false;
  const queue = [];
  for (let i = 0; i < motions.length; i++) {
    const chunk = buildArduinoQueueForStepMotion(motions[i], {
      prependStartPos: prependStartPos && i === 0,
      stepLabel: `Adım ${i + 1}`,
    });
    queue.push(...chunk);
  }
  return queue;
}

function parseJointFloatsInner(inner) {
  const parts = inner.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const nums = parts.map((s) => parseFloat(s)).filter((n) => Number.isFinite(n));
  return nums;
}

/** Çıktı panelindeki goStrightLine bloklarını okur (COM ile birebir aynı hareket sayısı). */
function parseGoStraightMotionsFromOutputText(text) {
  const motions = [];
  // Jfinal ile goStrightLine arasında boş satır olabilir
  const re = /float\s+Jfinal\[6\]\s*=\s*\{\s*([^}]+)\}\s*;[\s\S]*?goStrightLine\s*\(\s*Jinitial\s*,\s*Jfinal\s*,\s*([\d.]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const nums = parseJointFloatsInner(m[1]);
    const speed = parseFloat(m[2]);
    if (nums.length !== 6 || !Number.isFinite(speed)) continue;
    const fa = {};
    ROBOT_CONFIG.jointKeys.forEach((k, i) => {
      fa[k] = nums[i];
    });
    motions.push({
      finalAngles: clampAllAngles(fa),
      moveSpeed: clampSpeedPercent(speed, 60)
    });
  }
  return motions;
}

/** goStrightLine üretimi yoksa: satırları doğrulamadan COM'a uygun tek komut dizisine çevirir. */
function parseTextLinesToComQueuePassthrough(text) {
  const queue = [];
  for (let raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    const cIdx = line.indexOf('#');
    if (cIdx >= 0) line = line.slice(0, cIdx).trim();
    const semi = line.indexOf(';');
    if (semi >= 0) line = line.slice(0, semi).trim();
    if (!line) continue;
    const cmd = line.replace(/\s+/g, '');
    queue.push({ command: cmd, label: line });
  }
  return queue;
}

/** COM satırı mı (C kaynak / yorum satırlarını elemek için) */
function isKnownSerialCommandString(cmd) {
  const c = String(cmd || '').replace(/\s+/g, '');
  if (!c) return false;
  if (c === 'startpos' || /^home$/i.test(c)) return true;
  if (/^ss\d{1,3}$/i.test(c)) return true;
  if (/^s[1-6]-?\d/.test(c)) return true;
  if (/^simcom[\d.,-]+/i.test(c)) return true;
  return false;
}

/**
 * Çıktı paneli metninden COM kuyruğu: önce eski goStrightLine blokları (GERİYE UYUM),
 * yoksa satır satır (simcom… ve diğer komutlar).
 * Blok + ek satır karışımında: bloktan üretilen komutlarda olmayan tanınmış satır komutları sonda eklenir.
 */
function parseOutputTextToArduinoQueue(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalized.trim();
  if (!trimmed) return [];

  const lineQueue = parseTextLinesToComQueuePassthrough(trimmed);
  const fromStraight = parseGoStraightMotionsFromOutputText(trimmed);

  if (fromStraight.length === 0) {
    return lineQueue;
  }

  const motionQueue = buildArduinoQueueFromMotions(fromStraight, { prependStartPos: true });
  const builtSet = new Set(motionQueue.map((item) => item.command));
  const tailExtras = lineQueue.filter(
    (item) => !builtSet.has(item.command) && isKnownSerialCommandString(item.command)
  );
  return tailExtras.length ? [...motionQueue, ...tailExtras] : motionQueue;
}

/** COM'dan home / startpos satırı gittiğinde 3D simülatörü aynı konfig pozisyonuna götürür. */
async function syncSimulationToPresetComCommand(rawCmd) {
  const c = String(rawCmd || '').replace(/\s+/g, '').toLowerCase();
  let target = null;
  if (c === 'home') target = clampAllAngles({ ...ROBOT_CONFIG.homePosition });
  else if (c === 'startpos') target = clampAllAngles({ ...ROBOT_CONFIG.startPosition });
  else return;

  planner.stop();
  // Senaryo Simultane sırasında COM'daki startpos/home senkronu scenario.stop etmesin (oynatma iptal olur).
  if (!scenario.isPlaying) {
    scenario.stop();
  }
  const prevUpdate = planner.onUpdate;
  const prevComplete = planner.onComplete;
  const speeds = ui.getSpeedSettings();
  try {
    await new Promise((resolve, reject) => {
      planner.onUpdate = (angles, progress) => {
        applyAnglesToRobotAndUI(angles);
        updatePositionDisplay();
        updateOutput();
      };
      planner.onComplete = () => resolve();
      try {
        planner.moveJoint({ ...state.angles }, target, speeds);
      } catch (e) {
        reject(e);
      }
    });
  } catch {
    /* COM yine de gönderildi; sim hareketi atlanır */
  } finally {
    planner.onUpdate = prevUpdate;
    planner.onComplete = prevComplete;
  }
}

async function transmitComCommandQueue(queue, options = {}) {
  const totalCommands = queue.length;
  const commandGapMs = 1100;
  const writeLogFile = options.writeLogFile !== false;

  let logSession = null;
  if (writeLogFile) {
    logSession = await createComWriteLogSession(totalCommands);
  }

  const comLineEnding = readComSettingsFromForm().lineEnding;
  const writeLineEnding = comLineEnding === 'none' ? 'lf' : comLineEnding;

  try {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      await serialSession.writeText(item.command, writeLineEnding);
      await syncSimulationToPresetComCommand(item.command);
      if (writeLogFile && logSession) {
        await appendComWriteLog(logSession, `[TX ${i + 1}/${totalCommands}] ${item.command} ; ${item.label}`);
      }
      ui.showIKStatus(t('com.progress', { i: i + 1, total: totalCommands, label: item.label }), 'info');
      if (i < queue.length - 1) {
        await waitMs(commandGapMs);
      }
    }
    if (writeLogFile && logSession) {
      await appendComWriteLog(logSession, `[OK] ${new Date().toISOString()} - ${t('log.comSendDone')}`);
    }
    ui.showIKStatus(t('toast.comSent', { n: totalCommands }), 'success');
  } catch (err) {
    if (writeLogFile && logSession) {
      await appendComWriteLog(logSession, `[ERR] ${new Date().toISOString()} - ${err?.message || t('err.comSend')}`);
    }
    ui.showIKStatus(err?.message || t('err.comSend'), 'error');
    throw err;
  } finally {
    if (writeLogFile && logSession) {
      await finalizeComWriteLog(logSession);
    }
  }
}

// =================== ANIMATION LOOP ===================
let frameCount = 0;
let lastFPSTime = performance.now();
let trackFrameCounter = 0;

function animate() {
  requestAnimationFrame(animate);

  // FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFPSTime >= 1000) {
    ui.updateFPS(frameCount);
    frameCount = 0;
    lastFPSTime = now;
  }

  // Tracking update (closed-loop)
  if (!isDraggingTCP && state.autoIK && tracker.enabled) {
    trackFrameCounter++;
    const newAngles = tracker.update(state.angles);
    if (newAngles !== state.angles) {
      state.angles = clampAllAngles(newAngles);
      robot.setAngles(state.angles);
      state.manualJointTarget = { ...state.angles };
      // Throttle UI updates (DOM is expensive) — every 3rd frame
      if (trackFrameCounter % 3 === 0) {
        ui.updateAngles(state.angles);
        updatePositionDisplay();
        updateOutput();
      }
    }
  }

  // Kontrol paneli slider: programatik hareket / Auto IK / senaryo / sürükleme yokken hedefe yumuşak yaklaş
  const busyPlaying = planner.isPlaying || scenario.isPlaying;
  if (
    !isDraggingTCP &&
    !busyPlaying &&
    !(state.autoIK && tracker.enabled)
  ) {
    let moved = false;
    for (const key of ROBOT_CONFIG.jointKeys) {
      const tgt = state.manualJointTarget[key];
      const cur = state.angles[key];
      const diff = tgt - cur;
      if (Math.abs(diff) < 0.02) {
        if (Math.abs(diff) > 1e-6) {
          state.angles[key] = tgt;
          moved = true;
        }
      } else {
        state.angles[key] = clampAngle(key, cur + diff * MANUAL_JOINT_LERP);
        moved = true;
      }
    }
    if (moved) {
      state.angles = clampAllAngles(state.angles);
      robot.setAngles(state.angles);
      ui.updateAngles(state.angles, { skipSliders: true });
      updatePositionDisplay();
      updateOutput();
    }
  }

  orbitControls.update();
  updateCameraAngleDisplay();

  // TCP handle senkronizasyonu — sürüklemiyorken robot ucuna yapış
  if (!isDraggingTCP) {
    const fk = kinematics.computeFK(state.angles);
    tcpHandle.position.set(fk.position.x, fk.position.y, fk.position.z);
  }

  if (targetAxisGizmo.visible && !isDraggingTarget) {
    targetAxisGizmo.position.copy(targetMarker.position);
  }

  renderer.render(scene, camera);
}

// =================== RESIZE ===================
function onResize() {
  const rect = container.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height);
}
window.addEventListener('resize', onResize);
onResize();
setInitialTargetPosition();

// =================== START ===================
updateOutput({ force: true });
syncStepCountElement();
updateStepProgressDisplay(0, scenario.steps.length);
updateCameraAngleDisplay();
animate();
console.log('🤖 6-DOF Robot Simülatörü başlatıldı');
