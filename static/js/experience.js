/* Experiencia temporal independiente: consume solo APIs de lectura existentes. */
(() => {
  'use strict';

  const CONTRACT_BOUNDS = Object.freeze({
    temperature_c: [-40, 80],
    humidity_pct: [0, 100],
    illuminance_lux: [0, 65535]
  });
  // Estos límites solo protegen la representación. El número recibido nunca se reemplaza.
  const VISUAL_BOUNDS = Object.freeze({
    temperature_c: [-5, 45],
    humidity_pct: [5, 95],
    illuminance_lux: [0, 30000]
  });
  const MAX_SOURCE_ROWS = 5000;
  const MAX_PLAYBACK_ROWS = 500;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const normalize = (value, min, max) => clamp((value - min) / (max - min));
  const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const number = (value, digits = 1) => {
    if (!isFiniteNumber(value)) return '—';
    const safe = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(safe).replace(/^-/, '−');
  };
  // La hora se muestra en la zona configurada en el servidor (data-timezone del <body>), no en la del navegador.
  const TZ = (() => {
    const raw = typeof document !== 'undefined' && document.body && document.body.dataset ? document.body.dataset.timezone : '';
    if (!raw) return undefined;
    try { new Intl.DateTimeFormat('es-CO', { timeZone: raw }); return raw; } catch (_) { return undefined; }
  })();
  const PERIOD_LABELS = { hoy: 'Hoy', '24h': 'Últimas 24 horas' };

  function sampleRows(rows, limit = MAX_PLAYBACK_ROWS) {
    if (rows.length <= limit) return rows;
    const result = [];
    const last = rows.length - 1;
    for (let index = 0; index < limit; index += 1) {
      result.push(rows[Math.round((index / (limit - 1)) * last)]);
    }
    return result;
  }

  function sanitizeRows(input) {
    const source = Array.isArray(input) ? input : [];
    const limitedSource = source.length > MAX_SOURCE_ROWS ? source.slice(-MAX_SOURCE_ROWS) : source;
    let rejected = 0;
    let visuallyLimited = 0;
    const valid = [];
    limitedSource.forEach((row) => {
      if (!row || typeof row !== 'object') { rejected += 1; return; }
      const timestamp = new Date(row.received_at_local || row.received_at_utc);
      if (Number.isNaN(timestamp.getTime())) { rejected += 1; return; }
      const values = {};
      let accepted = true;
      Object.entries(CONTRACT_BOUNDS).forEach(([key, [min, max]]) => {
        const value = row[key];
        if (!isFiniteNumber(value) || value < min || value > max) accepted = false;
        else values[key] = value;
      });
      if (!accepted) { rejected += 1; return; }
      const limited = Object.fromEntries(Object.entries(VISUAL_BOUNDS).map(([key, [min, max]]) => [key, values[key] < min || values[key] > max]));
      if (Object.values(limited).some(Boolean)) visuallyLimited += 1;
      valid.push({ ...row, ...values, _timestamp: timestamp.getTime(), _limited: limited });
    });
    valid.sort((a, b) => a._timestamp - b._timestamp);
    return {
      rows: sampleRows(valid),
      validCount: valid.length,
      rejected,
      visuallyLimited,
      truncated: Math.max(0, source.length - limitedSource.length),
      sampled: Math.max(0, valid.length - MAX_PLAYBACK_ROWS)
    };
  }

  function mix(start, end, amount) {
    return Math.round(start + (end - start) * clamp(amount));
  }

  function rgb(dark, light, amount) {
    return `rgb(${mix(dark[0], light[0], amount)}, ${mix(dark[1], light[1], amount)}, ${mix(dark[2], light[2], amount)})`;
  }

  function visualState(reading) {
    if (!reading) {
      return { light: .28, humidity: .48, temperature: .45, skyTop: 'rgb(73, 112, 103)', skyBottom: 'rgb(172, 171, 129)', sunColor: 'rgb(244, 218, 151)' };
    }
    const temperature = normalize(clamp(reading.temperature_c, ...VISUAL_BOUNDS.temperature_c), ...VISUAL_BOUNDS.temperature_c);
    const humidity = normalize(clamp(reading.humidity_pct, ...VISUAL_BOUNDS.humidity_pct), ...VISUAL_BOUNDS.humidity_pct);
    const cappedLight = clamp(reading.illuminance_lux, ...VISUAL_BOUNDS.illuminance_lux);
    const light = clamp(Math.log1p(cappedLight) / Math.log1p(VISUAL_BOUNDS.illuminance_lux[1]));
    const warmth = clamp(temperature * .7 + light * .3);
    return {
      light,
      humidity,
      temperature,
      skyTop: rgb([24, 48, 56], [150 + Math.round(warmth * 14), 198 - Math.round(temperature * 14), 182 - Math.round(temperature * 22)], light),
      skyBottom: rgb([47, 77, 66], [240, 226 - Math.round(temperature * 20), 170 - Math.round(temperature * 18)], light),
      sunColor: rgb([213, 224, 201], [255, 225 - Math.round(temperature * 15), 139], warmth)
    };
  }

  window.EcoNodoExperience = Object.freeze({ sanitizeRows, visualState, sampleRows, CONTRACT_BOUNDS, VISUAL_BOUNDS });

  const stage = $('experience-stage');
  if (!stage) return;

  let readings = [];
  let quality = null;
  let activePeriod = 'hoy';
  let currentIndex = 0;
  let playing = false;
  let animationFrame = null;
  let playbackStarted = 0;
  let playbackDuration = 60000;
  let requestController = null;

  function formatDate(reading) {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(reading._timestamp));
  }

  function formatTime(reading) {
    return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(reading._timestamp));
  }

  /* El panel de la muestra nunca conserva fecha, hora, procedencia ni avisos de una lectura anterior
     cuando el periodo cambia, está vacío o falla. */
  function resetReadingPanel(dateText, sourceText) {
    $('experience-date').textContent = dateText;
    $('experience-time').textContent = '—:—';
    $('experience-source').textContent = sourceText;
    [['experience-temperature', 'experience-temperature-value'], ['experience-humidity', 'experience-humidity-value'], ['experience-light', 'experience-light-value']].forEach(([containerId, valueId]) => {
      $(valueId).textContent = '—';
      const container = $(containerId);
      container.classList.toggle('is-limited', false);
      const note = container.querySelector('em');
      if (note) note.hidden = true;
    });
  }

  function setVisual(reading) {
    const state = visualState(reading);
    stage.style.setProperty('--sky-top', state.skyTop);
    stage.style.setProperty('--sky-bottom', state.skyBottom);
    stage.style.setProperty('--sun-color', state.sunColor);
    stage.style.setProperty('--sun-opacity', (.12 + state.light * .88).toFixed(3));
    stage.style.setProperty('--sun-y', `${34 - state.light * 19}%`);
    stage.style.setProperty('--mist-opacity', (.08 + state.humidity * .48).toFixed(3));
    stage.style.setProperty('--warmth-opacity', (.06 + state.temperature * .34).toFixed(3));
    stage.style.setProperty('--scene-saturation', (.84 + state.light * .2).toFixed(3));
  }

  function updateMetric(elementId, valueId, key, value, digits) {
    const limited = Boolean(readings[currentIndex]?._limited?.[key]);
    $(valueId).textContent = number(value, digits);
    const container = $(elementId);
    container.classList.toggle('is-limited', limited);
    const note = container.querySelector('em');
    if (note) note.hidden = !limited;
  }

  function setReading(index) {
    if (!readings.length) return;
    currentIndex = Math.round(clamp(Number(index) || 0, 0, readings.length - 1));
    const reading = readings[currentIndex];
    setVisual(reading);
    $('experience-date').textContent = formatDate(reading);
    $('experience-time').textContent = formatTime(reading);
    updateMetric('experience-temperature', 'experience-temperature-value', 'temperature_c', reading.temperature_c, 1);
    updateMetric('experience-humidity', 'experience-humidity-value', 'humidity_pct', reading.humidity_pct, 1);
    updateMetric('experience-light', 'experience-light-value', 'illuminance_lux', reading.illuminance_lux, 0);
    const anyLimited = Object.values(reading._limited).some(Boolean);
    const origin = typeof reading.node_id === 'string' && reading.node_id ? ` desde ${reading.node_id}` : '';
    $('experience-source').textContent = anyLimited ?
      'El valor numérico se conserva. Su efecto visual está limitado para proteger la escena.' :
      `Recibida por el servidor${origin}.`;
    $('experience-timeline').value = String(currentIndex);
    $('experience-progress').textContent = `${PERIOD_LABELS[activePeriod] || 'Periodo'} · momento ${currentIndex + 1} de ${readings.length} · ${formatTime(reading)}`;
  }

  function stopPlayback({ completed = false } = {}) {
    playing = false;
    stage.dataset.playing = 'false';
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
    const button = $('experience-play');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = completed ? '<span aria-hidden="true">↺</span> Repetir el día' : '<span aria-hidden="true">▶</span> Continuar recorrido';
  }

  function playbackTick(now) {
    if (!playing || readings.length < 2) return;
    const progress = clamp((now - playbackStarted) / playbackDuration);
    const nextIndex = Math.floor(progress * (readings.length - 1));
    if (nextIndex !== currentIndex) setReading(nextIndex);
    if (progress >= 1) { stopPlayback({ completed: true }); return; }
    animationFrame = requestAnimationFrame(playbackTick);
  }

  function startPlayback() {
    if (readings.length < 2) return;
    if (currentIndex >= readings.length - 1) setReading(0);
    playing = true;
    stage.dataset.playing = 'true';
    const progress = currentIndex / (readings.length - 1);
    playbackStarted = performance.now() - progress * playbackDuration;
    const button = $('experience-play');
    button.setAttribute('aria-pressed', 'true');
    button.innerHTML = '<span aria-hidden="true">❚❚</span> Pausar recorrido';
    animationFrame = requestAnimationFrame(playbackTick);
  }

  function applyEmptyState(period) {
    readings = [];
    currentIndex = 0;
    setVisual(null);
    stage.classList.toggle('is-loading', false);
    stage.dataset.state = 'empty';
    $('experience-state').querySelector('b').textContent = period === 'hoy' ? 'Sin lecturas registradas hoy' : 'Sin lecturas en las últimas 24 horas';
    $('experience-progress').textContent = 'El paisaje permanece en un estado neutro.';
    $('experience-quality').textContent = 'No hay datos que representar; no se generan valores ficticios.';
    $('experience-play').disabled = true;
    $('experience-play').setAttribute('aria-pressed', 'false');
    $('experience-play').innerHTML = '<span aria-hidden="true">▶</span> Reproducir el día';
    $('experience-timeline').disabled = true;
    $('experience-timeline').max = '0';
    $('experience-timeline').value = '0';
    $('timeline-start').textContent = '—';
    $('timeline-end').textContent = '—';
    resetReadingPanel('Sin lectura', 'No hay una lectura que mostrar en este periodo.');
  }

  function qualityMessage(result) {
    const parts = [`${number(result.validCount, 0)} lecturas válidas`];
    if (result.visuallyLimited) parts.push(`${number(result.visuallyLimited, 0)} con efecto visual limitado`);
    if (result.rejected) parts.push(`${number(result.rejected, 0)} descartadas por formato o rango`);
    if (result.truncated) parts.push(`${number(result.truncated, 0)} omitidas por volumen`);
    if (result.sampled) parts.push(`recorrido resumido a ${MAX_PLAYBACK_ROWS} momentos`);
    return `${parts.join(' · ')}.`;
  }

  function applyHistory(result, period, selection = null) {
    quality = result;
    readings = result.rows;
    if (!readings.length) { applyEmptyState(period); return; }
    stage.classList.toggle('is-loading', false);
    stage.dataset.state = 'ready';
    $('experience-state').querySelector('b').textContent = period === 'hoy' ? 'Recorrido de hoy listo' : 'Recorrido de 24 horas listo';
    $('experience-quality').textContent = qualityMessage(result);
    $('experience-error').hidden = true;
    const timeline = $('experience-timeline');
    timeline.max = String(readings.length - 1);
    timeline.disabled = readings.length < 2;
    $('experience-play').disabled = readings.length < 2;
    $('experience-play').setAttribute('aria-pressed', 'false');
    $('experience-play').innerHTML = '<span aria-hidden="true">▶</span> Reproducir el día';
    playbackDuration = Math.min(60000, Math.max(15000, readings.length * 900));
    $('timeline-start').textContent = formatTime(readings[0]);
    $('timeline-end').textContent = formatTime(readings[readings.length - 1]);
    const previous = selection ? readings.findIndex(row => row.id === selection.id && row._timestamp === selection.timestamp) : -1;
    setReading(selection?.latest ? readings.length - 1 : Math.max(0, previous));
  }

  function syncPeriodButtons() {
    document.querySelectorAll('[data-experience-period]').forEach((button) => {
      const active = button.dataset.experiencePeriod === activePeriod;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  async function loadPeriod(period, allowFallback = true, background = false) {
    const selected = readings[currentIndex];
    const selection = background ? { id: selected?.id, timestamp: selected?._timestamp, latest: !selected || currentIndex === readings.length - 1 } : null;
    stopPlayback();
    if (requestController) requestController.abort();
    requestController = new AbortController();
    const controller = requestController;
    const timeout = setTimeout(() => controller.abort(), 8000);
    activePeriod = period;
    syncPeriodButtons();
    if (!background) {
      stage.classList.toggle('is-loading', true);
      stage.dataset.state = 'loading';
      $('experience-state').querySelector('b').textContent = 'Preparando el recorrido';
      resetReadingPanel('Esperando datos', 'Los valores conservan la lectura recibida por el servidor.');
    }
    $('experience-error').hidden = true;
    try {
      const response = await fetch(`/api/historial?periodo=${period}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Respuesta ${response.status}`);
      const data = await response.json();
      if (controller !== requestController) return;
      const result = sanitizeRows(data?.readings);
      if (!result.rows.length && period === 'hoy' && allowFallback) {
        clearTimeout(timeout);
        await loadPeriod('24h', false);
        if (readings.length) $('experience-state').querySelector('b').textContent = 'Hoy está vacío · mostrando 24 horas';
        return;
      }
      applyHistory(result, period, selection);
    } catch (error) {
      if (controller !== requestController || error?.name === 'AbortError' && controller.signal.aborted && requestController !== controller) return;
      readings = [];
      currentIndex = 0;
      stage.classList.toggle('is-loading', false);
      stage.dataset.state = 'error';
      setVisual(null);
      $('experience-state').querySelector('b').textContent = 'Recorrido no disponible';
      $('experience-error').hidden = false;
      $('experience-progress').textContent = 'No fue posible consultar el historial.';
      $('experience-quality').textContent = 'No hay lecturas verificadas que representar.';
      $('experience-play').disabled = true;
      $('experience-play').setAttribute('aria-pressed', 'false');
      $('experience-play').innerHTML = '<span aria-hidden="true">▶</span> Reproducir el día';
      $('experience-timeline').disabled = true;
      $('experience-timeline').max = '0';
      $('experience-timeline').value = '0';
      $('timeline-start').textContent = '—';
      $('timeline-end').textContent = '—';
      resetReadingPanel('Sin lectura', 'No se pudo consultar el historial: no hay una lectura que mostrar.');
    } finally {
      clearTimeout(timeout);
      if (requestController === controller) requestController = null;
    }
  }

  $('experience-play').addEventListener('click', () => playing ? stopPlayback() : startPlayback());
  $('experience-timeline').addEventListener('input', (event) => {
    if (playing) stopPlayback();
    setReading(event.target.value);
  });
  document.querySelectorAll('[data-experience-period]').forEach((button) => button.addEventListener('click', () => loadPeriod(button.dataset.experiencePeriod)));
  $('experience-retry').addEventListener('click', () => loadPeriod(activePeriod, false));
  $('quality-details').addEventListener('click', () => {
    const explanation = $('quality-explanation');
    const expanded = explanation.hidden;
    explanation.hidden = !expanded;
    $('quality-details').setAttribute('aria-expanded', String(expanded));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stopPlayback(); });

  setVisual(null);
  loadPeriod('hoy');
  const interval = Number(document.body?.dataset?.refreshInterval) || 5;
  setInterval(() => {
    // No interrumpir un recorrido ni solapar peticiones en una red lenta.
    if (!document.hidden && !playing && !requestController) return loadPeriod(activePeriod, false, true);
  }, Math.max(2000, interval * 1000));
})();
