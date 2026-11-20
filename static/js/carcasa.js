/* La geometría pertenece al HTML. Este módulo nunca consulta la API. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let scene = null;
  let currentReading = null;
  let activeHotspot = null;
  let lastReadingKey = null;
  let pulseTimer = null;
  let journeyActive = false;
  let journeyStep = 0;
  let journeyTimer = null;
  let motionPaused = false;
  // La hora se muestra en la zona configurada en el servidor (atributo data-timezone del <body>).
  const TZ = (() => {
    const raw = document.body && document.body.dataset ? document.body.dataset.timezone : '';
    if (!raw) return undefined;
    try { new Intl.DateTimeFormat('es-CO', { timeZone: raw }); return raw; } catch (_) { return undefined; }
  })();
  const number = (value, digits = 1) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    const safe = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(safe).replace(/^-/, '−');
  };
  // Texto seguro: una lectura defectuosa (null, cadena, NaN) nunca produce «NaN» en pantalla.
  const reading = (key, unit, digits = 1) => currentReading && Number.isFinite(currentReading[key]) ? `${number(currentReading[key], digits)} ${unit}` : 'sin lectura';
  const descriptions = {
    dht: ['DHT22 · aire', () => `Detrás de la zona ventilada inferior mide temperatura (${reading('temperature_c', '°C')}) y humedad relativa (${reading('humidity_pct', '%')}). La separación del ESP32 ayuda a evitar su calor.`],
    bh: ['BH1750 · luz', () => `Bajo la ventana superior registra la iluminancia (${reading('illuminance_lux', 'lux', 0)}). La ventana y las sombras pueden influir en el valor.`],
    esp: ['ESP32 · enlace', () => `Está dentro de la caja. Reúne las lecturas y las envía por Wi-Fi cada ${document.body?.dataset?.readingInterval || 10} segundos al computador local. No necesita reloj ni pantalla.`],
    led: ['LED · estado', () => 'En el nodo físico, un destello indica envío aceptado; dos, un fallo. El LED de esta ilustración refleja la disponibilidad y antigüedad de la lectura; no confirma la conexión física en tiempo real.'],
    server: ['Servidor · memoria', () => 'El computador está fuera de la carcasa. Asigna la hora, guarda las lecturas en SQLite y publica el dashboard, el diario y el CSV dentro de la misma red.']
  };
  const journey = [
    ['01 / OBSERVAR', 'Los sensores escuchan el lugar', () => currentReading && ['temperature_c', 'humidity_pct', 'illuminance_lux'].every((key) => Number.isFinite(currentReading[key])) ? `El DHT22 registró ${reading('temperature_c', '°C')} y ${reading('humidity_pct', '%')} de humedad; el BH1750 observó ${reading('illuminance_lux', 'lux', 0)}.` : 'El DHT22 observa temperatura y humedad, mientras el BH1750 registra la luz. La carcasa los protege sin ocultarlos del ambiente.'],
    ['02 / REUNIR', 'El ESP32 prepara una lectura', () => 'El microcontrolador valida los tres números y forma un mensaje JSON. No interpreta el ambiente ni guarda el historial.'],
    ['03 / TRANSMITIR', 'El dato cruza la red local', () => 'Por Wi-Fi de 2,4 GHz, el ESP32 envía el mensaje al computador. Una respuesta HTTP 201 confirma que fue aceptado.'],
    ['04 / RECORDAR', 'El servidor le da tiempo y memoria', () => 'El computador asigna la fecha y hora, guarda la lectura en SQLite y la deja disponible dentro de la red local.'],
    ['05 / CONTAR', 'La señal se vuelve experiencia', () => 'La misma lectura alimenta las tarjetas, el ritmo, las gráficas, la tabla y el diario. La presentación cambia; el nodo físico no necesita hacerlo.']
  ];

  function clearJourneySelection() {
    scene.querySelectorAll('[data-flow-step]').forEach((button) => {
      button.classList.remove('is-active');
      button.removeAttribute('aria-current');
    });
  }

  function scheduleJourney() {
    clearInterval(journeyTimer);
    journeyTimer = null;
    if (!journeyActive || motionPaused) return;
    journeyTimer = setInterval(() => setJourneyStep((journeyStep + 1) % journey.length), 2900);
  }

  function setJourneyStep(index) {
    journeyStep = Math.max(0, Math.min(journey.length - 1, Number(index) || 0));
    scene.dataset.journeyStep = String(journeyStep);
    scene.dataset.hotspot = journeyStep === 0 ? 'dht' : journeyStep === 1 ? 'esp' : journeyStep === 3 ? 'server' : '';
    activeHotspot = null;
    const [kicker, title, body] = journey[journeyStep];
    $('scene-info-title').textContent = title;
    $('scene-info-body').textContent = body();
    const infoKicker = scene.querySelector('.scene-info-kicker');
    if (infoKicker) infoKicker.textContent = kicker;
    scene.querySelectorAll('[data-hotspot]').forEach((button) => {
      button.classList.remove('is-selected');
      button.setAttribute('aria-pressed', 'false');
    });
    clearJourneySelection();
    const active = [...scene.querySelectorAll('[data-flow-step]')].find((button) => Number(button.dataset.flowStep) === journeyStep);
    if (active) {
      active.classList.add('is-active');
      active.setAttribute('aria-current', 'step');
    }
  }

  function stopJourney({ restore = false } = {}) {
    if (!journeyActive && !journeyTimer) return;
    journeyActive = false;
    clearInterval(journeyTimer);
    journeyTimer = null;
    scene.classList.remove('is-journey');
    delete scene.dataset.journeyStep;
    delete scene.dataset.hotspot;
    clearJourneySelection();
    const toggle = $('journey-toggle');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.textContent = 'Recorrer el dato';
    if (restore) {
      const infoKicker = scene.querySelector('.scene-info-kicker');
      if (infoKicker) infoKicker.textContent = 'EXPLORA LOS COMPONENTES';
      $('scene-info-title').textContent = 'Explora la carcasa';
      $('scene-info-body').textContent = 'Cada elemento del diseño tiene una función. Selecciona un punto o un nombre para seguir el recorrido de los datos.';
    }
  }

  function startJourney() {
    journeyActive = true;
    scene.classList.add('is-journey');
    const toggle = $('journey-toggle');
    toggle.setAttribute('aria-pressed', 'true');
    toggle.textContent = 'Detener recorrido';
    setJourneyStep(0);
    scheduleJourney();
  }

  function selectHotspot(name) {
    if (!descriptions[name]) return;
    stopJourney();
    activeHotspot = name;
    scene.dataset.hotspot = name;
    const infoKicker = scene.querySelector('.scene-info-kicker');
    if (infoKicker) infoKicker.textContent = 'EXPLORA LOS COMPONENTES';
    $('scene-info-title').textContent = descriptions[name][0];
    $('scene-info-body').textContent = descriptions[name][1]();
    scene.querySelectorAll('[data-hotspot]').forEach((button) => {
      const selected = button.dataset.hotspot === name;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function initCarcasaInteraction() {
    const viewport = $('device-viewport');
    const rotator = $('device-rotator');
    const toggle = $('motion-toggle');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let userPaused = false;
    try { userPaused = localStorage.getItem('econodo-motion-paused') === 'true'; } catch (_) { /* Almacenamiento opcional. */ }
    let paused = false;
    let touchStart = null;
    let frame = null;
    let rx = -22, ry = -32;
    function rotate(x, y) {
      rx = Math.max(-28, Math.min(-16, x));
      ry = Math.max(-40, Math.min(-24, y));
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        rotator.style.setProperty('--device-rx', `${rx}deg`);
        rotator.style.setProperty('--device-ry', `${ry}deg`);
        scene.style.setProperty('--parallax-x', `${(ry + 32) * .65}px`);
        scene.style.setProperty('--parallax-y', `${(rx + 22) * .65}px`);
        frame = null;
      });
    }
    function reset() { rotate(-22, -32); }
    function syncMotion() {
      paused = userPaused || media.matches;
      motionPaused = paused;
      toggle.disabled = media.matches;
      toggle.textContent = media.matches ? 'Movimiento reducido' : paused ? 'Reanudar movimiento' : 'Pausar movimiento';
      toggle.setAttribute('aria-pressed', String(paused));
      scene.classList.toggle('is-paused', paused);
      document.documentElement.classList.toggle('motion-paused', paused);
      document.dispatchEvent(new CustomEvent('econodo:motion', { detail: { paused } }));
      scheduleJourney();
      reset();
    }
    toggle.addEventListener('click', () => {
      userPaused = !userPaused;
      try { localStorage.setItem('econodo-motion-paused', String(userPaused)); } catch (_) { /* Sin persistencia. */ }
      syncMotion();
    });
    if (media.addEventListener) media.addEventListener('change', syncMotion);
    else if (media.addListener) media.addListener(syncMotion);
    syncMotion();
    scene.querySelectorAll('[data-hotspot]').forEach((button) => {
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-controls', 'scene-info');
      button.addEventListener('click', () => selectHotspot(button.dataset.hotspot));
      button.addEventListener('focus', () => selectHotspot(button.dataset.hotspot));
    });
    $('journey-toggle').addEventListener('click', () => {
      if (journeyActive) stopJourney({ restore: true });
      else startJourney();
    });
    scene.querySelectorAll('[data-flow-step]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!journeyActive) startJourney();
        setJourneyStep(button.dataset.flowStep);
        scheduleJourney();
      });
    });
    viewport.addEventListener('pointermove', (event) => {
      if (paused) return;
      const bounds = viewport.getBoundingClientRect();
      if (event.pointerType === 'mouse') {
        rotate(-22 - ((event.clientY - bounds.top) / bounds.height - .5) * 11,
          -32 + ((event.clientX - bounds.left) / bounds.width - .5) * 16);
      } else if (touchStart && event.pointerId === touchStart.id) {
        rotate(-22 - (event.clientY - touchStart.y) / bounds.height * 9,
          -32 + (event.clientX - touchStart.x) / bounds.width * 12);
      }
    });
    viewport.addEventListener('pointerdown', (event) => {
      if (!paused && event.pointerType !== 'mouse' && !event.target.closest('button,a')) {
        touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) =>
      viewport.addEventListener(name, () => { touchStart = null; reset(); }));
    viewport.addEventListener('keydown', (event) => {
      if (event.target !== viewport || paused) return;
      const directions = { ArrowLeft: [rx, ry - 2], ArrowRight: [rx, ry + 2],
        ArrowUp: [rx - 2, ry], ArrowDown: [rx + 2, ry], Home: [-22, -32] };
      if (directions[event.key]) { event.preventDefault(); rotate(...directions[event.key]); }
    });
  }

  function updateCarcasa3DReadings(reading, { error = false } = {}) {
    if (!scene) return;
    currentReading = reading || null;
    const metrics = [['scene-temp', 'temperature_c', '°C', 1],
      ['scene-humidity', 'humidity_pct', '%', 1], ['scene-light', 'illuminance_lux', 'lux', 0]];
    metrics.forEach(([id, key, unit, digits]) => {
      $(id).textContent = reading && Number.isFinite(reading[key]) ?
        `${number(reading[key], digits)} ${unit}` : error ? 'Sin lectura' : '—';
    });
    // Momento de recepción de la lectura que muestran los números, en la zona configurada.
    const timeEl = $('scene-reading-time');
    if (timeEl) {
      const when = reading ? new Date(reading.received_at_local || reading.received_at_utc) : null;
      timeEl.textContent = when && !Number.isNaN(when.getTime()) ?
        `Recibida: ${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(when)}` :
        error ? 'Sin conexión: lectura no disponible' : 'Sin lectura recibida';
    }
    const key = reading ? `${reading.id}:${reading.received_at_utc}` : null;
    if (key && key !== lastReadingKey) {
      scene.classList.add('has-new-reading');
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => scene.classList.remove('has-new-reading'), 1600);
    }
    lastReadingKey = key;
    // Opacidad acotada: metáfora visual, nunca un umbral ecológico o una alarma.
    // Cada intensidad se calcula solo si la cifra es finita; si no, vuelve al ambiente neutro.
    const clamp = (value) => Math.max(0, Math.min(1, value));
    const finite = (name) => reading && Number.isFinite(reading[name]);
    const warmth = finite('temperature_c') ? clamp((reading.temperature_c - 10) / 25) : .3;
    const humidity = finite('humidity_pct') ? clamp(reading.humidity_pct / 100) : .35;
    const light = finite('illuminance_lux') ? clamp(Math.log1p(Math.max(0, reading.illuminance_lux)) / Math.log1p(20000)) : .3;
    scene.style.setProperty('--warmth-strength', (.12 + warmth * .22).toFixed(3));
    scene.style.setProperty('--mist-strength', (.12 + humidity * .24).toFixed(3));
    scene.style.setProperty('--light-strength', (.12 + light * .38).toFixed(3));
    if (activeHotspot) selectHotspot(activeHotspot);
  }

  function updateCarcasa3DState(data = {}) {
    if (!scene) return;
    const state = data.error ? 'error' : !data.latest ? 'empty' :
      data.state === 'actualizado' ? 'fresh' : 'stale';
    scene.dataset.state = state;
    ['empty', 'error', 'fresh', 'stale', 'loading'].forEach((name) =>
      scene.classList.toggle(`is-${name}`, name === state));
    const labels = {
      empty: 'Sin lecturas · la carcasa permanece disponible.',
      error: 'Sin conexión · lecturas no disponibles. Carcasa interactiva.',
      stale: 'Lectura atrasada · valores históricos, flujo atenuado.',
      fresh: data.demo ? 'Lecturas simuladas · actualización reciente.' : 'Lectura reciente recibida por el servidor.'
    };
    $('scene-status').textContent = labels[state];
  }

  function initCarcasa3D() {
    scene = $('device-scene');
    if (!scene || scene.dataset.initialized === 'true') return;
    // Idempotente: preserva el mismo árbol DOM durante toda la sesión.
    scene.dataset.initialized = 'true';
    scene.dataset.state = 'loading';
    $('scene-status').textContent = 'Carcasa lista · esperando lecturas.';
    initCarcasaInteraction();
    // Pausa fuera de pantalla; esto nunca modifica visibilidad ni geometría.
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        scene.classList.toggle('is-offscreen', !entry.isIntersecting);
      }, { rootMargin: '80px' });
      observer.observe(scene);
    }
    document.addEventListener('visibilitychange', () => {
      scene.classList.toggle('is-tab-hidden', document.hidden);
    });
    document.addEventListener('econodo:state', (event) => {
      updateCarcasa3DReadings(event.detail.latest, { error: event.detail.error });
      updateCarcasa3DState(event.detail);
    });
  }

  window.EcoNodoScene = Object.freeze({ initCarcasa3D, updateCarcasa3DState, updateCarcasa3DReadings });
  initCarcasa3D();
})();
