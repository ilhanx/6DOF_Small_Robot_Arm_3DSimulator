/**
 * Türkçe / İngilizce arayüz metinleri ve DOM uygulaması.
 */
const STORAGE_KEY = 'robotsim.lang.v1';

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'tr') return v;
  } catch (_) {}
  return 'tr';
}

let currentLang = readStoredLang();
const subscribers = new Set();

function interpolate(template, params = {}) {
  if (!params || typeof params !== 'object') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    (params[k] != null ? String(params[k]) : ''));
}

/** @type {Record<string, Record<string, string>>} */
const MESSAGES = {
  tr: {
    'app.pageTitle': '6-DOF Robot Kol Simülatörü',
    'app.metaDescription':
      '6 Eksenli Robot Kol Web Simülatörü — 3D dijital ikiz, kinematik kontrol ve trajectory planning',
    'app.headerTitle': '6-DOF Robot Simülatörü',
    'lang.label': 'Dil',
    'lang.selectAria': 'Arayüz dili',
    'header.home': '🏠 Home',
    'header.homeTitle': 'Home pozisyonuna git',
    'header.start': '🎯 Start',
    'header.startTitle': 'Start pozisyonuna git',
    'header.autoIk': '🤖 Auto IK',
    'header.autoIkTitle': 'Otomatik IK takip',
    'header.goTarget': '➡️ Hedefe Git',
    'header.goTargetTitle': 'Hedefe git (IK)',
    'header.comSettings': '🔌 COM Ayarları',
    'header.comSettingsTitle': 'Seri port ayarları (Web Serial)',
    'header.comCommandsTitle': 'Arduino seri port komut listesi',
    'panel.infoTitle': 'Bu bölüm hakkında bilgi',
    'panel.infoAria': 'Bilgi',
    'panel.targetTitle': '🎯 HEDEF (TCP)',
    'panel.trackingTitle': '📡 TAKİP MODU',
    'panel.j5LockTitle': '🧲 J5 FIX EKSENİ',
    'panel.tcpDragTitle': '✋ TCP SÜRÜKLEME',
    'panel.speedTitle': '⚡ HIZ AYARLARI',
    'panel.drawTitle': '🖊 Çalışma alanı çizim',
    'panel.gcodeTitle': '🧾 G-CODE',
    'panel.jointsTitle': '🔧 EKLEM KONTROL',
    'panel.wristTitle': '🎛 J4/J5 SET AÇILARI',
    'panel.positionTitle': '📐 POZİSYON BİLGİSİ',
    'panel.outputTitle': '📋 ÇIKTI',
    'btn.resetTarget': '🔄 Hedefi Sıfırla',
    'track.position': 'Position (XYZ)',
    'track.fullpose': 'Full Pose',
    'track.lookat': 'Look-at',
    'axis.x': 'X ekseni',
    'axis.y': 'Y ekseni',
    'axis.z': 'Z ekseni',
    'tcpDrag.hint': 'Yeşil tutamaç ile sürüklerken taban (J1) dönüşü',
    'tcpDrag.j1Lock': 'J1 kilitli',
    'tcpDrag.j1Free': 'J1 serbest',
    'speed.accel': 'Kalkış hızı',
    'speed.move': 'Hareket hızı',
    'speed.decel': 'Duruş hızı',
    'btn.send': '📤 Gönder',
    'btn.sendTitleSpeed': "Hareket hızını Arduino ss komutu olarak COM'a gönder",
    'unit.step': 'adım',
    'unit.plane': 'düzlem',
    'gcode.placeholder':
      'Örnek:\nG90\nG0 X0 Y140 Z0 F2000\nG1 X40 Y140 Z-30 F1200\nG1 X-40 Y140 Z-30 F1200',
    'gcode.apply': 'G-code Uygula',
    'gcode.applyTitle': "G-code'u adımlara dönüştür",
    'gcode.run': 'G-code Oynat',
    'gcode.runTitle': "G-code'u oluştur ve oynat",
    'gcode.clear': 'Temizle',
    'gcode.clearTitle': 'G-code alanını temizle',
    'output.placeholder': 'Senaryo çıktısı veya Arduino komutları…',
    'btn.copy': '📋 Kopyala',
    'btn.outputSendTitle': 'Bu paneldeki metni seri porta gönder',
    'btn.jointsSendTitle': "J1–J6 açılarını simcom1.00,2.00,… biçiminde COM'a gönder",
    'unit.target': 'hedef',
    'unit.worldPitch': 'yere',
    'timeline.firstTitle': 'İlk adıma git',
    'timeline.prevTitle': 'Önceki adım',
    'timeline.playTitle': 'Oynat',
    'timeline.pauseTitle': 'Duraklat',
    'timeline.stopTitle': 'Durdur',
    'timeline.nextTitle': 'Sonraki adım',
    'timeline.lastTitle': 'Son adıma git',
    'timeline.simultaneTitle':
      'İşaretliyse oynatırken her adım bittiğinde aynı komutlar COM ile gerçek robota gönderilir',
    'timeline.simultane': 'Simultane (COM)',
    'footer.addStep': '+ Adım Ekle',
    'footer.addStepTitle': 'Mevcut pozisyonu adım olarak ekle',
    'footer.saveJson': '💾 JSON Kaydet',
    'footer.saveJsonTitle': 'Senaryoyu JSON olarak kaydet',
    'footer.saveOutput': '📝 Çıktı Kaydet',
    'footer.saveOutputTitle': 'Çıktı formatında kaydet',
    'footer.loadJson': '📂 JSON Yükle',
    'footer.loadJsonTitle': 'JSON senaryo yükle',
    'footer.clear': '🗑 Temizle',
    'footer.clearTitle': 'Tüm adımları temizle',
    'footer.comWrite': "📡 COM'a Yaz",
    'footer.comWriteTitle': "Senaryoyu çıktıya yeniler ve tüm adımları COM'a yazar",
    'scenario.stepsLine': '{{n}} adım',
    'file.jsonAria': 'JSON senaryo dosyası seç',
    'modal.close': 'Kapat',
    'com.title': '🔌 COM Port Ayarları',
    'com.hint':
      'Chrome veya Edge kullanın (Web Serial). Port seçimi güvenlik için her oturumda onay gerektirebilir.',
    'com.statusLabel': 'Durum:',
    'com.connected': 'Bağlı',
    'com.disconnected': 'Kapalı',
    'com.dataBits': 'Veri biti',
    'com.stopBits': 'Stop biti',
    'com.parity': 'Parite',
    'com.flow': 'Akış',
    'com.lineEnding': 'Satır sonu (gönderim)',
    'com.parityNone': 'Yok',
    'com.parityEven': 'Çift',
    'com.parityOdd': 'Tek',
    'com.flowNone': 'Yok',
    'com.flowHw': 'RTS/CTS',
    'com.leCrlf': 'CRLF (\\r\\n)',
    'com.leLf': 'LF (\\n)',
    'com.leNone': 'Yok',
    'com.save': '💾 Ayarları kaydet',
    'com.commandsHelp': '📖 Arduino komutları',
    'com.pickPort': '🔎 Port seç ve bağlan',
    'com.reusePort': '↻ Son izinli porta bağlan',
    'com.disconnect': '⏏ Bağlantıyı kes',
    'status.manual': 'MANUEL',
    'status.auto': 'AUTO IK',
    'status.tracking': 'TAKİP',
    'joint.j1': 'J1 Taban',
    'joint.j2': 'J2 Omuz',
    'joint.j3': 'J3 Dirsek',
    'joint.j4': 'J4 Ön kol',
    'joint.j5': 'J5 Bilek',
    'joint.j6': 'J6 Flanş',
    'viewport.mouseCoord': 'X: {{x}} Y: {{y}} Z: {{z}}',
    'viewport.camAngles': 'Kamera Yaw: {{yaw}}° | Pitch: {{pitch}}°',
    'panelHelp.missingTitle': 'Bilgi',
    'panelHelp.missingBody': '<p>Bu bölüm için açıklama henüz eklenmemiş.</p>',
    'toast.copied': 'Kopyalandı!',
    'com.noWebSerial': 'Bu tarayıcıda Web Serial yok; Chrome veya Edge deneyin.',
    'com.settingsSaved': 'Ayarlar kaydedildi.',
    'com.connecting': 'Bağlanıyor…',
    'com.portOpen': 'Port açıldı.',
    'com.noWebSerialShort': 'Web Serial desteklenmiyor.',
    'com.grantedOpen': 'İzinli port açıldı.',
    'com.disconnectedMsg': 'Bağlantı kesildi.',
    'com.sending': '📡 Gönderiliyor...',
    'com.sendShort': '📤 Gönderiliyor...',
    'com.writeDefault': "📡 COM'a Yaz",
    'com.sendBtn': '📤 Gönder',
    'err.comBusy': 'COM gönderimi zaten çalışıyor',
    'err.noWebSerial': 'Web Serial yok (Chrome/Edge)',
    'err.comNotConnected': 'Önce COM portuna bağlanın',
    'err.noCommands': 'Gönderilecek komut yok (çıktı boş veya okunamadı)',
    'err.noCommandsShort': 'Gönderilecek komut yok',
    'toast.outputSaved': 'Çıktı formatında kaydedildi',
    'toast.scenarioLoaded': 'Senaryo yüklendi',
    'err.badJson': 'Geçersiz JSON: steps dizisi yok veya dosya boş',
    'err.fileRead': 'Dosya okunamadı',
    'toast.stepAdded': 'Adım {{n}} eklendi',
    'warn.simultaneNoCom': 'Simultane: önce COM portunu açın',
    'toast.motionDone': 'Hareket tamamlandı',
    'err.noSteps': 'Senaryoda adım yok',
    'err.stepUnresolved': 'Adım çözülemedi',
    'err.gcodeEmpty': 'G-code boş',
    'err.gcodeNoMoves': 'Geçerli G0/G1 satırı bulunamadı',
    'toast.comSent': "COM'a gönderildi ({{n}} komut)",
    'toast.gcodeImported': 'G-code içe aktarıldı ({{n}} adım)',
    'err.comSend': 'COM gönderim hatası',
    'log.comSendDone': 'COM gönderimi tamamlandı',
    'com.progress': 'COM {{i}}/{{total}}: {{label}}',
    'ik.approxFallback': 'Yaklaşık çözüm',
    'ik.solutionFound': 'Çözüm bulundu (hata: {{err}} mm)',
    'ik.approxSolution': 'Yaklaşık çözüm (hata: {{err}} mm)',
    'ik.unreachable': 'Ulaşılamaz poz — hedef erişilemez (hata: {{err}} mm)',
    'draw.toolNav': 'Taşı / bak',
    'draw.toolLine': 'Çizgi',
    'draw.toolRect': 'Dörtgen',
    'draw.toolTri': 'Üçgen',
    'draw.toolCircle': 'Daire',
    'draw.planeLabel': 'Düzlem',
    'draw.planeXZ': 'XZ (yatay)',
    'draw.planeXY': 'XY (Z sabit)',
    'draw.planeYZ': 'YZ (X sabit)',
    'draw.samplesLabel': 'Yol noktası',
    'draw.samplesUnit': 'adım',
    'draw.btnClear': 'Çizimleri sil',
    'draw.btnClearTitle': '3B görünümdeki tüm çizilmiş şekilleri kaldır',
    'draw.btnApply': 'Çizimi Adımla',
    'draw.btnApplyTitle':
      'Köşe sırası korunur; adımlar eklem (joint); IK hedefi kaydırılmaz',
    'draw.hint':
      'Çizgi araçları: sol tık ile nokta (çizgi 2, dörtgen 2 köşe, üçgen 3, daire merkez+yarıçap). Shift: çizgide eksen. Alt: 5 mm ızgara. Esc: iptal. Taşı/bak: çizimin üzerindeyken Ctrl basılı tutup sürükleyerek taşı. Ctrl+Z: son şekli sil.',
    'draw.toastShapeDone': 'Şekil tamamlandı',
    'draw.toastCancelled': 'Çizim iptal edildi',
    'draw.errNoPath': 'Önce bir şekil çizin',
    'draw.errNoIk': 'Yol üzerinde IK çözülemedi; J4/J5 panelini veya çizimi kontrol edin',
    'draw.stepLabel': 'Çizim yolu',
    'draw.appliedOk': 'Yol {{steps}} eklem (joint) adımı olarak eklendi',
    'draw.appliedWarn': 'Kısmi yol: {{steps}} eklem adımı eklendi, {{fail}} hedef atlandı (IK yok)',
    'draw.cleared': 'Çizimler temizlendi',
    'draw.toastUndo': 'Son çizim kaldırıldı',
  },
  en: {
    'app.pageTitle': '6-DOF Robot Arm Simulator',
    'app.metaDescription':
      '6-DOF robot arm web simulator — 3D digital twin, kinematic control, and trajectory planning',
    'app.headerTitle': '6-DOF Robot Simulator',
    'lang.label': 'Language',
    'lang.selectAria': 'Interface language',
    'header.home': '🏠 Home',
    'header.homeTitle': 'Go to home position',
    'header.start': '🎯 Start',
    'header.startTitle': 'Go to start position',
    'header.autoIk': '🤖 Auto IK',
    'header.autoIkTitle': 'Automatic IK tracking',
    'header.goTarget': '➡️ Go to target',
    'header.goTargetTitle': 'Go to target (IK)',
    'header.comSettings': '🔌 COM settings',
    'header.comSettingsTitle': 'Serial port settings (Web Serial)',
    'header.comCommandsTitle': 'Arduino serial command reference',
    'panel.infoTitle': 'About this section',
    'panel.infoAria': 'Info',
    'panel.targetTitle': '🎯 TARGET (TCP)',
    'panel.trackingTitle': '📡 TRACKING MODE',
    'panel.j5LockTitle': '🧲 J5 LOCK AXIS',
    'panel.tcpDragTitle': '✋ TCP DRAG',
    'panel.speedTitle': '⚡ SPEED SETTINGS',
    'panel.drawTitle': '🖊 Workspace drawing',
    'panel.gcodeTitle': '🧾 G-CODE',
    'panel.jointsTitle': '🔧 JOINT CONTROL',
    'panel.wristTitle': '🎛 J4/J5 SET ANGLES',
    'panel.positionTitle': '📐 POSITION',
    'panel.outputTitle': '📋 OUTPUT',
    'btn.resetTarget': '🔄 Reset target',
    'track.position': 'Position (XYZ)',
    'track.fullpose': 'Full pose',
    'track.lookat': 'Look-at',
    'axis.x': 'X axis',
    'axis.y': 'Y axis',
    'axis.z': 'Z axis',
    'tcpDrag.hint': 'Base (J1) rotation while dragging the green TCP handle',
    'tcpDrag.j1Lock': 'J1 locked',
    'tcpDrag.j1Free': 'J1 free',
    'speed.accel': 'Acceleration',
    'speed.move': 'Move speed',
    'speed.decel': 'Deceleration',
    'btn.send': '📤 Send',
    'btn.sendTitleSpeed': 'Send move speed to Arduino as ss… command over COM',
    'unit.step': 'steps',
    'unit.plane': 'plane',
    'gcode.placeholder':
      'Example:\nG90\nG0 X0 Y140 Z0 F2000\nG1 X40 Y140 Z-30 F1200\nG1 X-40 Y140 Z-30 F1200',
    'gcode.apply': 'Apply G-code',
    'gcode.applyTitle': 'Convert G-code to steps',
    'gcode.run': 'Run G-code',
    'gcode.runTitle': 'Build steps from G-code and play',
    'gcode.clear': 'Clear',
    'gcode.clearTitle': 'Clear G-code field',
    'output.placeholder': 'Scenario output or Arduino commands…',
    'btn.copy': '📋 Copy',
    'btn.outputSendTitle': 'Send this panel text to the serial port',
    'btn.jointsSendTitle': 'Send J1–J6 angles as simcom1.00,2.00,… over COM',
    'unit.target': 'target',
    'unit.worldPitch': 'world',
    'timeline.firstTitle': 'Go to first step',
    'timeline.prevTitle': 'Previous step',
    'timeline.playTitle': 'Play',
    'timeline.pauseTitle': 'Pause',
    'timeline.stopTitle': 'Stop',
    'timeline.nextTitle': 'Next step',
    'timeline.lastTitle': 'Go to last step',
    'timeline.simultaneTitle':
      'When checked, after each step during playback the same commands are sent to the real robot over COM',
    'timeline.simultane': 'Simultaneous (COM)',
    'footer.addStep': '+ Add step',
    'footer.addStepTitle': 'Add current pose as a step',
    'footer.saveJson': '💾 Save JSON',
    'footer.saveJsonTitle': 'Save scenario as JSON',
    'footer.saveOutput': '📝 Save output',
    'footer.saveOutputTitle': 'Save in output text format',
    'footer.loadJson': '📂 Load JSON',
    'footer.loadJsonTitle': 'Load JSON scenario',
    'footer.clear': '🗑 Clear',
    'footer.clearTitle': 'Clear all steps',
    'footer.comWrite': '📡 Write to COM',
    'footer.comWriteTitle': 'Refresh output from scenario and write all steps to COM',
    'scenario.stepsLine': '{{n}} steps',
    'file.jsonAria': 'Choose JSON scenario file',
    'modal.close': 'Close',
    'com.title': '🔌 COM port settings',
    'com.hint':
      'Use Chrome or Edge (Web Serial). Port selection may require permission each session.',
    'com.statusLabel': 'Status:',
    'com.connected': 'Connected',
    'com.disconnected': 'Disconnected',
    'com.dataBits': 'Data bits',
    'com.stopBits': 'Stop bits',
    'com.parity': 'Parity',
    'com.flow': 'Flow control',
    'com.lineEnding': 'Line ending (TX)',
    'com.parityNone': 'None',
    'com.parityEven': 'Even',
    'com.parityOdd': 'Odd',
    'com.flowNone': 'None',
    'com.flowHw': 'RTS/CTS',
    'com.leCrlf': 'CRLF (\\r\\n)',
    'com.leLf': 'LF (\\n)',
    'com.leNone': 'None',
    'com.save': '💾 Save settings',
    'com.commandsHelp': '📖 Arduino commands',
    'com.pickPort': '🔎 Pick port & connect',
    'com.reusePort': '↻ Connect to last allowed port',
    'com.disconnect': '⏏ Disconnect',
    'status.manual': 'MANUAL',
    'status.auto': 'AUTO IK',
    'status.tracking': 'TRACKING',
    'joint.j1': 'J1 Base',
    'joint.j2': 'J2 Shoulder',
    'joint.j3': 'J3 Elbow',
    'joint.j4': 'J4 Forearm',
    'joint.j5': 'J5 Wrist',
    'joint.j6': 'J6 Flange',
    'viewport.mouseCoord': 'X: {{x}} Y: {{y}} Z: {{z}}',
    'viewport.camAngles': 'Camera yaw: {{yaw}}° | pitch: {{pitch}}°',
    'panelHelp.missingTitle': 'Info',
    'panelHelp.missingBody': '<p>No help text is available for this section yet.</p>',
    'toast.copied': 'Copied!',
    'com.noWebSerial': 'Web Serial is not available in this browser; try Chrome or Edge.',
    'com.settingsSaved': 'Settings saved.',
    'com.connecting': 'Connecting…',
    'com.portOpen': 'Port opened.',
    'com.noWebSerialShort': 'Web Serial is not supported.',
    'com.grantedOpen': 'Allowed port opened.',
    'com.disconnectedMsg': 'Disconnected.',
    'com.sending': '📡 Sending...',
    'com.sendShort': '📤 Sending...',
    'com.writeDefault': '📡 Write to COM',
    'com.sendBtn': '📤 Send',
    'err.comBusy': 'A COM transfer is already in progress',
    'err.noWebSerial': 'No Web Serial (Chrome/Edge)',
    'err.comNotConnected': 'Connect to a COM port first',
    'err.noCommands': 'Nothing to send (output empty or unreadable)',
    'err.noCommandsShort': 'Nothing to send',
    'toast.outputSaved': 'Saved in output format',
    'toast.scenarioLoaded': 'Scenario loaded',
    'err.badJson': 'Invalid JSON: missing steps array or empty file',
    'err.fileRead': 'Could not read file',
    'toast.stepAdded': 'Step {{n}} added',
    'warn.simultaneNoCom': 'Simultaneous: open COM port first',
    'toast.motionDone': 'Motion complete',
    'err.noSteps': 'No steps in scenario',
    'err.stepUnresolved': 'Could not resolve step',
    'err.gcodeEmpty': 'G-code is empty',
    'err.gcodeNoMoves': 'No valid G0/G1 lines found',
    'toast.comSent': 'Sent to COM ({{n}} commands)',
    'toast.gcodeImported': 'G-code imported ({{n}} steps)',
    'err.comSend': 'COM send error',
    'log.comSendDone': 'COM send completed',
    'com.progress': 'COM {{i}}/{{total}}: {{label}}',
    'ik.approxFallback': 'Approximate solution',
    'ik.solutionFound': 'Solution found (error: {{err}} mm)',
    'ik.approxSolution': 'Approximate solution (error: {{err}} mm)',
    'ik.unreachable': 'Unreachable pose (error: {{err}} mm)',
    'draw.toolNav': 'Navigate',
    'draw.toolLine': 'Line',
    'draw.toolRect': 'Rectangle',
    'draw.toolTri': 'Triangle',
    'draw.toolCircle': 'Circle',
    'draw.planeLabel': 'Plane',
    'draw.planeXZ': 'XZ (horizontal)',
    'draw.planeXY': 'XY (fixed Z)',
    'draw.planeYZ': 'YZ (fixed X)',
    'draw.samplesLabel': 'Path samples',
    'draw.samplesUnit': 'pts',
    'draw.btnClear': 'Clear drawings',
    'draw.btnClearTitle': 'Remove all drawn shapes from the 3D view',
    'draw.btnApply': 'Step drawing',
    'draw.btnApplyTitle':
      'Keeps vertex order; joint-space steps; strict IK (no reach nudge)',
    'draw.hint':
      'Drawing tools: left-click points (line: 2, rectangle: 2 corners, triangle: 3, circle: center + rim). Shift: axis snap on line. Alt: 5 mm grid. Esc: cancel. Navigate: hold Ctrl while pointer is on a stroke, then drag to move the shape. Ctrl+Z: remove last shape.',
    'draw.toastShapeDone': 'Shape completed',
    'draw.toastCancelled': 'Drawing cancelled',
    'draw.errNoPath': 'Draw a shape first',
    'draw.errNoIk': 'Could not solve IK along the path; check J4/J5 panel settings or the drawing',
    'draw.stepLabel': 'Draw path',
    'draw.appliedOk': 'Path added as {{steps}} joint-space steps',
    'draw.appliedWarn': 'Partial path: {{steps}} joint steps added, {{fail}} targets skipped (no IK)',
    'draw.cleared': 'Drawings cleared',
    'draw.toastUndo': 'Last drawing removed',
  },
};

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== 'en' && lang !== 'tr') return;
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch (_) {}
  subscribers.forEach((fn) => {
    try {
      fn(currentLang);
    } catch (_) {}
  });
}

/** @param {(lang: string) => void} fn */
export function subscribeLang(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function t(key, params) {
  const table = MESSAGES[currentLang] || MESSAGES.tr;
  const raw = table[key] ?? MESSAGES.tr[key] ?? key;
  return interpolate(raw, params);
}

export function applyDomTranslations() {
  document.documentElement.lang = currentLang;

  const titleEl = document.querySelector('title');
  if (titleEl) titleEl.textContent = t('app.pageTitle');
  const meta = document.getElementById('meta-description');
  if (meta) meta.setAttribute('content', t('app.metaDescription'));

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && 'placeholder' in el) el.placeholder = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  });

  const sel = document.getElementById('lang-select');
  if (sel) sel.value = currentLang;
}
