/* Portada de EcoNodo: estado actual, diario, ritmo, gráficas y registro.
   Estado, historial y diario se consultan y se pintan por separado: uno puede fallar sin detener a los otros.
   Ninguna cifra mostrada se inventa, se suaviza ni se recorta: los valores válidos se muestran tal cual. */
(() => {
  'use strict';

  const periods = { '1h': 'la última hora', '6h': 'las últimas seis horas', hoy: 'hoy', '24h': 'las últimas 24 horas', '7d': 'los últimos siete días' };
  const FALLBACK_COLORS = { '--c-temp': '#b05a36', '--c-humidity': '#3f7f78', '--c-light': '#a67c0e' };
  const chartIds = { temperature_c: 'temperature-chart', humidity_pct: 'humidity-chart', illuminance_lux: 'light-chart' };
  const emptyIds = { temperature_c: 'temperature-chart-empty', humidity_pct: 'humidity-chart-empty', illuminance_lux: 'light-chart-empty' };
  const METRICS = {
    temperature_c: { label: 'Temperatura', unit: '°C', digits: 1, color: '--c-temp', bounds: [-40, 80], gauge: (v) => (v + 40) / 120, ids: ['temperature-now', 'temperature-gauge'] },
    humidity_pct: { label: 'Humedad relativa', unit: '%', digits: 1, color: '--c-humidity', bounds: [0, 100], gauge: (v) => v / 100, ids: ['humidity-now', 'humidity-gauge'] },
    illuminance_lux: { label: 'Iluminancia', unit: 'lx', digits: 0, color: '--c-light', bounds: [0, 65535], gauge: (v) => Math.log1p(v) / Math.log1p(65535), ids: ['light-now', 'light-gauge'] }
  };
  const KEYS = Object.keys(METRICS);
  const MAX_SOURCE_ROWS = 5000;      // Igual que el observatorio: un historial extenso no sobrecarga la página.
  const timing = (key, fallback) => {
    const value = Number(document.body?.dataset?.[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const NOMINAL_MS = timing('readingInterval', 10) * 1000;
  const GAP_MS = timing('gapSeconds', 1200) * 1000;
  const REFRESH_MS = Math.max(2000, timing('refreshInterval', 5) * 1000);
  const MAX_RHYTHM_BUCKETS = 40;
  const charts = {};
  let activePeriod = 'hoy';
  let hasLoadedData = false;
  let shownPeriod = null;
  let refreshId = 0;
  let pendingController = null;
  let renderPeriod = 'hoy';

  const $ = (id) => document.getElementById(id);
  const setText = (id, text) => { const element = $(id); if (element) element.textContent = text; };
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

  // La hora se muestra siempre en la zona configurada en el servidor, no en la del navegador.
  const TZ = (() => {
    const raw = document.body && document.body.dataset ? document.body.dataset.timezone : '';
    if (!raw) return undefined;
    try { new Intl.DateTimeFormat('es-CO', { timeZone: raw }); return raw; } catch (_) { return undefined; }
  })();
  const formatters = new Map();
  const formatter = (options) => {
    const key = JSON.stringify(options);
    if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat('es-CO', { ...options, timeZone: TZ }));
    return formatters.get(key);
  };
  const numberFormats = new Map();
  function number(value, digits = 1) {
    if (!isNumber(value)) return '—';
    if (!numberFormats.has(digits)) numberFormats.set(digits, new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
    const safe = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
    return numberFormats.get(digits).format(safe).replace(/^-/, '−');
  }
  const toDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
  const dateTime = (value, options) => { const date = value instanceof Date ? value : toDate(value); return date ? formatter(options).format(date) : '—'; };
  const clock = (value) => dateTime(value, { hour: '2-digit', minute: '2-digit' });
  const timeLabel = (value, period) => dateTime(value, period === '7d' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
  const unitText = (key, value) => `${number(value, METRICS[key].digits)} ${METRICS[key].unit}`;
  const plural = (count, one, many) => `${number(count, 0)} ${count === 1 ? one : many}`;

  function dayWord(date) {
    const key = (d) => formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const now = new Date();
    if (key(date) === key(now)) return 'hoy';
    if (key(date) === key(new Date(now.getTime() - 86400000))) return 'ayer';
    return formatter({ day: 'numeric', month: 'short' }).format(date);
  }
  function ageText(seconds) {
    if (!isNumber(seconds)) return '';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return `hace ${Math.floor(seconds)} s`;
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
    const days = Math.floor(hours / 24);
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  }

  /* Valida filas del historial: fecha legible y tres cifras finitas dentro del contrato.
     Las cifras válidas, aunque extremas, se conservan íntegras. */
  function cleanReadings(input) {
    const source = Array.isArray(input) ? input : [];
    const limited = source.length > MAX_SOURCE_ROWS ? source.slice(-MAX_SOURCE_ROWS) : source;
    const rows = [];
    let rejected = 0;
    limited.forEach((row) => {
      if (!row || typeof row !== 'object') { rejected += 1; return; }
      const date = toDate(row.received_at_local || row.received_at_utc);
      if (!date) { rejected += 1; return; }
      const clean = { t: date.getTime(), node_id: typeof row.node_id === 'string' ? row.node_id : '' };
      for (const key of KEYS) {
        const [min, max] = METRICS[key].bounds;
        const value = row[key];
        if (!isNumber(value) || value < min || value > max) { rejected += 1; return; }
        clean[key] = value;
      }
      rows.push(clean);
    });
    rows.sort((a, b) => a.t - b.t);
    return { rows, rejected, truncated: Math.max(0, source.length - limited.length) };
  }

  async function getJSON(url, signal) {
    const response = await fetch(url, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Respuesta ${response.status}`);
    return response.json();
  }

  function setStatus(state, label) {
    const pill = $('connection-pill');
    pill.className = `connection-pill is-${state}`;
    setText('connection-text', label);
    const grid = $('metric-grid');
    if (grid) grid.dataset.freshness = state;
    const pulse = $('hero-pulse');
    if (pulse) pulse.dataset.state = state;
  }

  function showMessage(message) {
    const element = $('data-message');
    element.textContent = message;
    element.hidden = !message;
  }

  function setMetric(key, value) {
    const [valueId, gaugeId] = METRICS[key].ids;
    setText(valueId, number(value, METRICS[key].digits));
    const gauge = $(gaugeId);
    if (!gauge) return;
    const shown = isNumber(value);
    gauge.hidden = !shown;
    if (shown) gauge.style.setProperty('--pos', clamp(METRICS[key].gauge(value)).toFixed(4));
  }

  function setStamps(text) {
    ['temperature-stamp', 'humidity-stamp', 'light-stamp'].forEach((id) => setText(id, text));
  }

  function clearCurrentReadings(note, stamp) {
    KEYS.forEach((key) => setMetric(key, null));
    ['temperature-note', 'humidity-note', 'light-note'].forEach((id) => setText(id, note));
    setStamps(stamp || 'Sin lectura');
    setText('reading-time', 'Sin lectura actual disponible.');
  }

  function renderState(data) {
    const reading = data && data.latest && typeof data.latest === 'object' ? data.latest : null;
    if (!reading) {
      clearCurrentReadings('Esperando la primera lectura');
      setStatus('empty', 'Esperando lecturas');
      setText('hero-reading-time', data && data.demo ? 'Aún no hay lecturas de demostración.' : 'Esperando la primera lectura del nodo.');
      showMessage(data && data.demo ? 'La demostración está lista, pero aún no tiene lecturas. Ejecuta el cargador de muestra indicado en README.md.' : 'El nodo todavía no ha enviado una lectura. El diario se completará cuando comiencen las mediciones.');
      setText('reading-time', 'La hora la asigna el servidor cuando recibe cada lectura.');
      return;
    }
    KEYS.forEach((key) => setMetric(key, isNumber(reading[key]) ? reading[key] : null));
    setText('temperature-note', 'Aire en el punto de medición');
    setText('humidity-note', 'Vapor de agua en el aire');
    setText('light-note', 'Luz recibida por el sensor');
    const received = toDate(reading.received_at_local || reading.received_at_utc);
    const age = isNumber(data.age_seconds) ? data.age_seconds : received ? Math.max(0, (Date.now() - received.getTime()) / 1000) : null;
    const ago = ageText(age);
    const when = received ? `${dayWord(received)} a las ${clock(received)}` : 'fecha no disponible';
    const node = typeof reading.node_id === 'string' && reading.node_id ? ` · nodo ${reading.node_id}` : '';
    const stamp = received ? dateTime(received, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'fecha no disponible';
    setText('reading-time', `Recibida por el servidor el ${stamp}${TZ ? ` (${TZ})` : ''}${node} · Total acumulado: ${number(isNumber(data.total_readings) ? data.total_readings : 0, 0)}.`);
    if (data.state === 'actualizado') {
      setStatus('fresh', 'Lectura reciente');
      setStamps(ago ? `Recibida ${ago}` : 'Recibida hace poco');
      setText('hero-reading-time', `Última lectura ${when}${ago ? ` · ${ago}` : ''}${data.demo ? ' · simulada' : ''}`);
      showMessage(data.demo ? 'Estás explorando datos de demostración. No representan mediciones del lugar.' : '');
    } else {
      setStatus('stale', 'Sin actualización reciente');
      setStamps(`Dato histórico · recibido ${ago || 'hace tiempo'}`);
      setText('hero-reading-time', `Sin lectura nueva · la última fue ${when}${ago ? ` (${ago})` : ''}`);
      const minutes = isNumber(age) ? Math.max(1, Math.floor(age / 60)) : null;
      showMessage(`La última lectura llegó ${minutes ? `hace aproximadamente ${minutes} min` : 'hace un tiempo'}. Los valores siguen visibles como registro histórico; comprueba el nodo, la red y el servidor.${data.demo ? ' Estos datos son simulados.' : ''}`);
    }
  }

  function renderStory(story) {
    const chapters = story && Array.isArray(story.chapters) ? story.chapters : [];
    const container = $('story-grid');
    container.replaceChildren();
    container.dataset.count = String(chapters.length);
    chapters.forEach((chapter, index) => {
      const card = document.createElement('article');
      const tone = ['temperature', 'humidity', 'light', 'change', 'neutral'].includes(chapter.tone) ? chapter.tone : 'neutral';
      const kind = ['data', 'guide', 'reflection', 'empty'].includes(chapter.kind) ? chapter.kind : 'guide';
      const role = index === 0 ? 'lead' : index === chapters.length - 1 ? 'closing' : 'mid';
      card.className = `chapter chapter-${kind} chapter-tone-${tone} chapter-${role}`;
      const head = document.createElement('div');
      head.className = 'chapter-head';
      const numberEl = document.createElement('span');
      numberEl.className = 'chapter-number';
      numberEl.textContent = String(chapter.number ?? String(index + 1).padStart(2, '0'));
      const eyebrow = document.createElement('span');
      eyebrow.className = 'chapter-eyebrow';
      eyebrow.textContent = String(chapter.eyebrow ?? '');
      head.append(numberEl, eyebrow);
      const heading = document.createElement('h3');
      heading.textContent = String(chapter.title ?? '');
      const body = document.createElement('p');
      body.className = 'chapter-body';
      body.textContent = String(chapter.body ?? '');
      const evidence = document.createElement('footer');
      evidence.className = 'chapter-evidence';
      const mark = document.createElement('span');
      mark.className = 'chapter-signal-mark';
      mark.setAttribute('aria-hidden', 'true');
      const label = document.createElement('small');
      label.className = 'chapter-signal-label';
      label.textContent = String(chapter.signal_label || (kind === 'data' ? 'Basado en lecturas' : 'Guía de observación'));
      const value = document.createElement('strong');
      value.className = 'chapter-signal-value';
      value.textContent = String(chapter.signal_value || (kind === 'data' ? 'dato observado' : 'contexto'));
      evidence.append(mark, label, value);
      if (chapter.evidence) {
        const provenance = document.createElement('p');
        provenance.className = 'chapter-provenance';
        provenance.textContent = `Se apoya en: ${chapter.evidence}.`;
        evidence.append(provenance);
      }
      card.append(head, heading, body, evidence);
      container.append(card);
    });
  }

  /* Ritmo del periodo: intervalos de tiempo iguales entre la primera y la última lectura.
     Un intervalo sin lecturas se dibuja como marca discontinua, nunca como barra. */
  function renderRhythm(rows, period) {
    const track = $('rhythm-track');
    if (!rows.length) {
      track.className = 'rhythm-track is-empty';
      const empty = document.createElement('p');
      empty.textContent = 'Las próximas lecturas dibujarán el ritmo del lugar.';
      track.replaceChildren(empty);
      track.setAttribute('aria-label', 'Ritmo ambiental todavía sin lecturas');
      setText('rhythm-start', '—');
      setText('rhythm-highlight', 'Esperando señales');
      setText('rhythm-end', '—');
      setText('rhythm-scale', '');
      setText('rhythm-summary', `No hay lecturas para ${periods[period]}.`);
      return;
    }
    const first = rows[0].t;
    const last = rows[rows.length - 1].t;
    const span = last - first;
    const count = span <= 0 ? 1 : clamp(Math.round(span / NOMINAL_MS) + 1, 1, MAX_RHYTHM_BUCKETS);
    const buckets = Array.from({ length: count }, () => []);
    rows.forEach((row) => { buckets[count === 1 ? 0 : Math.min(count - 1, Math.floor(((row.t - first) / span) * count))].push(row); });
    const bounds = {};
    KEYS.forEach((key) => { bounds[key] = rows.reduce((range, row) => [Math.min(range[0], row[key]), Math.max(range[1], row[key])], [Infinity, -Infinity]); });
    const normalized = (value, key) => { const [min, max] = bounds[key]; return max === min ? .5 : clamp((value - min) / (max - min)); };
    const average = (bucket, key) => bucket.reduce((sum, row) => sum + row[key], 0) / bucket.length;
    let gaps = 0;
    const segments = buckets.map((bucket, index) => {
      const segment = document.createElement('span');
      segment.className = 'rhythm-segment';
      segment.setAttribute('aria-hidden', 'true');
      const from = first + (span * index) / count;
      const to = first + (span * (index + 1)) / count;
      if (!bucket.length) {
        gaps += 1;
        segment.className = 'rhythm-segment is-gap';
        segment.title = `Sin lecturas entre ${timeLabel(from, period)} y ${timeLabel(to, period)}`;
        return segment;
      }
      const light = average(bucket, 'illuminance_lux');
      const temperature = average(bucket, 'temperature_c');
      const humidity = average(bucket, 'humidity_pct');
      segment.style.setProperty('--bar-height', `${(14 + normalized(light, 'illuminance_lux') * 86).toFixed(1)}%`);
      segment.style.setProperty('--temp-alpha', (.35 + normalized(temperature, 'temperature_c') * .6).toFixed(2));
      segment.style.setProperty('--humidity-alpha', (.35 + normalized(humidity, 'humidity_pct') * .6).toFixed(2));
      segment.title = `${timeLabel(bucket[0].t, period)}${bucket.length > 1 ? ` – ${timeLabel(bucket[bucket.length - 1].t, period)}` : ''} · ${unitText('temperature_c', temperature)} · ${unitText('humidity_pct', humidity)} · ${unitText('illuminance_lux', light)}${bucket.length > 1 ? ` (promedio de ${bucket.length} lecturas)` : ''}`;
      return segment;
    });
    track.className = 'rhythm-track';
    track.replaceChildren(...segments);

    const peak = rows.reduce((best, row) => row.illuminance_lux > best.illuminance_lux ? row : best, rows[0]);
    const [minT, maxT] = bounds.temperature_c;
    const [minL, maxL] = bounds.illuminance_lux;
    // timeLabel puede terminar en «a. m.» o «p. m.»: se quita ese punto final para no duplicarlo.
    const peakTime = timeLabel(peak.t, period).replace(/\.$/, '');
    const label = `${plural(rows.length, 'lectura', 'lecturas')} de ${periods[period]}. La luz más alta observada fue ${unitText('illuminance_lux', peak.illuminance_lux)} a las ${peakTime}. La temperatura estuvo entre ${number(minT)} y ${number(maxT)} °C.${gaps ? ' Hay tramos sin lecturas, dibujados como huecos.' : ''}`;
    track.setAttribute('aria-label', label);
    setText('rhythm-summary', label);
    setText('rhythm-start', timeLabel(first, period));
    setText('rhythm-highlight', `Más luz · ${timeLabel(peak.t, period)} · ${unitText('illuminance_lux', peak.illuminance_lux)}`);
    setText('rhythm-end', timeLabel(last, period));
    setText('rhythm-scale', `Altura: de ${unitText('illuminance_lux', minL)} (mínimo) a ${unitText('illuminance_lux', maxL)} (máximo) en este periodo. Escala propia de este periodo.${gaps ? ' Las marcas discontinuas son tramos sin lecturas.' : ''}`);
  }

  function renderGapNote(rows) {
    const note = $('gap-note');
    if (!note) return;
    let count = 0;
    let longest = 0;
    for (let i = 1; i < rows.length; i += 1) {
      const gap = rows[i].t - rows[i - 1].t;
      if (gap >= GAP_MS) { count += 1; longest = Math.max(longest, gap); }
    }
    note.hidden = !count;
    if (!count) { note.textContent = ''; return; }
    const minutes = Math.round(longest / 60000);
    const longestText = minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
    const threshold = GAP_MS < 120000 ? `${GAP_MS / 1000} segundos` : `${GAP_MS / 60000} minutos`;
    note.textContent = `${plural(count, 'pausa', 'pausas')} de más de ${threshold} sin lecturas (la mayor, de ${longestText}). Las gráficas la muestran como un corte en la línea: no hay observaciones en ese tramo.`;
  }

  /* ───── Gráficas ───── */
  function cssColor(name) {
    try {
      const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (value) return value;
    } catch (_) { /* Sin estilos calculados: color de respaldo. */ }
    return FALLBACK_COLORS[name];
  }
  function withAlpha(color, alpha) {
    const match = /^#([0-9a-f]{6})$/i.exec(color);
    if (!match) return color;
    const n = parseInt(match[1], 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  function zoneOffset(ts) {
    if (!TZ) return -new Date(ts).getTimezoneOffset() * 60000;
    const parts = formatter({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts));
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - (ts - (ts % 1000));
  }
  const TICK_STEP = { '1h': 10 * 60000, '6h': 3600000, hoy: 3 * 3600000, '24h': 4 * 3600000, '7d': 86400000 };
  function niceTicks(min, max, period, limit) {
    if (!(max > min)) return [min];
    let step = TICK_STEP[period] || 3600000;
    const count = () => Math.floor((max - min) / step) + 1;
    while (count() > limit) step *= 2;
    const offset = zoneOffset(min);
    const ticks = [];
    for (let value = Math.ceil((min + offset) / step) * step - offset; value <= max; value += step) ticks.push(value);
    return ticks.length >= 2 ? ticks : [min, min + (max - min) / 2, max];
  }
  function tickLabel(value) {
    return renderPeriod === '7d' ? dateTime(value, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric' }).replace(/,/g, '') : dateTime(value, { hour: 'numeric', minute: '2-digit' });
  }
  // Un corte en la línea significa «sin observaciones»: no se interpola a través de una pausa larga.
  function chartPoints(rows, key) {
    const points = [];
    rows.forEach((row, index) => {
      if (index && row.t - rows[index - 1].t > GAP_MS) points.push({ x: (row.t + rows[index - 1].t) / 2, y: null });
      points.push({ x: row.t, y: row[key] });
    });
    return points;
  }
  function chartDomain(rows) {
    const first = rows[0].t;
    const last = rows[rows.length - 1].t;
    return last > first ? [first, last] : [first - 600000, last + 600000];
  }
  function describeChart(key, rows, period) {
    const values = rows.map((row) => row[key]);
    const latest = rows[rows.length - 1];
    return `Gráfica de ${METRICS[key].label.toLowerCase()} de ${periods[period]}: de ${unitText(key, Math.min(...values))} a ${unitText(key, Math.max(...values))}; último valor ${unitText(key, latest[key])} a las ${timeLabel(latest.t, period)}.`;
  }

  function renderChart(key, rows, period) {
    const canvas = $(chartIds[key]);
    const empty = $(emptyIds[key]);
    empty.textContent = 'Las próximas lecturas dibujarán esta curva.';
    empty.hidden = rows.length > 0;
    canvas.hidden = rows.length === 0;
    if (!rows.length || !window.Chart) {
      if (charts[key]) { charts[key].destroy(); delete charts[key]; }
      if (rows.length && !window.Chart) {
        canvas.hidden = true;
        empty.textContent = 'No se pudo cargar la gráfica. Las lecturas siguen disponibles en la tabla y el CSV.';
        empty.hidden = false;
      }
      return;
    }
    renderPeriod = period;
    canvas.setAttribute('aria-label', describeChart(key, rows, period));
    const [min, max] = chartDomain(rows);
    const points = chartPoints(rows, key);
    const radius = rows.length <= 40 ? 3 : 0;
    if (charts[key]) {
      const chart = charts[key];
      chart.data.datasets[0].data = points;
      chart.data.datasets[0].pointRadius = radius;
      chart.options.scales.x.min = min;
      chart.options.scales.x.max = max;
      chart.update('none');
      return;
    }
    const color = cssColor(METRICS[key].color);
    const ink = '#4b6358';
    const reduce = document.documentElement.classList.contains('motion-paused') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const yScale = { grid: { color: 'rgba(16,51,42,.12)', drawTicks: false }, border: { display: false }, ticks: { color: ink, padding: 10, maxTicksLimit: 5, font: { size: 12 }, callback: (v) => number(v, Number.isInteger(v) ? 0 : 1) } };
    if (key === 'humidity_pct') { yScale.min = 0; yScale.max = 100; }
    else if (key === 'illuminance_lux') { yScale.beginAtZero = true; yScale.grace = '8%'; }
    else yScale.grace = '10%';
    charts[key] = new Chart(canvas, {
      type: 'line',
      data: { datasets: [{ data: points, borderColor: color, backgroundColor: withAlpha(color, .13), borderWidth: 2.25, pointRadius: radius, pointHoverRadius: 5, pointBackgroundColor: color, pointBorderColor: '#fbf8ef', pointBorderWidth: 1.5, tension: 0, fill: true, spanGaps: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false, normalized: true,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        animation: { duration: reduce ? 0 : 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false, backgroundColor: '#10332a', titleColor: '#eef2dc', bodyColor: '#eef2dc', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 14, weight: '700' },
            callbacks: {
              title: (items) => (items.length ? dateTime(items[0].parsed.x, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''),
              label: (context) => unitText(key, context.parsed.y)
            }
          }
        },
        scales: {
          x: {
            type: 'linear', min, max, grid: { display: false }, border: { display: false },
            ticks: { color: ink, maxRotation: 0, font: { size: 12 }, callback: tickLabel },
            afterBuildTicks: (axis) => { axis.ticks = niceTicks(axis.min, axis.max, renderPeriod, axis.chart && axis.chart.width < 520 ? 4 : 6).map((value) => ({ value })); }
          },
          y: yScale
        }
      }
    });
  }

  function renderSummary(history, rows) {
    const total = Number.isInteger(history?.count) ? history.count : rows.length;
    setText('summary-count', total === 1 ? '1 lectura registrada' : `${number(total, 0)} lecturas registradas`);
    const container = $('summary-stats');
    container.replaceChildren();
    KEYS.forEach((key) => {
      const meta = METRICS[key];
      const entry = history && history.summary ? history.summary[key] : null;
      const block = document.createElement('div');
      block.className = 'stat-block';
      const title = document.createElement('strong');
      title.textContent = meta.label === 'Humedad relativa' ? 'Humedad' : meta.label === 'Iluminancia' ? 'Luz' : meta.label;
      block.append(title);
      if (!entry || !isNumber(entry.min) || !isNumber(entry.max) || !isNumber(entry.avg)) {
        const none = document.createElement('p');
        none.className = 'stat-none';
        none.textContent = 'Sin datos en el periodo';
        block.append(none);
      } else {
        const list = document.createElement('dl');
        list.className = 'stat-list';
        [['Mín.', entry.min], ['Máx.', entry.max], ['Prom.', entry.avg]].forEach(([name, value]) => {
          const row = document.createElement('div');
          const term = document.createElement('dt');
          term.textContent = name;
          const detail = document.createElement('dd');
          detail.textContent = unitText(key, value);
          row.append(term, detail);
          list.append(row);
        });
        block.append(list);
      }
      container.append(block);
    });
  }

  function tableMessage(text) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = text;
    row.append(cell);
    $('recent-rows').replaceChildren(row);
  }

  function renderTable(rows) {
    if (!rows.length) { tableMessage('Aún no hay lecturas en este periodo.'); return; }
    const tbody = $('recent-rows');
    tbody.replaceChildren();
    [...rows].reverse().slice(0, 8).forEach((reading) => {
      const row = document.createElement('tr');
      [dateTime(reading.t, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }), unitText('temperature_c', reading.temperature_c), unitText('humidity_pct', reading.humidity_pct), unitText('illuminance_lux', reading.illuminance_lux)].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      tbody.append(row);
    });
  }

  async function refresh() {
    const period = activePeriod;
    const id = ++refreshId;
    if (pendingController) pendingController.abort();
    const controller = new AbortController();
    pendingController = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    const isCurrent = () => id === refreshId;
    $('csv-link').href = `/api/exportacion.csv?periodo=${period}`;
    // Cada respuesta actualiza solo su parte. No espera al diario ni a Chart.js.
    const stateJob = getJSON('/api/estado', controller.signal).then((state) => {
      if (!isCurrent()) return;
      document.dispatchEvent(new CustomEvent('econodo:state', { detail: state }));
      renderState(state);
    }).catch(() => {
      if (!isCurrent()) return;
      document.dispatchEvent(new CustomEvent('econodo:state', { detail: { error: true, latest: null } }));
      clearCurrentReadings('Sin conexión · lectura no disponible', 'Sin conexión');
      setStatus('error', 'Sin conexión con el servidor');
      setText('hero-reading-time', 'Sin conexión con el servidor · lectura no disponible');
      showMessage('No fue posible consultar la lectura actual. Verifica que el servidor siga abierto. La carcasa continúa disponible.');
    });
    const historyJob = getJSON(`/api/historial?periodo=${period}`, controller.signal).then((history) => {
      if (!isCurrent()) return;
      const cleaned = cleanReadings(history && history.readings);
      const rows = cleaned.rows;
      // Tabla y estadísticas siguen disponibles aunque una gráfica falle.
      renderSummary(history, rows);
      renderTable(rows);
      renderRhythm(rows, period);
      renderGapNote(rows);
      Object.keys(chartIds).forEach((key) => {
        try { renderChart(key, rows, period); }
        catch (_) {
          $(chartIds[key]).hidden = true;
          $(emptyIds[key]).textContent = 'No se pudo dibujar la gráfica. Consulta la tabla o descarga el CSV.';
          $(emptyIds[key]).hidden = false;
        }
      });
      hasLoadedData = true;
      shownPeriod = period;
      const omitted = cleaned.rejected ? ` · ${plural(cleaned.rejected, 'lectura omitida', 'lecturas omitidas')} por formato o rango` : '';
      const volume = cleaned.truncated ? ` · Se dibujan las últimas ${MAX_SOURCE_ROWS} de ${number(history.count, 0)}; estadísticas y CSV incluyen todo el periodo` : '';
      setText('period-context', `Mostrando ${periods[period]} · ${plural(rows.length, 'lectura', 'lecturas')}${omitted}${volume}.`);
    }).catch(() => {
      if (!isCurrent()) return;
      setText('period-context', hasLoadedData ?
        `No se pudo actualizar ${periods[period]}. Se conserva la última consulta de ${periods[shownPeriod]}.` :
        'No se pudo actualizar el historial.');
      if (!hasLoadedData) {
        renderRhythm([], period);
        renderGapNote([]);
        tableMessage('No se pudo cargar la tabla. Revisa la conexión e intenta de nuevo.');
        setText('summary-count', 'Estadísticas no disponibles');
        Object.entries(emptyIds).forEach(([key, id]) => {
          $(chartIds[key]).hidden = true;
          $(id).textContent = 'Gráfica no disponible sin conexión.';
          $(id).hidden = false;
        });
      }
    });
    const storyJob = getJSON(`/api/diario?periodo=${period}`, controller.signal).then((story) => {
      if (!isCurrent()) return;
      renderStory(story);
      const note = $('story-update-note');
      if (note) note.hidden = true;
    }).catch(() => {
      if (!isCurrent()) return;
      const note = $('story-update-note');
      if (note) {
        note.textContent = 'El diario no se pudo actualizar. Si hay capítulos visibles, corresponden a la última consulta completada.';
        note.hidden = false;
      }
      const loading = $('story-grid').querySelector('.loading-copy');
      if (loading) loading.textContent = 'El relato estará disponible al recuperar la conexión.';
    });
    await Promise.allSettled([stateJob, historyJob, storyJob]);
    clearTimeout(timeout);
    if (isCurrent()) pendingController = null;
  }

  document.addEventListener('econodo:motion', (event) => {
    Object.values(charts).forEach((chart) => {
      chart.stop();
      chart.options.animation.duration = event.detail.paused ? 0 : 450;
    });
  });
  document.querySelectorAll('[data-period]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.period === activePeriod ? 'true' : 'false');
    button.addEventListener('click', () => {
      activePeriod = button.dataset.period;
      document.querySelectorAll('[data-period]').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      refresh();
    });
  });
  refresh();
  setInterval(() => {
    if (!document.hidden && !pendingController) return refresh();
  }, REFRESH_MS);
})();
