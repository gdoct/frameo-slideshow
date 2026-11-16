// Split-flap clock with date and current weather (open-meteo.com, no API key).
// Location defaults to De Bilt; override with ?lat=52.37&lon=4.90 in the URL.
const params = new URLSearchParams(location.search);
const LAT = Number(params.get('lat')) || 52.10;
const LON = Number(params.get('lon')) || 5.18;
const WEATHER_EVERY = 15 * 60 * 1000;

const DAYS = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];
const MONTHS = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];

// WMO weather codes -> Dutch description
const WMO = {
  0: 'Onbewolkt', 1: 'Overwegend helder', 2: 'Half bewolkt', 3: 'Bewolkt',
  45: 'Mist', 48: 'Rijpende mist',
  51: 'Lichte motregen', 53: 'Motregen', 55: 'Dichte motregen', 56: 'Ijzel', 57: 'Ijzel',
  61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen', 66: 'IJzel', 67: 'IJzel',
  71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 77: 'Korrelsneeuw',
  80: 'Lichte buien', 81: 'Buien', 82: 'Zware buien', 85: 'Sneeuwbuien', 86: 'Zware sneeuwbuien',
  95: 'Onweer', 96: 'Onweer met hagel', 99: 'Onweer met hagel',
};

function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...kids);
  return e;
}

// One split-flap card. set(ch) flips from the old character to the new one.
function flap() {
  const half = (pos, ch) => h('div', `half ${pos}`, h('span', '', ch));
  const top = half('t', ' '), bottom = half('b', ' ');
  const el = h('div', 'flap', top, bottom);
  let value = ' ';
  return {
    el,
    set(ch, animate = true) {
      if (ch === value) return;
      const old = value;
      value = ch;
      if (!animate) {
        top.firstChild.textContent = bottom.firstChild.textContent = ch;
        return;
      }
      // Static top shows the new char at once; the falling leaf covers it until it flips.
      const fallTop = half('t fall', old), riseBottom = half('b rise', ch);
      top.firstChild.textContent = ch;
      el.append(fallTop, riseBottom);
      riseBottom.addEventListener('animationend', () => {
        bottom.firstChild.textContent = value;
        fallTop.remove(); riseBottom.remove();
      }, { once: true });
    },
  };
}

function flapRow(len, cls = '') {
  const cards = Array.from({ length: len }, flap);
  let first = true;
  return {
    el: h('div', `flaps ${cls}`, ...cards.map(c => c.el)),
    set(str) {
      const s = str.padEnd(len).slice(0, len);
      cards.forEach((c, i) => c.set(s[i], !first));
      first = false;
    },
  };
}

export default {
  name: 'clock',
  label: 'Klok',
  create() {
    const hours = flapRow(2), minutes = flapRow(2);
    const date = flapRow(9, 'small');          // "MA 16 NOV"
    const temp = flapRow(3, 'small');          // "12°" / "-3°"
    const desc = h('div', 'weather-text', '');

    const el = h('div', 'clock',
      h('div', 'time', hours.el, h('div', 'colon', ':'), minutes.el),
      date.el,
      h('div', 'weather', temp.el, desc));

    let lastMinute = -1;
    function tick() {
      const now = new Date();
      if (now.getMinutes() === lastMinute) return;
      lastMinute = now.getMinutes();
      hours.set(String(now.getHours()).padStart(2, '0'));
      minutes.set(String(now.getMinutes()).padStart(2, '0'));
      date.set(`${DAYS[now.getDay()]} ${String(now.getDate()).padStart(2, ' ')} ${MONTHS[now.getMonth()]}`);
    }

    async function weather() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
          + '&current=temperature_2m,weather_code,wind_speed_10m'
          + '&daily=temperature_2m_min,temperature_2m_max&forecast_days=1&timezone=auto';
        const d = await (await fetch(url)).json();
        const t = Math.round(d.current.temperature_2m);
        temp.set(`${t}°`.padStart(3));
        const lo = Math.round(d.daily.temperature_2m_min[0]), hi = Math.round(d.daily.temperature_2m_max[0]);
        desc.textContent = `${WMO[d.current.weather_code] ?? ''} · ${lo}° / ${hi}° · wind ${Math.round(d.current.wind_speed_10m)} km/u`;
      } catch {
        desc.textContent = 'Weer niet beschikbaar';
      }
    }

    tick();
    temp.set(' --');
    weather();
    const t1 = setInterval(tick, 1000);
    const t2 = setInterval(weather, WEATHER_EVERY);
    return { el, stop: () => { clearInterval(t1); clearInterval(t2); } };
  },
};
