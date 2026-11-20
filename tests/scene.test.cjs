/* Pruebas sin paquetes npm. DOM mínimo para contratos y ciclo de vida.
   La apariencia se comprueba además en el navegador real (ver VERIFICACION.md). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(id = '') {
    this.id = id; this.dataset = {}; this.children = []; this.events = {};
    this.attributes = {}; this.textContent = ''; this.hidden = false;
    this.props = {}; this.style = { setProperty: (k, v) => this.props[k] = v };
    const names = new Set();
    this.classList = {
      add: (...args) => args.forEach(x => names.add(x)),
      remove: (...args) => args.forEach(x => names.delete(x)),
      contains: x => names.has(x),
      toggle: (x, on = !names.has(x)) => { if (on) names.add(x); else names.delete(x); return on; }
    };
    this.clientWidth = 300; this.clientHeight = 350;
  }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  dispatchEvent(event) { (this.events[event.type] || []).forEach(fn => fn(event)); }
  setAttribute(k, v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
  getAttribute(k) { return this.attributes[k]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelector() { return null; }
  querySelectorAll(selector) {
    if (selector === '[data-flow-step]') return this.flowButtons || [];
    if (selector === '[data-hotspot]') return this.buttons || [];
    return [];
  }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 350 }; }
}

function fixture({ reduced = false, legacy = false, missingScene = false, timezone } = {}) {
  const elements = new Map();
  const element = id => {
    if (id === 'device-scene' && missingScene) return null;
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const scene = element('device-scene');
  if (scene) scene.buttons = ['dht', 'bh', 'esp', 'led', 'server'].map(name => {
    const button = new Element(); button.dataset.hotspot = name; return button;
  });
  if (scene) scene.flowButtons = [0, 1, 2, 3, 4].map(step => {
    const button = new Element(); button.dataset.flowStep = String(step); return button;
  });
  const periods = ['1h', '6h', 'hoy', '24h', '7d'].map(period => {
    const button = new Element(); button.dataset.period = period; return button;
  });
  const document = new Element();
  document.documentElement = new Element();
  document.getElementById = element;
  document.createElement = () => new Element();
  document.querySelectorAll = () => periods;
  if (timezone !== undefined) document.body = { dataset: { timezone } };
  const media = { matches: reduced };
  media[legacy ? 'addListener' : 'addEventListener'] = () => {};
  let mode = 'fresh', calls = 0, timer = 0, history = null;
  const timers = new Map(), intervals = [], charts = [];
  const reading = { id: 1, received_at_utc: '2026-10-20T12:00:00+00:00',
    received_at_local: '2026-10-20T07:00:00-05:00',
    temperature_c: 23.4, humidity_pct: 65.4, illuminance_lux: 780 };
  const summary = Object.fromEntries(['temperature_c', 'humidity_pct', 'illuminance_lux']
    .map(k => [k, { min: 1, max: 2, avg: 1.5 }]));
  const fetch = async (url, { signal }) => {
    calls++;
    if (mode === 'loading') return new Promise((_, reject) =>
      signal.addEventListener('abort', () => reject(new Error('aborted'))));
    if (mode === 'network') throw new TypeError('Failed to fetch');
    const ok = mode !== 'error' && !(mode === 'partial' && url.includes('diario'));
    const data = url.includes('estado') ?
      { latest: mode === 'empty' ? null : reading, state: mode === 'stale' ? 'sin_actualizacion' : 'actualizado', age_seconds: 900, total_readings: 1, demo: true } :
      url.includes('historial') ? { count: mode === 'empty' ? 0 : (history || [reading]).length, summary, readings: mode === 'empty' ? [] : (history || [reading]) } :
        { chapters: [{ number: '01', title: 'Relato', body: 'Contenido', eyebrow: 'Apertura' }] };
    return { ok, status: ok ? 200 : 503, json: async () => data };
  };
  class Chart {
    constructor(canvas, config) { this.canvas = canvas; this.data = config.data; this.options = config.options; charts.push(this); }
    update() {} destroy() {} stop() {}
  }
  const window = { matchMedia: () => media, Chart };
  const context = vm.createContext({ document, window, Chart, fetch, Intl, Date, Number,
    AbortController, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout: (fn, ms) => { timers.set(++timer, { fn, ms }); return timer; },
    clearTimeout: id => timers.delete(id),
    setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {} });
  const load = name => vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js', name), 'utf8'), context);
  return { element, scene, document, context, window, reading, periods, load, timers, intervals, charts,
    setHistory: rows => { history = rows; },
    chart: id => charts.find(chart => chart.canvas.id === id),
    setMode: value => mode = value, calls: () => calls };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const click = button => button.dispatchEvent({ type: 'click' });

(async () => {
  const f = fixture();
  f.load('carcasa.js');
  assert.equal(f.calls(), 0, 'La escena se inicializa antes de toda consulta.');
  assert.equal(f.scene.dataset.initialized, 'true');
  const geometry = f.scene;
  f.window.EcoNodoScene.initCarcasa3D();
  assert.equal(f.element('motion-toggle').events.click.length, 1, 'Inicialización idempotente.');
  f.load('app.js'); await settle();
  assert.equal(f.scene.dataset.state, 'fresh');
  assert.equal(f.element('scene-temp').textContent, '23,4 °C');
  assert.equal(f.element('temperature-now').textContent, '23,4');
  assert.equal(f.element('rhythm-track').children.length, 1, 'El ritmo usa el historial existente.');
  click(f.element('journey-toggle'));
  assert.equal(f.scene.classList.contains('is-journey'), true, 'El recorrido guiado se activa.');
  assert.equal(f.scene.dataset.journeyStep, '0');
  click(f.scene.flowButtons[3]);
  assert.equal(f.scene.dataset.journeyStep, '3', 'Los pasos del recorrido se pueden explorar manualmente.');
  assert.equal(f.element('scene-info-title').textContent, 'El servidor le da tiempo y memoria');
  click(f.element('journey-toggle'));
  assert.equal(f.scene.classList.contains('is-journey'), false, 'El recorrido guiado se puede detener.');
  for (const mode of ['empty', 'error', 'network', 'stale', 'fresh', 'partial']) {
    f.setMode(mode);
    await f.intervals[0](); await settle();
    assert.equal(f.element('device-scene'), geometry, 'La geometría conserva su identidad.');
    assert.equal(f.scene.dataset.state, ['error', 'network'].includes(mode) ? 'error' : mode === 'partial' ? 'fresh' : mode);
    if (mode === 'empty') assert.equal(f.element('scene-temp').textContent, '—');
    if (['error', 'network'].includes(mode)) assert.equal(f.element('scene-temp').textContent, 'Sin lectura');
    click(f.scene.buttons[1]);
    assert.equal(f.element('scene-info-title').textContent, 'BH1750 · luz');
  }
  for (const button of f.periods) { click(button); await settle(); assert.equal(f.element('device-scene'), geometry); }
  f.setMode('loading');
  const pending = f.intervals[0]();
  assert.equal(f.scene.dataset.initialized, 'true', 'Visible mientras espera la API.');
  const timeout = [...f.timers.values()].find(t => t.ms === 8000);
  timeout.fn(); await pending;
  assert.equal(f.scene.dataset.state, 'error', 'Timeout termina la carga con estado explícito.');
  f.setMode('fresh'); await f.intervals[0]();
  assert.equal(f.scene.dataset.state, 'fresh', 'Se recupera tras timeout.');
  click(f.element('motion-toggle'));
  assert.equal(f.scene.classList.contains('is-paused'), true);
  assert.equal(f.document.documentElement.classList.contains('motion-paused'), true);
  const viewport = f.element('device-viewport');
  click(f.element('motion-toggle'));
  viewport.dispatchEvent({ type: 'pointerdown', pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 20, target: viewport });
  viewport.dispatchEvent({ type: 'pointermove', pointerType: 'touch', pointerId: 1, clientX: 9999, clientY: 9999 });
  assert.equal(f.element('device-rotator').props['--device-ry'], '-24deg');
  viewport.dispatchEvent({ type: 'pointercancel' });
  assert.equal(f.element('device-rotator').props['--device-ry'], '-32deg');
  viewport.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', target: viewport, preventDefault() {} });
  assert.equal(f.element('device-rotator').props['--device-ry'], '-34deg');
  for (const legacy of [false, true]) {
    const r = fixture({ reduced: true, legacy });
    r.load('carcasa.js');
    assert.equal(r.element('motion-toggle').disabled, true);
    assert.equal(r.scene.classList.contains('is-paused'), true);
  }
  const old = fixture({ missingScene: true });
  old.load('carcasa.js'); old.load('app.js'); await settle();
  assert.equal(old.element('temperature-now').textContent, '23,4', 'Una plantilla sin escena conserva el dashboard.');

  // ── Defensas de la vista principal ────────────────────────────────────────────────────────
  const at = (hh, mm) => `2026-10-20T${hh}:${mm}:00-05:00`;
  const row = (id, hh, mm, extra = {}) => ({ id, received_at_local: at(hh, mm), received_at_utc: at(hh, mm),
    temperature_c: 20 + id, humidity_pct: 60, illuminance_lux: 300 + id, ...extra });

  // Filas defectuosas: nulos, cadenas, fechas inválidas y valores fuera de contrato no se dibujan ni escriben «NaN».
  const bad = fixture();
  bad.setHistory([row(1, '07', '00'), null, row(2, '07', '05', { temperature_c: null }),
    row(3, '07', '10', { humidity_pct: '60' }), row(4, '07', '15', { received_at_local: 'no-es-fecha' }),
    row(5, '07', '20', { temperature_c: 999 }), row(6, '07', '25', { illuminance_lux: -1 })]);
  bad.load('carcasa.js'); bad.load('app.js'); await settle();
  assert.equal(bad.scene.dataset.state, 'fresh', 'Las filas defectuosas no rompen la vista.');
  assert.equal(bad.chart('temperature-chart').data.datasets[0].data.length, 1, 'Solo la fila válida llega a la gráfica.');
  assert.equal(bad.element('rhythm-track').children.length, 1, 'El ritmo también las ignora.');
  for (const id of ['temperature-now', 'humidity-now', 'light-now', 'scene-temp', 'scene-humidity', 'scene-light', 'rhythm-scale', 'gap-note']) {
    assert.doesNotMatch(bad.element(id).textContent, /NaN|undefined|null|Infinity/, `${id} sin restos de datos inválidos.`);
  }

  // Pausas largas: la línea se corta, no se suaviza y los extremos válidos no se recortan.
  const gap = fixture();
  gap.setHistory([row(1, '07', '00', { temperature_c: -40, humidity_pct: 0, illuminance_lux: 0 }),
    row(2, '07', '05', { temperature_c: 80, humidity_pct: 100, illuminance_lux: 65535 }), row(3, '08', '30')]);
  gap.load('carcasa.js'); gap.load('app.js'); await settle();
  const humidity = gap.chart('humidity-chart');
  const points = humidity.data.datasets[0].data;
  assert.equal(points.length, 4, 'Una pausa añade un punto vacío.');
  assert.equal(points[2].y, null);
  assert.ok(points[2].x > points[1].x && points[2].x < points[3].x);
  assert.equal(humidity.data.datasets[0].tension, 0, 'Sin suavizado que invente valores.');
  assert.equal(humidity.data.datasets[0].spanGaps, false);
  assert.equal(humidity.options.scales.x.type, 'linear', 'El eje de tiempo es proporcional.');
  assert.deepEqual([humidity.options.scales.y.min, humidity.options.scales.y.max], [0, 100]);
  for (const id of ['temperature-chart', 'light-chart']) {
    const scale = gap.chart(id).options.scales.y;
    assert.equal(scale.max, undefined, `${id}: el máximo válido no se recorta.`);
    assert.ok(scale.min === undefined || scale.min <= -40 || id === 'light-chart');
  }
  assert.match(gap.element('gap-note').textContent, /1 pausa de más de 20 minutos/);
  assert.match(gap.element('gap-note').textContent, /1 h 25 min/);
  assert.match(gap.element('rhythm-summary').textContent, /Hay tramos sin lecturas/, 'El resumen accesible del ritmo menciona la pausa.');
  assert.doesNotMatch(gap.element('rhythm-summary').textContent, /\.\./, 'Sin puntos duplicados tras «p. m.».');

  // La hora sale de la zona configurada en el servidor, no de la del equipo.
  for (const [zone, expected] of [['America/Bogota', /07:00/], ['Asia/Tokyo', /09:00/]]) {
    const tz = fixture({ timezone: zone });
    tz.load('carcasa.js'); tz.load('app.js'); await settle();
    assert.match(tz.element('scene-reading-time').textContent, expected, `${zone}: hora de la escena.`);
    assert.match(tz.element('reading-time').textContent, expected, `${zone}: hora del estado.`);
  }
  const wrongZone = fixture({ timezone: 'No/Existe' });
  wrongZone.load('carcasa.js'); wrongZone.load('app.js'); await settle();
  assert.equal(wrongZone.scene.dataset.state, 'fresh', 'Una zona inválida no rompe la vista.');

  // Sin lecturas o con error no queda fecha, hora ni sello de la lectura anterior.
  const stale = fixture();
  stale.load('carcasa.js'); stale.load('app.js'); await settle();
  assert.match(stale.element('scene-reading-time').textContent, /\d{2}:\d{2}/);
  for (const mode of ['empty', 'error']) {
    stale.setMode('fresh'); await stale.intervals[0](); await settle();
    stale.setMode(mode); await stale.intervals[0](); await settle();
    assert.doesNotMatch(stale.element('scene-reading-time').textContent, /\d{2}:\d{2}/, `${mode}: sin hora anterior en la escena.`);
    assert.doesNotMatch(stale.element('reading-time').textContent, /\d{2}:\d{2}/, `${mode}: sin hora anterior en el estado.`);
    assert.match(stale.element('temperature-stamp').textContent, /^(Sin lectura|Sin conexión)$/, `${mode}: sin sello anterior.`);
  }
  console.log('OK: inicio sin API, identidad, periodos, vacío, 503, red, atraso, recuperación, timeout, fallo parcial, teclado, tacto, pausa, reduced-motion, filas defectuosas, cortes de línea, extremos, zona horaria y estados sin restos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
