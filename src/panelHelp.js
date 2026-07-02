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
  'panel-draw-workspace': {
    title: '🖊 Çalışma alanı çizim',
    html: `
      <p><strong>Taşı / bak:</strong> Normal kamera dönüşü ve hedef/TCP sürükleme. Çizim aracı seçiliyken sol tuş sahne dönüşü yerine nokta koyar; orta tuş veya sağ tuş ile kamerayı hâlâ hareket ettirebilirsiniz.</p>
      <p><strong>Çizgi / Dörtgen / Üçgen / Daire:</strong> Seçili düzlemde (XZ yatay çalışma yüzeyi, XY veya YZ dikey duvar) sol tıklayarak nokta koyarsınız.</p>
      <ul>
        <li><strong>Çizgi:</strong> iki tık. <strong>Shift</strong> ile ikinci nokta eksene hizalanır.</li>
        <li><strong>Dörtgen:</strong> köşegen iki köşe.</li>
        <li><strong>Üçgen:</strong> üç köşe.</li>
        <li><strong>Daire:</strong> merkez + çember üzerinde bir nokta.</li>
      </ul>
      <p><strong>Alt</strong> basılıyken tıklama: 5 mm ızgara. <strong>Esc</strong> yarım kalan çizimi iptal eder.</p>
      <p><strong>Çizimi Adımla:</strong> Köşe sırası korunur. Her hedef için önce erişilebilirlik IK’sı (hedef kaydırılmaz) kontrol edilir; senaryo adımları <strong>eklem (joint)</strong> tipindedir — her köşe için çözülen j1–j6 hedefleri kaydedilir; oynatırken TCP’nin düz hat izlemesi garanti edilmez. Dairede yol <strong>Yol noktası</strong> ile örneklenir.</p>
      <p><strong>Ctrl+Z:</strong> Son çizilen şekli kaldırır. <strong>Taşı / bak</strong> modunda fare çizginin üzerindeyken <strong>Ctrl</strong> basılı tutarak sol tıklayıp sürükleyin; böylece tüm şekil düzlem içinde kayar (Ctrl yoksa sadece kamera döner).</p>
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
      <p>Tüm Arduino seri komutları için <strong>COM Ayarları</strong> penceresindeki <strong>Arduino komutları</strong> veya başlıktaki ⓘ düğmesine bakın.</p>
    `,
  },
  'panel-com-commands': {
    title: '📖 Arduino seri komutları',
    html: `
      <p><strong>Baud:</strong> Arduino firmware varsayılanı <code>9600</code> (USB Serial ve Bluetooth Serial1). COM ayarlarında baud’u buna uygun seçin.</p>
      <p>Komutlar satır sonu (<code>\\r</code> veya <code>\\n</code>) ile biter; Web Serial’de satır sonu yoksa kısa sessizlikte paket kapanır.</p>
      <h4>Motor / sistem</h4>
      <ul>
        <li><code>enable</code> — motor sürücüleri aktif</li>
        <li><code>disable</code> — motor sürücüleri kapalı</li>
      </ul>
      <h4>Hız</h4>
      <ul>
        <li><code>ss</code> + 0–100 — hareket hızı yüzdesi. Örnek: <code>ss75</code></li>
      </ul>
      <h4>Tek eklem (eklem uzayında düz hat)</h4>
      <p>Diğer eklemler sabit kalır; yalnızca ilgili eklem hedefe gider.</p>
      <ul>
        <li><code>s1</code> + açı — J1 (°). Örnek: <code>s145</code>, <code>s1-10</code></li>
        <li><code>s2</code> + açı — J2</li>
        <li><code>s3</code> + açı — J3</li>
        <li><code>s4</code> + açı — J4</li>
        <li><code>s5</code> + açı — J5</li>
        <li><code>s6</code> + açı — J6</li>
      </ul>
      <h4>Simülatörden gelen eklem hareketi (ana kullanım)</h4>
      <ul>
        <li><code>simcom</code> + j1,j2,j3,j4,j5,j6 — virgülle ayrılmış 6 açı (°). Örnek: <code>simcom0.00,-78.51,73.90,0.00,-90.00,0.00</code></li>
      </ul>
      <p>Simülatör <strong>Çıktı</strong> paneli, <strong>Eklem Gönder</strong> ve senaryo oynatıcı bu formatı üretir.</p>
      <h4>Kayıtlı yol / demo</h4>
      <ul>
        <li><code>save</code> + hız% — mevcut konumu kaydeder, sonraki segment hızını ayarlar. Örnek: <code>save50</code></li>
        <li><code>reset</code> — kayıt indeksini sıfırlar</li>
        <li><code>run</code> — <code>save</code> ile kaydedilen noktalar arasında oynatır</li>
        <li><code>home</code> — home pozisyonu, sonra <code>disable</code></li>
        <li><code>startpos</code> — başlangıç pozisyonu</li>
        <li><code>move1</code>, <code>move2</code> — yerleşik demo hareketleri</li>
      </ul>
      <h4>Örnek akış</h4>
      <pre><code>enable
ss75
startpos
simcom0.00,0.00,0.00,0.00,90.00,0.00
home
disable</code></pre>
      <p>Simülatör COM <strong>Gönder</strong> ile tanınan satırlar: <code>startpos</code>, <code>home</code>, <code>ss…</code>, <code>s1…s6</code>, <code>simcom…</code>.</p>
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
  'panel-draw-workspace': {
    title: '🖊 Workspace drawing',
    html: `
      <p><strong>Navigate:</strong> Normal orbit and target/TCP dragging. With no drawing tool selected you can rotate the view with the left mouse button.</p>
      <p><strong>Line / Rectangle / Triangle / Circle:</strong> Left-click on the chosen plane (XZ horizontal work surface at Y=20 mm, XY or YZ vertical wall).</p>
      <ul>
        <li><strong>Line:</strong> two clicks. Hold <strong>Shift</strong> on the second click to snap to the dominant axis.</li>
        <li><strong>Rectangle:</strong> two opposite corners.</li>
        <li><strong>Triangle:</strong> three corners.</li>
        <li><strong>Circle:</strong> center, then a point on the radius.</li>
      </ul>
      <p>Hold <strong>Alt</strong> while clicking for a 5 mm grid. <strong>Esc</strong> cancels an in-progress shape.</p>
      <p><strong>Step drawing:</strong> Keeps vertex order. Each waypoint is checked with strict IK (no reach nudge). Scenario steps are <strong>joint</strong> moves — solved j1–j6 targets per corner are saved; playback does not guarantee a straight TCP path between corners. Circles use <strong>Path samples</strong>.</p>
      <p><strong>Ctrl+Z:</strong> Removes the last drawn shape. In <strong>Navigate</strong> mode, hold <strong>Ctrl</strong> with the pointer on a stroke, then left-drag to move the whole shape within the plane (without Ctrl you only orbit the camera).</p>
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
      <p>For the full Arduino serial command list, open <strong>COM settings</strong> and use <strong>Arduino commands</strong> or the ⓘ button in the title bar.</p>
    `,
  },
  'panel-com-commands': {
    title: '📖 Arduino serial commands',
    html: `
      <p><strong>Baud:</strong> Arduino firmware default is <code>9600</code> (USB Serial and Bluetooth Serial1). Match this in COM settings.</p>
      <p>Commands end with a line break (<code>\\r</code> or <code>\\n</code>); without a line ending, Web Serial may close the packet after a short idle gap.</p>
      <h4>Motor / system</h4>
      <ul>
        <li><code>enable</code> — enable motor drivers</li>
        <li><code>disable</code> — disable motor drivers</li>
      </ul>
      <h4>Speed</h4>
      <ul>
        <li><code>ss</code> + 0–100 — speed percentage. Example: <code>ss75</code></li>
      </ul>
      <h4>Single joint (joint-space straight line)</h4>
      <p>Other joints stay fixed; only the selected joint moves to the target.</p>
      <ul>
        <li><code>s1</code> + angle — J1 (°). Example: <code>s145</code>, <code>s1-10</code></li>
        <li><code>s2</code> + angle — J2</li>
        <li><code>s3</code> + angle — J3</li>
        <li><code>s4</code> + angle — J4</li>
        <li><code>s5</code> + angle — J5</li>
        <li><code>s6</code> + angle — J6</li>
      </ul>
      <h4>Simulator joint move (primary use)</h4>
      <ul>
        <li><code>simcom</code> + j1,j2,j3,j4,j5,j6 — six comma-separated angles (°). Example: <code>simcom0.00,-78.51,73.90,0.00,-90.00,0.00</code></li>
      </ul>
      <p>The <strong>Output</strong> panel, <strong>Send joints</strong>, and scenario player generate this format.</p>
      <h4>Recorded path / demos</h4>
      <ul>
        <li><code>save</code> + speed% — save current pose and set next segment speed. Example: <code>save50</code></li>
        <li><code>reset</code> — clear record index</li>
        <li><code>run</code> — play poses saved with <code>save</code></li>
        <li><code>home</code> — home pose, then <code>disable</code></li>
        <li><code>startpos</code> — start position</li>
        <li><code>move1</code>, <code>move2</code> — built-in demo motions</li>
      </ul>
      <h4>Example sequence</h4>
      <pre><code>enable
ss75
startpos
simcom0.00,0.00,0.00,0.00,90.00,0.00
home
disable</code></pre>
      <p>Simulator COM <strong>Send</strong> recognizes: <code>startpos</code>, <code>home</code>, <code>ss…</code>, <code>s1…s6</code>, <code>simcom…</code>.</p>
    `,
  },
};

/**
 * @param {'tr'|'en'} lang
 */
export function getPanelHelp(lang) {
  return lang === 'en' ? PANEL_HELP_EN : PANEL_HELP_TR;
}
