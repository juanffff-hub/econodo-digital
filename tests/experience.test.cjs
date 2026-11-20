/* Contrato defensivo de la experiencia inmersiva, sin navegador ni paquetes npm. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const window = {};
const document = { getElementById: () => null };
const context = vm.createContext({ window, document, Intl, Date, Math, Number, Object, Array });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/experience.js'), 'utf8'), context);

const api = window.EcoNodoExperience;
assert.ok(api, 'La capa defensiva queda disponible aunque la vista no exista.');

const normal = api.sanitizeRows([
  { id: 2, received_at_local: '2026-10-20T08:05:00-05:00', temperature_c: 23.5, humidity_pct: 62, illuminance_lux: 850 },
  { id: 1, received_at_local: '2026-10-20T08:00:00-05:00', temperature_c: 23, humidity_pct: 63, illuminance_lux: 700 }
]);
assert.equal(normal.rows.length, 2);
assert.equal(normal.rows[0].id, 1, 'Las lecturas se ordenan por tiempo.');
assert.equal(normal.rejected, 0);
assert.equal(normal.visuallyLimited, 0);

const hostile = api.sanitizeRows([
  { received_at_local: 'fecha-imposible', temperature_c: 20, humidity_pct: 50, illuminance_lux: 100 },
  { received_at_local: '2026-10-20T08:00:00-05:00', temperature_c: '20', humidity_pct: 50, illuminance_lux: 100 },
  { received_at_local: '2026-10-20T08:00:00-05:00', temperature_c: 2000, humidity_pct: 50, illuminance_lux: 100 },
  { received_at_local: '2026-10-20T08:00:00-05:00', temperature_c: 20, humidity_pct: NaN, illuminance_lux: 100 },
  { received_at_local: '2026-10-20T08:00:00-05:00', temperature_c: -40, humidity_pct: 0, illuminance_lux: 65535 },
  { received_at_local: '2026-10-20T09:00:00-05:00', temperature_c: 80, humidity_pct: 100, illuminance_lux: 0 }
]);
assert.equal(hostile.rejected, 4, 'Formato y valores fuera del contrato se excluyen.');
assert.equal(hostile.rows.length, 2, 'Los extremos válidos se conservan como cifras.');
assert.equal(hostile.visuallyLimited, 2, 'Los extremos válidos limitan solo su efecto visual.');
assert.equal(hostile.rows[0].temperature_c, -40);
assert.equal(hostile.rows[1].temperature_c, 80);

for (const reading of hostile.rows) {
  const visual = api.visualState(reading);
  for (const key of ['light', 'humidity', 'temperature']) {
    assert.ok(Number.isFinite(visual[key]) && visual[key] >= 0 && visual[key] <= 1, `${key} permanece acotado.`);
  }
  assert.match(visual.skyTop, /^rgb\(\d+, \d+, \d+\)$/);
  assert.match(visual.skyBottom, /^rgb\(\d+, \d+, \d+\)$/);
  assert.match(visual.sunColor, /^rgb\(\d+, \d+, \d+\)$/);
}

const many = Array.from({ length: 800 }, (_, index) => ({ id: index, received_at_local: new Date(2026, 0, 1, 0, index).toISOString(), temperature_c: 20, humidity_pct: 50, illuminance_lux: index }));
const sampled = api.sanitizeRows(many);
assert.equal(sampled.rows.length, 500, 'Un historial largo no sobrecarga la reproducción.');
assert.equal(sampled.rows[0].id, 0);
assert.equal(sampled.rows.at(-1).id, 799);

class Element {
  constructor(id = '') {
    this.id = id; this.dataset = {}; this.events = {}; this.attributes = {};
    this.hidden = false; this.disabled = false; this.textContent = ''; this.innerHTML = '';
    this.value = '0'; this.max = '0'; this.className = ''; this.children = {};
    this.style = { values: {}, setProperty: (key, value) => { this.style.values[key] = value; } };
    const classes = new Set();
    this.classList = { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
  }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector(selector) { return this.children[selector] || null; }
}

const GOOD_ROWS = [
  { id: 1, node_id: 'test-1', received_at_local: '2026-10-20T08:00:00-05:00', temperature_c: 22, humidity_pct: 65, illuminance_lux: 400 },
  { id: 2, node_id: 'test-1', received_at_local: '2026-10-20T08:05:00-05:00', temperature_c: 80, humidity_pct: 70, illuminance_lux: 65535 }
];
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

/* Monta experience.js con un DOM mínimo. `mode` decide qué responde la API: ok | empty | error. */
async function mountExperience({ timezone, rows = GOOD_ROWS } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  element('experience-state').children.b = new Element();
  ['experience-temperature', 'experience-humidity', 'experience-light'].forEach(id => { element(id).children.em = new Element(); });
  const periods = ['hoy', '24h'].map(period => { const button = new Element(); button.dataset.experiencePeriod = period; return button; });
  const doc = {
    hidden: false,
    getElementById: element,
    querySelectorAll: selector => selector === '[data-experience-period]' ? periods : [],
    addEventListener() {}
  };
  if (timezone !== undefined) doc.body = { dataset: { timezone } };
  const intervals = [];
  const handle = { mode: 'ok', element, periods, settle, intervals, rows };
  const ctx = vm.createContext({
    window: {}, document: doc, Intl, Date, Math, Number, Object, Array,
    AbortController, performance: { now: () => 0 },
    fetch: async () => {
      if (handle.mode === 'error') throw new TypeError('Failed to fetch');
      return { ok: true, json: async () => ({ readings: handle.mode === 'empty' ? [] : handle.rows }) };
    },
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/experience.js'), 'utf8'), ctx);
  await settle();
  return handle;
}

async function behaviourFixtures() {
  // La hora sale de la zona configurada en el servidor, no de la del equipo que ejecuta la prueba.
  const bogota = await mountExperience({ timezone: 'America/Bogota' });
  assert.match(bogota.element('experience-time').textContent, /^08:00/, 'Bogotá: 08:00 locales.');
  assert.match(bogota.element('experience-progress').textContent, /^Hoy · momento 1 de 2 · 08:00/);
  const tokyo = await mountExperience({ timezone: 'Asia/Tokyo' });
  assert.match(tokyo.element('experience-time').textContent, /^10:00/, 'La misma lectura en Tokio es 22:00.');
  const invalid = await mountExperience({ timezone: 'No/Existe' });
  assert.equal(invalid.element('experience-stage').dataset.state, 'ready', 'Una zona inválida no rompe la escena.');
  assert.match(invalid.element('experience-time').textContent, /\d{2}:\d{2}/);

  // Reproducción: el movimiento ambiental depende de data-playing, que se apaga al pausar.
  const play = bogota.element('experience-play');
  assert.equal(bogota.element('experience-stage').dataset.playing, 'false');
  play.events.click[0]();
  assert.equal(bogota.element('experience-stage').dataset.playing, 'true');
  assert.equal(play.attributes['aria-pressed'], 'true');
  play.events.click[0]();
  assert.equal(bogota.element('experience-stage').dataset.playing, 'false', 'Pausar detiene el movimiento ambiental.');
  assert.equal(bogota.element('experience-stage').className, '', 'La clase del escenario nunca se reasigna.');
  assert.equal(bogota.element('experience-stage').classList.contains('is-loading'), false);

  // Un periodo vacío o fallido no deja fecha, hora ni procedencia de la lectura anterior.
  for (const mode of ['empty', 'error']) {
    bogota.mode = mode;
    bogota.periods[1].events.click[0]();
    await settle();
    assert.equal(bogota.element('experience-stage').dataset.state, mode, `Estado ${mode} explícito.`);
    assert.equal(bogota.element('experience-time').textContent, '—:—');
    assert.equal(bogota.element('experience-date').textContent, 'Sin lectura');
    assert.match(bogota.element('experience-source').textContent, /no hay una lectura/i);
    for (const id of ['experience-temperature-value', 'experience-humidity-value', 'experience-light-value']) {
      assert.equal(bogota.element(id).textContent, '—', `${id} sin cifra anterior.`);
    }
    assert.equal(bogota.element('experience-timeline').disabled, true);
    assert.equal(bogota.element('experience-play').disabled, true);
    assert.equal(bogota.element('experience-stage').dataset.playing, 'false');
    assert.match(bogota.element('experience-play').innerHTML, /Reproducir el día/, 'El botón no ofrece continuar un recorrido inexistente.');
  }
  // Y se recupera sin recargar la página.
  bogota.mode = 'ok';
  bogota.periods[0].events.click[0]();
  await settle();
  assert.equal(bogota.element('experience-stage').dataset.state, 'ready');
  assert.match(bogota.element('experience-time').textContent, /^08:00/);
}

async function integrationFixture() {
  const fixture = await mountExperience();
  const element = fixture.element;
  assert.equal(element('experience-stage').dataset.state, 'ready');
  assert.equal(element('experience-temperature-value').textContent, '22,0');
  assert.equal(element('experience-timeline').max, '1');
  assert.equal(element('experience-play').disabled, false);
  assert.match(element('experience-quality').textContent, /2 lecturas válidas/);
  assert.match(element('experience-quality').textContent, /1 con efecto visual limitado/);
  assert.ok(element('experience-stage').style.values['--sky-top'].startsWith('rgb('));
}

integrationFixture().then(behaviourFixtures).then(() => {
  console.log('OK: orden, rechazo, extremos conservados, visual acotado, muestreo seguro, zona horaria, reproducción, vacío/error sin restos e integración DOM.');
}).catch(error => { console.error(error); process.exitCode = 1; });
