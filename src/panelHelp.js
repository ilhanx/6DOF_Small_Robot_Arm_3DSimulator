/**
 * Sol/sağ panel bölümleri için yardım metinleri (panel id = anahtar).
 * @param {'tr'|'en'} lang
 */
const PANEL_HELP_TR = {
  'panel-target': {
    title: '🎯 Hedef (TCP)',
    html: `
      <p>Robot uç işlevcisinin (TCP) hedef konumu milimetre cinsinden X, Y, Z olarak girilir.</p>
      <p><strong>Hedefi sıfırla</strong> varsayılan bir çalışma noktasına döndürür. <strong>Hedefe Git</strong> üst çubuktan bu koordinata IK ile yumuşak hareket başlatılır.</p>
      <p>Kırmızı hedef küre ve Auto IK modunda TCP bu değerleri takip eder.</p>
    `,
  },
  'panel-tracking': {
    title: '📡 Takip modu',
    html: `
      <p><strong>Auto IK</strong> açıkken robot, hedef küreyi hangi mantıkla izleyeceğini seçer:</p>
      <ul>
        <li><strong>Position:</strong> Sadece uç nokta konumu (X,Y,Z) önemlidir.</li>
        <li><strong>Full Pose:</strong> Konum + yönelim hedefi (daha kısıtlayıcı).</li>
        <li><strong>Look-at:</strong> Uç işlevcinin belirli bir yöne bakması gibi davranışlar için.</li>
      </ul>
    `,
  },
  'panel-j5-lock': {
    title: '🧲 J5 fix ekseni',
    html: `
      <p>TCP’yi yeşil tutamaçla veya hedef IK ile hareket ettirirken bileğin dünya uzayındaki “yere göre” tutumu bu eksen seçimine göre hesaplanır.</p>
      <p>X / Y / Z seçenekleri, simülasyondaki bilek düzeltmesi (telafi) için referans eksenidir; donanımınızdaki tanımla uyumlu olacak şekilde seçin.</p>
    `,
  },
  'panel-tcp-drag-j1': {
    title: '✋ TCP sürükleme',
    html: `
      <p>3B görünümdeki <strong>yeşil küre</strong> (TCP tutamacı) ile fareyle sürükleyerek doğrudan IK çözümü alırsınız.</p>
      <p><strong>J1 kilitli:</strong> Taban dönüşü sabit kalır; kol omuz–dirsek–bilek ile hedefe uzanır.</p>
      <p><strong>J1 serbest:</strong> Taban da dönebilir; daha fazla serbestlik, bazen daha doğal çözümler.</p>
    `,
  },
  'panel-speed': {
    title: '⚡ Hız ayarları',
    html: `
      <p><strong>Kalkış / Hareket / Duruş</strong> yüzdeleri, eklem animasyonları ve senaryo oynatıcıdaki yumuşak hareket profilini etkiler (trapez hız eğrisi).</p>
      <p><strong>Gönder</strong> ile seçili hızı Arduino’ya <code>ss…</code> komutu olarak COM’dan iletebilirsiniz (port açıkken).</p>
    `,
  },
  'panel-template-settings': {
    title: '🧭 Trajectory settings',
    html: `
      <p>Otomatik şablonlar (8, +, sınır) için çalışma alanı boyutu ve adım sayısı.</p>
      <ul>
        <li><strong>X, Z:</strong> Şeklin milimetre cinsinden tipik genişlik/yükseklik ölçeği.</li>
        <li><strong>N:</strong> Yol üzerinde örneklenen ara nokta sayısı (daha fazla = daha pürüzsüz, daha ağır).</li>
        <li><strong>P:</strong> Şeklin hangi düzlemde üretileceği (XY, XZ, YZ).</li>
      </ul>
    `,
  },
  'panel-gcode': {
    title: '🧾 G-code',
    html: `
      <p>Basit <strong>G0 / G1</strong> satırları (G90 mutlak mod) senaryo adımlarına dönüştürülür.</p>
      <p><strong>G-code Uygula</strong> adımları oluşturur; <strong>G-code Oynat</strong> oluşturup oynatmayı başlatır. Birimler mm ve F feed ile uyumludur.</p>
    `,
  },
  'panel-joints': {
    title: '🔧 Eklem kontrol',
    html: `
      <p>Her eklem (J1–J6) için slider ve sayı kutusu ile manuel açı girişi. Değişiklikler anında veya yumuşak takip ile 3B modele yansır.</p>
      <p><strong>Gönder</strong> mevcut açıları tek satır <code>simcom…</code> formatında COM’a yollar (port açıkken).</p>
    `,
  },
  'panel-wrist-targets': {
    title: '🎛 J4 / J5 set açıları',
    html: `
      <p><strong>Hedefe Git</strong>, Auto IK ve TCP sürükleme sırasında IK kısıtları için kullanılır.</p>
      <ul>
        <li><strong>J4 hedef:</strong> Ön kol (roll) için sabitlenen hedef açı.</li>
        <li><strong>J5 “yere”:</strong> Bileğin dünya pitch hedefi (derece); J2+J3 ile birlikte IK tarafından telafi edilebilir.</li>
      </ul>
    `,
  },
  'panel-position': {
    title: '📐 Pozisyon bilgisi',
    html: `
      <p>Robot FK ile hesaplanan uç işlevci <strong>konumu (X,Y,Z mm)</strong> ve yaklaşık <strong>yönelim (Rx,Ry,Rz °)</strong> gösterimi.</p>
      <p>Slayt veya IK ile hareket ettikçe canlı güncellenir; referans ve hata ayıklama için okunur.</p>
    `,
  },
  'panel-output': {
    title: '📋 Çıktı',
    html: `
      <p>Senaryo ve hareketlerden üretilen <strong>simcom…</strong> satırları veya kopyaladığınız Arduino/C metni burada görünür.</p>
      <p><strong>Kopyala</strong> panoya alır. <strong>Gönder</strong> satırları sırayla COM’dan iletir; <code>home</code> ve <code>startpos</code> satırları simülatörü de ilgili konfig pozisyonuna götürür.</p>
    `,
  },
};

const PANEL_HELP_EN = {
  'panel-target': {
    title: '🎯 Target (TCP)',
    html: `
      <p>Enter the tool center point (TCP) target in millimetres as X, Y, and Z.</p>
      <p><strong>Reset target</strong> returns to a default working pose. <strong>Go to target</strong> in the toolbar starts a smooth IK move to these coordinates.</p>
      <p>The red target sphere and Auto IK mode follow these values.</p>
    `,
  },
  'panel-tracking': {
    title: '📡 Tracking mode',
    html: `
      <p>When <strong>Auto IK</strong> is on, choose how the robot follows the target sphere:</p>
      <ul>
        <li><strong>Position:</strong> Only end-effector position (X,Y,Z) matters.</li>
        <li><strong>Full pose:</strong> Position plus orientation target (more constrained).</li>
        <li><strong>Look-at:</strong> Behaviours where the tool should face a direction.</li>
      </ul>
    `,
  },
  'panel-j5-lock': {
    title: '🧲 J5 lock axis',
    html: `
      <p>While moving the TCP with the green handle or target IK, the wrist “world-relative” attitude is computed from this axis choice.</p>
      <p>X / Y / Z are reference axes for wrist compensation in the simulation; pick what matches your hardware definition.</p>
    `,
  },
  'panel-tcp-drag-j1': {
    title: '✋ TCP drag',
    html: `
      <p>Drag the <strong>green sphere</strong> (TCP handle) in the 3D view to get a direct IK solution.</p>
      <p><strong>J1 locked:</strong> Base rotation stays fixed; the arm reaches with shoulder–elbow–wrist.</p>
      <p><strong>J1 free:</strong> The base can rotate too; more freedom, sometimes more natural poses.</p>
    `,
  },
  'panel-speed': {
    title: '⚡ Speed settings',
    html: `
      <p><strong>Accel / move / decel</strong> percentages shape joint animations and the scenario player’s smooth velocity profile (trapezoid).</p>
      <p><strong>Send</strong> transmits the selected speed to the Arduino as an <code>ss…</code> command over COM (when the port is open).</p>
    `,
  },
  'panel-template-settings': {
    title: '🧭 Trajectory settings',
    html: `
      <p>Workspace size and sample count for automatic templates (eight, plus, bounds).</p>
      <ul>
        <li><strong>X, Z:</strong> Typical width/height scale of the shape in millimetres.</li>
        <li><strong>N:</strong> Number of intermediate samples along the path (more = smoother, heavier).</li>
        <li><strong>P:</strong> Plane in which the shape is generated (XY, XZ, YZ).</li>
      </ul>
    `,
  },
  'panel-gcode': {
    title: '🧾 G-code',
    html: `
      <p>Simple <strong>G0 / G1</strong> lines (G90 absolute mode) are converted into scenario steps.</p>
      <p><strong>Apply G-code</strong> builds steps; <strong>Run G-code</strong> builds and starts playback. Units are mm and F feedrate.</p>
    `,
  },
  'panel-joints': {
    title: '🔧 Joint control',
    html: `
      <p>Manual angle entry per joint (J1–J6) with sliders and numeric fields. Changes apply to the 3D model immediately or with smooth following.</p>
      <p><strong>Send</strong> pushes current angles as one <code>simcom…</code> line over COM (when the port is open).</p>
    `,
  },
  'panel-wrist-targets': {
    title: '🎛 J4 / J5 set angles',
    html: `
      <p>Used as IK constraints for <strong>Go to target</strong>, Auto IK, and TCP dragging.</p>
      <ul>
        <li><strong>J4 target:</strong> Locked target angle for forearm roll.</li>
        <li><strong>J5 “world”:</strong> Wrist world pitch target (degrees); can be compensated with J2+J3 in IK.</li>
      </ul>
    `,
  },
  'panel-position': {
    title: '📐 Position readout',
    html: `
      <p>Shows FK end-effector <strong>position (X,Y,Z mm)</strong> and approximate <strong>orientation (Rx,Ry,Rz °)</strong>.</p>
      <p>Updates live as you move with sliders or IK; useful for reference and debugging.</p>
    `,
  },
  'panel-output': {
    title: '📋 Output',
    html: `
      <p><strong>simcom…</strong> lines from the scenario and motions, or Arduino/C text you paste, appear here.</p>
      <p><strong>Copy</strong> copies to the clipboard. <strong>Send</strong> transmits lines in order over COM; <code>home</code> and <code>startpos</code> lines also move the simulator to the configured poses.</p>
    `,
  },
};

/**
 * @param {'tr'|'en'} lang
 */
export function getPanelHelp(lang) {
  return lang === 'en' ? PANEL_HELP_EN : PANEL_HELP_TR;
}
