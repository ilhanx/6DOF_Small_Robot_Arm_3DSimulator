/**
 * robot.js — 3D Robot Modeli (Three.js)
 * 
 * ABB IRB 120 benzeri 6-DOF robot kol
 * R-P-P-R-P-R konfigürasyonu:
 *   J1: Base Roll (Y)
 *   J2: Omuz Pitch (Z)
 *   J3: Dirsek Pitch (X)
 *   J4: Ön Kol Roll (Y)
 *   J5: Bilek Pitch (X)
 *   J6: Flanş Roll (Y)
 */

import * as THREE from 'three';
import { ROBOT_CONFIG, deg2rad } from './config.js';

export class RobotArm {
  constructor(scene) {
    this.scene = scene;
    this.joints = [];       // 6 adet Three.js Group (dönüş noktaları)
    this.linkMeshes = [];   // Görsel mesh referansları
    this.rootGroup = null;
    this.createRobot();
  }

  createRobot() {
    const cfg = ROBOT_CONFIG;
    const colors = cfg.bodyColors;

    // Malzemeler
    const orangeMat = new THREE.MeshStandardMaterial({
      color: colors.primary,
      metalness: 0.3,
      roughness: 0.6,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: colors.accent,
      metalness: 0.5,
      roughness: 0.4,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: colors.metal,
      metalness: 0.7,
      roughness: 0.3,
    });
    const blackMat = new THREE.MeshStandardMaterial({
      color: colors.joint,
      metalness: 0.4,
      roughness: 0.5,
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: colors.endEffector,
      metalness: 0.3,
      roughness: 0.5,
    });

    // Kök grup
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // ============ ZEMIN PLATFORMU ============
    const basePlate = new THREE.Mesh(
      new THREE.BoxGeometry(50, 5, 50),
      darkMat
    );
    basePlate.position.y = -2.5;
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    this.rootGroup.add(basePlate);

    // ============ J1 — BASE (Roll, Y ekseni) ============
    const j1 = new THREE.Group();
    j1.position.y = 0;
    this.rootGroup.add(j1);
    this.joints.push(j1);

    // Base gövdesi — silindirik kasnak
    const baseBody = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 22, 22, 24),
      orangeMat
    );
    baseBody.position.y = 11;
    baseBody.castShadow = true;
    j1.add(baseBody);

    // Base kasnak diski (üst)
    const basePulleyDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 18, 3, 24),
      blackMat
    );
    basePulleyDisc.position.y = 23;
    basePulleyDisc.castShadow = true;
    j1.add(basePulleyDisc);

    // Base → Omuz bağlantı boynu (boşluğu kapatır)
    const baseNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 16, 12, 20),
      orangeMat
    );
    baseNeck.position.y = 29;
    baseNeck.castShadow = true;
    j1.add(baseNeck);

    // Base motor gövdesi (yan)
    const baseMotor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 15, 12),
      metalMat
    );
    baseMotor.position.set(22, 8, 0);
    baseMotor.castShadow = true;
    j1.add(baseMotor);

    // ============ J2 — OMUZ (Pitch, Z ekseni) ============
    // Çatal yapısı — Base'in üstünde iki dikey plaka
    const j2 = new THREE.Group();
    j2.position.y = cfg.linkLengths.base_height;
    j1.add(j2);
    this.joints.push(j2);

    // Sol çatal plakası
    const forkLeft2 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 30, 16),
      orangeMat
    );
    forkLeft2.position.set(-10, 15, 0);
    forkLeft2.castShadow = true;
    j2.add(forkLeft2);

    // Sağ çatal plakası
    const forkRight2 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 30, 16),
      orangeMat
    );
    forkRight2.position.set(10, 15, 0);
    forkRight2.castShadow = true;
    j2.add(forkRight2);

    // Omuz kasnak diski (sol)
    const shoulderPulleyL = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 3, 20),
      blackMat
    );
    shoulderPulleyL.rotation.z = Math.PI / 2;
    shoulderPulleyL.position.set(-12, 0, 0);
    shoulderPulleyL.castShadow = true;
    j2.add(shoulderPulleyL);

    // Omuz kasnak diski (sağ)
    const shoulderPulleyR = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 3, 20),
      blackMat
    );
    shoulderPulleyR.rotation.z = Math.PI / 2;
    shoulderPulleyR.position.set(12, 0, 0);
    shoulderPulleyR.castShadow = true;
    j2.add(shoulderPulleyR);

    // Omuz aksı (çatal arasından geçen mil)
    const shoulderAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 28, 12),
      metalMat
    );
    shoulderAxle.rotation.z = Math.PI / 2;
    shoulderAxle.position.set(0, 0, 0);
    j2.add(shoulderAxle);

    // Üst kol gövdesi — iki paralel plaka (sandviç)
    const upperArmLeft = new THREE.Mesh(
      new THREE.BoxGeometry(3, cfg.linkLengths.upper_arm, 14),
      orangeMat
    );
    upperArmLeft.position.set(-8, cfg.linkLengths.upper_arm / 2, 0);
    upperArmLeft.castShadow = true;
    j2.add(upperArmLeft);

    const upperArmRight = new THREE.Mesh(
      new THREE.BoxGeometry(3, cfg.linkLengths.upper_arm, 14),
      orangeMat
    );
    upperArmRight.position.set(8, cfg.linkLengths.upper_arm / 2, 0);
    upperArmRight.castShadow = true;
    j2.add(upperArmRight);

    // Üst kol bağlantı plakaları (üst ve alt)
    const upperArmBraceBottom = new THREE.Mesh(
      new THREE.BoxGeometry(20, 6, 14),
      orangeMat
    );
    upperArmBraceBottom.position.set(0, 8, 0);
    upperArmBraceBottom.castShadow = true;
    j2.add(upperArmBraceBottom);

    const upperArmBraceTop = new THREE.Mesh(
      new THREE.BoxGeometry(20, 6, 14),
      orangeMat
    );
    upperArmBraceTop.position.set(0, cfg.linkLengths.upper_arm - 8, 0);
    upperArmBraceTop.castShadow = true;
    j2.add(upperArmBraceTop);

    // ============ J3 — DİRSEK (Pitch, X ekseni) ============
    // Üst kolun ucundaki çatal içinde yukarı/aşağı
    const j3 = new THREE.Group();
    j3.position.y = cfg.linkLengths.upper_arm;
    j2.add(j3);
    this.joints.push(j3);

    // Dirsek kasnak diski
    const elbowPulleyL = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 3, 20),
      blackMat
    );
    elbowPulleyL.rotation.z = Math.PI / 2;
    elbowPulleyL.position.set(-10, 0, 0);
    elbowPulleyL.castShadow = true;
    j3.add(elbowPulleyL);

    const elbowPulleyR = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 3, 20),
      blackMat
    );
    elbowPulleyR.rotation.z = Math.PI / 2;
    elbowPulleyR.position.set(10, 0, 0);
    elbowPulleyR.castShadow = true;
    j3.add(elbowPulleyR);

    // Dirsek aksı
    const elbowAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 24, 12),
      metalMat
    );
    elbowAxle.rotation.z = Math.PI / 2;
    j3.add(elbowAxle);

    // ============ J4 — ÖN KOL ROLL (Roll, Y ekseni) ============
    // Silindirik ön kol — kendi ekseni etrafında döner
    const j4 = new THREE.Group();
    j4.position.y = cfg.linkLengths.forearm_main;
    j3.add(j4);
    this.joints.push(j4);

    // Ön kol silindir gövdesi (J3'ten J4'e kadar)
    const forearmBody = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 10, cfg.linkLengths.forearm_main - 5, 16),
      orangeMat
    );
    forearmBody.position.y = -(cfg.linkLengths.forearm_main - 5) / 2;
    forearmBody.castShadow = true;
    j4.add(forearmBody);

    // Ön kol kasnak diski
    const forearmPulley = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 3, 20),
      blackMat
    );
    forearmPulley.position.y = -cfg.linkLengths.forearm_main + 5;
    forearmPulley.castShadow = true;
    j4.add(forearmPulley);

    // Ön kol uç çatalı (J5 için)
    const forkLeft5 = new THREE.Mesh(
      new THREE.BoxGeometry(3, 18, 10),
      orangeMat
    );
    forkLeft5.position.set(-7, 9, 0);
    forkLeft5.castShadow = true;
    j4.add(forkLeft5);

    const forkRight5 = new THREE.Mesh(
      new THREE.BoxGeometry(3, 18, 10),
      orangeMat
    );
    forkRight5.position.set(7, 9, 0);
    forkRight5.castShadow = true;
    j4.add(forkRight5);

    // ============ J5 — BİLEK (Pitch, X ekseni) ============
    // Ön kolun çatalı içinde yukarı/aşağı
    const j5 = new THREE.Group();
    j5.position.y = cfg.linkLengths.wrist_body;
    j4.add(j5);
    this.joints.push(j5);

    // Bilek kasnak diski
    const wristPulley = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 3, 16),
      blackMat
    );
    wristPulley.rotation.z = Math.PI / 2;
    wristPulley.castShadow = true;
    j5.add(wristPulley);

    // Bilek aksı
    const wristAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 18, 12),
      metalMat
    );
    wristAxle.rotation.z = Math.PI / 2;
    j5.add(wristAxle);

    // Bilek gövdesi
    const wristBody = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 12, 16),
      orangeMat
    );
    wristBody.position.y = 6;
    wristBody.castShadow = true;
    j5.add(wristBody);

    // ============ J6 — FLANŞ (Roll, Y ekseni) ============
    // Bileğin içindeki step motor ile 360 derece
    const j6 = new THREE.Group();
    j6.position.y = cfg.linkLengths.flange;
    j5.add(j6);
    this.joints.push(j6);

    // Flanş diski
    const flangeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 7, 4, 20),
      metalMat
    );
    flangeDisc.position.y = 2;
    flangeDisc.castShadow = true;
    j6.add(flangeDisc);

    // Flanş motor gövdesi (küçük silindir)
    const flangeMotor = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 8, 12),
      darkMat
    );
    flangeMotor.position.y = -2;
    flangeMotor.castShadow = true;
    j6.add(flangeMotor);

    // End-effector işaretçisi (küçük kırmızı koni)
    const eeTip = new THREE.Mesh(
      new THREE.ConeGeometry(3, 8, 8),
      redMat
    );
    eeTip.position.y = 8;
    eeTip.castShadow = true;
    j6.add(eeTip);

    // TCP eksen indikatörü (X=Kırmızı, Y=Yeşil, Z=Mavi)
    const toolLen = cfg.linkLengths.tcpToolLength || 20;
    const tcpAxisOffset = cfg.linkLengths.tcpAxisOffset || 12;
    const tcpAxes = new THREE.AxesHelper(toolLen);
    tcpAxes.position.y = tcpAxisOffset;
    j6.add(tcpAxes);

    // Tüm meshler shadow
    this.rootGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Eklem açılarını ayarla
   * Config'deki axes dizisinden dönüş ekseni okur
   * @param {Object} angles - { j1: deg, j2: deg, ..., j6: deg }
   */
  setAngles(angles) {
    const axes = ROBOT_CONFIG.axes;
    const dirs = ROBOT_CONFIG.directions;
    const offsets = ROBOT_CONFIG.zeroOffsets;
    const keys = ROBOT_CONFIG.jointKeys;

    for (let i = 0; i < 6; i++) {
      const joint = this.joints[i];
      const axis = axes[i];
      const dir = dirs[i];
      const angle = deg2rad((angles[keys[i]] || 0) + offsets[i]) * dir;

      // Önce tüm rotasyonu sıfırla
      joint.rotation.set(0, 0, 0);

      // Sonra sadece doğru ekseni ayarla
      joint.rotation[axis] = angle;
    }
  }

  /**
   * End-effector'ın dünya koordinatlarını al (Three.js sahne grafiğinden)
   * NOT: Bu fonksiyon IK içinde KULLANILMAMALI — sadece UI gösterimi için
   */
  getEndEffectorWorldPosition() {
    const lastJoint = this.joints[5];
    const worldPos = new THREE.Vector3();
    lastJoint.getWorldPosition(worldPos);
    return worldPos;
  }

  /**
   * Robotun tüm eklem dünya pozisyonlarını al (collision için)
   */
  getJointWorldPositions() {
    const positions = [];
    for (const joint of this.joints) {
      const pos = new THREE.Vector3();
      joint.getWorldPosition(pos);
      positions.push(pos);
    }
    return positions;
  }

  /**
   * Robot görünürlüğünü ayarla
   */
  setVisible(visible) {
    this.rootGroup.visible = visible;
  }

  /**
   * Robotun dispose edilmesi (cleanup)
   */
  dispose() {
    this.rootGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    this.scene.remove(this.rootGroup);
  }
}
