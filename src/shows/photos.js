// Shared photo viewer: crossfades between two <img> layers.
// `load()` resolves to urlAt(i) for any integer i (i can go negative on "prev").
export function photoShow({ name, label, load }) {
  return {
    name, label,
    create() {
      const el = document.createElement('div');
      el.className = 'photos';
      const layers = [new Image(), new Image()];
      layers.forEach(img => { img.alt = ''; img.draggable = false; el.append(img); });
      let front = 0, i = 0, token = 0, urlAt = null, stopped = false;

      async function go(delta) {
        if (!urlAt || stopped) return;
        i += delta;
        const t = ++token;
        const url = urlAt(i);
        const pre = new Image();
        pre.src = url;
        try { await pre.decode(); }
        catch { if (t === token && delta) go(Math.sign(delta)); return; }   // skip broken image
        if (t !== token || stopped) return;          // a newer swipe won
        const back = layers[1 - front];
        back.src = url;
        kenBurns(back);
        back.classList.add('on');
        layers[front].classList.remove('on');
        front = 1 - front;
        new Image().src = urlAt(i + 1);              // warm the cache for the next one
      }

      load().then(fn => { urlAt = fn; go(0); }).catch(err => {
        const msg = document.createElement('div');
        msg.className = 'message';
        msg.textContent = err.message;
        el.append(msg);
      });

      return {
        el,
        next: () => go(1),
        prev: () => go(-1),
        stop: () => { stopped = true; },
      };
    },
  };
}

// Ken Burns: very slow zoom in or out (randomly) around a random point, lasting
// as long as the photo is on screen (interval + crossfade).
const ZOOM = 1.06;
const KB_MS = ((Number(new URLSearchParams(location.search).get('interval')) || 30) + 2) * 1000;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function kenBurns(img) {
  img.getAnimations().forEach(a => a.cancel());
  if (reduceMotion) return;
  img.style.transformOrigin = `${20 + Math.random() * 60}% ${20 + Math.random() * 60}%`;
  const [from, to] = Math.random() < .5 ? [1, ZOOM] : [ZOOM, 1];
  img.animate([{ transform: `scale(${from})` }, { transform: `scale(${to})` }],
    { duration: KB_MS, easing: 'ease-in-out', fill: 'forwards' });
}

// Requested image size: the screen in device pixels, capped to keep downloads sane.
export function screenSize(max = 2560) {
  const dpr = devicePixelRatio || 1;
  let w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  const f = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * f), Math.round(h * f)];
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
