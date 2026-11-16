// Slideshow host: picks the slideshow from the URL path (/picsum, /nas, /clock, /wire),
// swipe left/right = next/previous photo, swipe up = next slideshow, swipe down = reload.
//
// A slideshow module exports { name, label, create() } where create() returns
// { el, next?(), prev?(), stop?() }. Add new ones to SHOWS below.
import picsum from './shows/picsum.js';
import nas from './shows/nas.js';
import clock from './shows/clock.js';
import wire from './shows/wire.js';

const SHOWS = [picsum, nas, clock, wire];
const DEFAULT = 'picsum';

const params = new URLSearchParams(location.search);
const INTERVAL = (Number(params.get('interval')) || 30) * 1000;   // ?interval=seconds
const SWIPE_MIN = 50;      // px
const SLIDE_MS = 600;      // keep in sync with .show transition in style.css

const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const hudName = document.getElementById('hud-name');
const hudDots = document.getElementById('hud-dots');

const mod = (n, m) => ((n % m) + m) % m;
let index = -1;
let current = null;

function open(i, dir = 0) {
  index = mod(i, SHOWS.length);
  const def = SHOWS[index];
  const inst = def.create();
  inst.el.classList.add('show');

  const old = current;
  current = inst;
  if (old && dir) {
    // New show slides in from below (dir 1) or above (dir -1).
    inst.el.style.transform = `translateY(${dir * 100}%)`;
    stage.append(inst.el);
    inst.el.getBoundingClientRect();           // commit start position before animating
    inst.el.style.transform = '';
    old.el.style.transform = `translateY(${-dir * 100}%)`;
    setTimeout(() => { old.stop?.(); old.el.remove(); }, SLIDE_MS);
  } else {
    old?.stop?.();
    old?.el.remove();
    stage.append(inst.el);
  }

  history.replaceState(null, '', `/${def.name}${location.search}`);
  document.title = `Slideshow · ${def.label}`;
  flashHud(def.label);
  resetTimer();
}

let hudTimer;
function flashHud(label) {
  hudName.textContent = label;
  hudDots.replaceChildren(...SHOWS.map((_, i) => {
    const d = document.createElement('span');
    if (i === index) d.className = 'on';
    return d;
  }));
  hud.classList.add('on');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => hud.classList.remove('on'), 1800);
}

let autoTimer;
function resetTimer() {
  clearInterval(autoTimer);
  autoTimer = setInterval(() => current?.next?.(), INTERVAL);
}

const nextPhoto = () => { current?.next?.(); resetTimer(); };
const prevPhoto = () => { current?.prev?.(); resetTimer(); };
const nextShow = () => open(index + 1, 1);
const reload = () => location.reload();       // URL already names the current show

// --- gestures (touch + mouse drag via pointer events) ---
let start = null;
addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
addEventListener('pointercancel', () => { start = null; });
addEventListener('pointerup', e => {
  if (!start) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y;
  start = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  if (Math.abs(dx) > Math.abs(dy)) dx < 0 ? nextPhoto() : prevPhoto();
  else dy < 0 ? nextShow() : reload();
});

addEventListener('keydown', e => {
  const k = { ArrowRight: nextPhoto, ArrowLeft: prevPhoto, ArrowUp: nextShow, ArrowDown: reload }[e.key];
  if (k) { e.preventDefault(); k(); }
});

// --- start with the show named in the URL ---
const wanted = location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
const found = SHOWS.findIndex(s => s.name === wanted);
open(found >= 0 ? found : SHOWS.findIndex(s => s.name === DEFAULT));
