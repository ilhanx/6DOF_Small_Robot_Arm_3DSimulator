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

    // Küçük altıgen başlık vidalar (3B baskı taban — yan görünüm referansı)
    const boltGeo = new THREE.CylinderGeometry(0.9, 1.1, 0.7, 6);
    const addBolt = (parent, x, y, z, rotY = 0) => {
      const bolt = new THREE.Mesh(boltGeo.clone(), blackMat);
      bolt.rotation.order = 'YXZ';
      bolt.rotation.y = rotY;
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x, y, z);
      bolt.castShadow = true;
      parent.add(bolt);
    };

    // ============ ZEMIN + TABAN PLAKASI (koyu alt + turuncu üst) ============
    // Turuncu üst plaka yüzeyi y=6 → J1 gövdesi (housing alt y=6) ile çakışır; j1 / FK ofseti değişmez
    const baseStackLiftY = 1.5;
    const baseUnderlay = new THREE.Mesh(
      new THREE.BoxGeometry(58, 2.5, 135),
      darkMat
    );
    baseUnderlay.position.set(0, -1.25 + baseStackLiftY, 67.5);
    baseUnderlay.castShadow = true;
    baseUnderlay.receiveShadow = true;
    this.rootGroup.add(baseUnderlay);

    // Sabit taban: J1 dönerken turuncu plaka + arka NEMA / yükseltici dünya ekseninde sabit kalır
    const rearNemaZ = 107;

    const baseLip = new THREE.Mesh(
      new THREE.BoxGeometry(48, 2, 130),
      orangeMat
    );
    baseLip.position.set(0, 1 + baseStackLiftY, 67.5);
    baseLip.castShadow = true;
    baseLip.receiveShadow = true;
    this.rootGroup.add(baseLip);

    const basePlateTop = new THREE.Mesh(
      new THREE.BoxGeometry(44, 2.5, 125),
      orangeMat
    );
    basePlateTop.position.set(0, 3.25 + baseStackLiftY, 67.5);
    basePlateTop.castShadow = true;
    basePlateTop.receiveShadow = true;
    this.rootGroup.add(basePlateTop);

    const rearRiser = new THREE.Mesh(
      new THREE.BoxGeometry(16, 5, 12),
      orangeMat
    );
    rearRiser.position.set(0, 6.5 + baseStackLiftY, rearNemaZ);
    rearRiser.castShadow = true;
    this.rootGroup.add(rearRiser);

    const rearMotorBody = new THREE.Mesh(
      new THREE.BoxGeometry(10, 26, 11),
      darkMat
    );
    rearMotorBody.position.set(0, 19 + baseStackLiftY, rearNemaZ);
    rearMotorBody.castShadow = true;
    this.rootGroup.add(rearMotorBody);

    const rearMotorTop = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 2, 16),
      metalMat
    );
    rearMotorTop.position.set(0, 33 + baseStackLiftY, rearNemaZ);
    rearMotorTop.castShadow = true;
    this.rootGroup.add(rearMotorTop);

    // ============ J1 — BASE (Roll, Y ekseni) — dönen kısım: gövde + omuz bağlantısı ============
    const j1 = new THREE.Group();
    j1.position.y = 0;
    this.rootGroup.add(j1);
    this.joints.push(j1);

    // İlk eklem: iki paralel turuncu yan plaka (tabana doğru +Z’de uzatılmış köprü; yükseklik aynı)
    const housingZ = 32;
    const housingH = 26;
    const housingY0 = 6;
    const housingDepth = 88;
    const housingPlateT = 2.8;
    const housingX = 11.5;

    const housingLeft = new THREE.Mesh(
      new THREE.BoxGeometry(housingPlateT, housingH, housingDepth),
      orangeMat
    );
    housingLeft.position.set(-housingX, housingY0 + housingH / 2, housingZ);
    housingLeft.castShadow = true;
    j1.add(housingLeft);

    const housingRight = new THREE.Mesh(
      new THREE.BoxGeometry(housingPlateT, housingH, housingDepth),
      orangeMat
    );
    housingRight.position.set(housingX, housingY0 + housingH / 2, housingZ);
    housingRight.castShadow = true;
    j1.add(housingRight);

    // Plaka üzeri vidalar (fotoğraftaki siyah başlıklar)
    for (let i = 0; i < 5; i++) {
      const by = 9 + i * 4.2;
      const bz = housingZ - housingDepth / 2 + 2.5;
      addBolt(j1, -housingX - housingPlateT / 2 - 0.2, by, bz, 0);
      addBolt(j1, housingX + housingPlateT / 2 + 0.2, by, bz, Math.PI);
    }

    // Gövde içi yatay motor (yan görünüm — mil X doğrultusunda)
    const innerMotor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 4.5, 14, 16),
      darkMat
    );
    innerMotor.rotation.z = Math.PI / 2;
    innerMotor.position.set(0, 13, housingZ);
    innerMotor.castShadow = true;
    j1.add(innerMotor);

    const innerMotorRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.6, 8, 20),
      metalMat
    );
    innerMotorRing.rotation.y = Math.PI / 2;
    innerMotorRing.position.set(0, 13, housingZ);
    innerMotorRing.castShadow = true;
    j1.add(innerMotorRing);

    // Kablo demeti (zip tie yerine ince silindirler — mavi / yeşil / sarı)
    const wireMat = (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        metalness: 0.1,
        roughness: 0.85,
      });
    const wirePositions = [
      [-housingX - 1.2, 11, housingZ + 5],
      [-housingX - 1.2, 12, housingZ + 5],
      [-housingX - 1.2, 13, housingZ + 5],
    ];
    const wireColors = [0x3d6fb8, 0x4caf50, 0xc9b037];
    for (let w = 0; w < wirePositions.length; w++) {
      const wg = new THREE.CylinderGeometry(0.55, 0.55, 7, 8);
      const wire = new THREE.Mesh(wg, wireMat(wireColors[w]));
      wire.rotation.z = Math.PI / 2;
      wire.position.set(...wirePositions[w]);
      wire.castShadow = true;
      j1.add(wire);
    }

    // Üst rulman / omuz geçişi — J2 (y=base_height) ile hizalı
    const baseNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(13, 15, 10, 22),
      orangeMat
    );
    baseNeck.position.y = 30;
    baseNeck.position.z = -1;
    baseNeck.castShadow = true;
    j1.add(baseNeck);

    const basePulleyDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 2.5, 24),
      blackMat
    );
    basePulleyDisc.position.set(0, 35.2, -1);
    basePulleyDisc.castShadow = true;
    j1.add(basePulleyDisc);

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

    // J2 — NEMA 22 omuz motoru: çatal plakanın +Z ucuna kadar, Z taşması yok (çatal derinliği 16 → z ∈ [-8, 8])
    const forkHalfZ = 8;
    const n22DepthZ = 9.5;
    const n22Height = 28;
    const n22WidthX = 13;
    const j2NemaZ = forkHalfZ - n22DepthZ / 2;
    const j2NemaBody = new THREE.Mesh(
      new THREE.BoxGeometry(n22WidthX, n22Height, n22DepthZ),
      darkMat
    );
    j2NemaBody.position.set(0, 14, j2NemaZ);
    j2NemaBody.castShadow = true;
    j2.add(j2NemaBody);

    const j2NemaFace = new THREE.Mesh(
      new THREE.BoxGeometry(n22WidthX - 1, n22Height - 4, 0.8),
      metalMat
    );
    j2NemaFace.position.set(0, 14, forkHalfZ - 0.41);
    j2NemaFace.castShadow = true;
    j2.add(j2NemaFace);

    const j2NemaRear = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 1.2, 16),
      metalMat
    );
    j2NemaRear.rotation.x = Math.PI / 2;
    j2NemaRear.position.set(0, 14, j2NemaZ - n22DepthZ / 2 + 0.6);
    j2NemaRear.castShadow = true;
    j2.add(j2NemaRear);

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
