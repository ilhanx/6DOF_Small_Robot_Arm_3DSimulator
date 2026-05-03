/**
 * Web Serial API — Chrome / Edge (HTTPS veya localhost).
 * Seri port seçimi kullanıcı izniyle yapılır; baud ve çerçeve ayarları kaydedilir.
 */

export const COM_SETTINGS_STORAGE_KEY = 'robotsim.comSettings.v1';

export const defaultComSettings = () => ({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
  lineEnding: 'crlf',
});

export function loadComSettings() {
  const base = defaultComSettings();
  try {
    const raw = localStorage.getItem(COM_SETTINGS_STORAGE_KEY);
    if (!raw) return base;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return base;
    const baud = parseInt(o.baudRate, 10);
    const dataBits = parseInt(o.dataBits, 10);
    const stopBits = parseInt(o.stopBits, 10);
    return {
      baudRate: Number.isFinite(baud) && baud > 0 ? baud : base.baudRate,
      dataBits: dataBits === 7 ? 7 : 8,
      stopBits: stopBits === 2 ? 2 : 1,
      parity: o.parity === 'even' || o.parity === 'odd' ? o.parity : 'none',
      flowControl: o.flowControl === 'hardware' ? 'hardware' : 'none',
      lineEnding: o.lineEnding === 'lf' || o.lineEnding === 'none' ? o.lineEnding : 'crlf',
    };
  } catch {
    return base;
  }
}

export function saveComSettings(settings) {
  try {
    localStorage.setItem(COM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

/** @param {ReturnType<typeof defaultComSettings>} settings */
export function buildSerialOpenOptions(settings) {
  return {
    baudRate: settings.baudRate,
    dataBits: settings.dataBits,
    stopBits: settings.stopBits,
    parity: settings.parity,
    flowControl: settings.flowControl,
  };
}

/** @param {'lf'|'crlf'|'none'} lineEnding */
export function applyLineEnding(text, lineEnding) {
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (lineEnding === 'lf') return `${trimmed}\n`;
  if (lineEnding === 'none') return trimmed;
  return `${trimmed}\r\n`;
}

export class SerialPortSession {
  constructor() {
    this.port = null;
  }

  get isOpen() {
    return !!(this.port && this.port.readable && this.port.writable);
  }

  /** Kullanıcıdan yeni port seçtirir ve bağlar. */
  async connectWithPicker(settings) {
    if (!isWebSerialSupported()) {
      throw new Error('Web Serial bu tarayıcıda yok (Chrome veya Edge kullanın).');
    }
    await this.disconnect();
    const port = await navigator.serial.requestPort();
    await port.open(buildSerialOpenOptions(settings));
    this.port = port;
  }

  /** Daha önce izin verilmiş portları dener (tek port varsa kullanışlı). */
  async connectGranted(settings) {
    if (!isWebSerialSupported()) {
      throw new Error('Web Serial bu tarayıcıda yok (Chrome veya Edge kullanın).');
    }
    const ports = await navigator.serial.getPorts();
    if (ports.length !== 1) {
      throw new Error('Kayıtlı tek port yok; "Port seç" ile seçim yapın.');
    }
    await this.disconnect();
    const port = ports[0];
    await port.open(buildSerialOpenOptions(settings));
    this.port = port;
  }

  async disconnect() {
    if (!this.port) return;
    try {
      await this.port.close();
    } catch {
      // ignore
    }
    this.port = null;
  }

  /**
   * @param {string} text
   * @param {'lf'|'crlf'|'none'} lineEnding
   */
  async writeText(text, lineEnding) {
    if (!this.port?.writable) {
      throw new Error('Seri port açık değil.');
    }
    const payload = applyLineEnding(text, lineEnding);
    const encoder = new TextEncoder();
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(encoder.encode(payload));
    } finally {
      writer.releaseLock();
    }
  }
}
