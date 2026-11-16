// Hypnotic wireframe animations in the spirit of the computer-generated TV
// interstitials ("tussenfilmpjes") of the early-to-mid 1980s: glowing vector
// lines on black, slowly turning geometry, tunnels and grids.
// Swipe left/right = next/previous scene; auto-advances with the slideshow interval.

const TAU = Math.PI * 2;
const { sin, cos, hypot, min, max, floor } = Math;
const clamp01 = x => min(1, max(0, x));
const smooth = x => x * x * (3 - 2 * x);

function rotate([x, y, z], ax, ay, az = 0) {
  let c = cos(ax), s = sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = cos(ay); s = sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = cos(az); s = sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

// Edges of a regular solid = all vertex pairs at the minimum distance.
function solid(verts, scale) {
  const d = (a, b) => hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let m = Infinity;
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) m = min(m, d(verts[i], verts[j]));
  const edges = [];
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) if (d(verts[i], verts[j]) < m * 1.01) edges.push([i, j]);
  const r = max(...verts.map(v => hypot(...v)));
  return { verts: verts.map(v => v.map(c => c / r * scale)), edges };
}
const PHI = (1 + Math.sqrt(5)) / 2;
const signs = [-1, 1];
const CUBE = [];
for (const x of signs) for (const y of signs) for (const z of signs) CUBE.push([x, y, z]);
const OCTA = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const ICOSA = [];
for (const a of signs) for (const b of signs)
  ICOSA.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);

// ---- renderer: collects camera-space segments, buckets them by colour, strokes with glow ----
function renderer(ctx) {
  const NEAR = 0.05, LEVELS = 8;
  const buckets = new Map();
  let W = 1, H = 1, F = 1, lw = 1;
  const r = {
    fog: null,                    // { near, far, min }: alpha falls from 1 to min between near and far
    resize(w, h) { W = w; H = h; F = min(w, h) * 0.9; lw = max(1, min(w, h) / 650); },
    begin() { buckets.clear(); r.fog = null; },
    line(p, q, hue, a = 1) {
      let [x1, y1, z1] = p, [x2, y2, z2] = q;
      if (z1 < NEAR && z2 < NEAR) return;
      if (z1 < NEAR) { const k = (NEAR - z1) / (z2 - z1); x1 += (x2 - x1) * k; y1 += (y2 - y1) * k; z1 = NEAR; }
      else if (z2 < NEAR) { const k = (NEAR - z2) / (z1 - z2); x2 += (x1 - x2) * k; y2 += (y1 - y2) * k; z2 = NEAR; }
      if (r.fog) {
        const { near, far, min: lo } = r.fog;
        a *= 1 - (1 - lo) * clamp01(((z1 + z2) / 2 - near) / (far - near));
      }
      const lvl = Math.round(clamp01(a) * LEVELS);
      if (!lvl) return;
      const key = `${((Math.round(hue / 8) * 8) % 360 + 360) % 360}:${lvl}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, b = []);
      b.push(W / 2 + x1 / z1 * F, H / 2 + y1 / z1 * F, W / 2 + x2 / z2 * F, H / 2 + y2 / z2 * F);
    },
    poly(pts, hue, a = 1, closed = false) {
      for (let i = 1; i < pts.length; i++) r.line(pts[i - 1], pts[i], hue, a);
      if (closed) r.line(pts[pts.length - 1], pts[0], hue, a);
    },
    end(level) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const [key, s] of buckets) {
        const [hue, lvl] = key.split(':').map(Number);
        const a = lvl / LEVELS * level;
        ctx.beginPath();
        for (let i = 0; i < s.length; i += 4) { ctx.moveTo(s[i], s[i + 1]); ctx.lineTo(s[i + 2], s[i + 3]); }
        ctx.strokeStyle = `hsla(${hue},100%,55%,${a * 0.16})`;
        ctx.lineWidth = lw * 6;
        ctx.stroke();
        ctx.strokeStyle = `hsla(${hue},100%,68%,${a})`;
        ctx.lineWidth = lw * 1.4;
        ctx.stroke();
      }
    },
  };
  return r;
}

// ---- scenes: draw(r, t) with t = seconds since the scene started; camera looks down +z, y is down ----
const SCENES = [
  // Nested platonic solids, each turning its own way.
  {
    draw(r, t) {
      r.fog = { near: 4, far: 8, min: 0.25 };
      const pulse = 1 + 0.08 * sin(t * 1.3);
      const shapes = [
        [solid(ICOSA, 2.1 * pulse), [t * 0.23, t * 0.31, t * 0.07], 190 + 40 * sin(t * 0.2)],
        [solid(CUBE, 1.25), [-t * 0.41, t * 0.17, t * 0.29], 310 + 30 * sin(t * 0.3)],
        [solid(OCTA, 0.75 / pulse), [t * 0.6, -t * 0.5, 0], 50],
      ];
      for (const [{ verts, edges }, [ax, ay, az], hue] of shapes) {
        const v = verts.map(p => { const q = rotate(p, ax, ay, az); q[2] += 6; return q; });
        for (const [i, j] of edges) r.line(v[i], v[j], hue);
      }
    },
  },

  // Flight over an endless rolling grid landscape.
  {
    draw(r, t) {
      r.fog = { near: 4, far: 36, min: 0 };
      const S = 1.5, N = 26, X = 14, speed = 4;
      const travel = t * speed, off = travel % S;
      const roll = sin(t * 0.21) * 0.18, yaw = sin(t * 0.13) * 0.25;
      const height = (x, zw) => 1.6 - 1.4 * max(0, sin(x * 0.35 + zw * 0.11) * sin(zw * 0.17 - x * 0.08)) ** 2;
      const pt = (x, z) => rotate([x, height(x, z + travel), z], -0.05, yaw, roll);
      for (let k = 0; k < N; k++) {                       // rows across
        const z = k * S - off, pts = [];
        for (let i = -X; i <= X; i++) pts.push(pt(i * S, z));
        r.poly(pts, 300 - k * 3);
      }
      for (let i = -X; i <= X; i++) {                     // rails into the distance
        const pts = [];
        for (let k = 0; k < N; k++) pts.push(pt(i * S, k * S - off));
        r.poly(pts, 190, 0.8);
      }
    },
  },

  // Tunnel of rotating squares, rainbow rings rushing past.
  {
    draw(r, t) {
      const N = 30, G = 1.1, speed = 5, R = 1.8, travel = t * speed;
      r.fog = { near: 2, far: N * G, min: 0 };
      const off = travel % G, base = floor(travel / G);
      const centre = zw => [sin(zw * 0.07) * 2.2 + sin(zw * 0.023) * 1.5, cos(zw * 0.05) * 1.6];
      const [c0x, c0y] = centre(travel);
      let prev = null;
      for (let k = 0; k < N; k++) {
        const z = k * G - off + 0.3, zw = z + travel, [cx, cy] = centre(zw);
        const ang = zw * 0.06 + t * 0.4;
        const ring = [0, 1, 2, 3].map(i => {
          const a = ang + i * TAU / 4;
          return [cx - c0x + cos(a) * R, cy - c0y + sin(a) * R, z];
        });
        const hue = (base + k) * 23;
        r.poly(ring, hue, 1, true);
        if (prev) ring.forEach((p, i) => r.line(prev[i], p, hue, 0.5));
        prev = ring;
      }
    },
  },

  // Torus whose meridians flow around the tube.
  {
    draw(r, t) {
      r.fog = { near: 4, far: 8.5, min: 0.2 };
      const R = 1.7, rr = 0.65, U = 30, V = 14, SUB = 3;
      const pt = (u, v) => {
        const q = rotate([(R + rr * cos(v)) * cos(u), rr * sin(v), (R + rr * cos(v)) * sin(u)],
          0.9 + 0.3 * sin(t * 0.2), t * 0.25, t * 0.1);
        q[2] += 6.3; return q;
      };
      const flow = t * 0.8;
      for (let i = 0; i < U; i++) {                       // tube rings
        const u = i / U * TAU, pts = [];
        for (let j = 0; j <= V * SUB; j++) pts.push(pt(u, j / (V * SUB) * TAU));
        r.poly(pts, 160 + 60 * sin(u + t * 0.5), 0.7);
      }
      for (let j = 0; j < V; j++) {                       // spiralling lines along the torus
        const pts = [];
        for (let i = 0; i <= U * SUB; i++) {
          const u = i / (U * SUB) * TAU;
          pts.push(pt(u, j / V * TAU + flow + u * 2));
        }
        r.poly(pts, 320, 0.9);
      }
    },
  },

  // String art: a line between two points on Lissajous paths, with its recent history.
  {
    draw(r, t) {
      r.fog = { near: 4, far: 8, min: 0.4 };
      const P = s => [sin(s * 1.13) * 2.2, sin(s * 1.71 + 1) * 1.5, sin(s * 0.67) * 1.4];
      const Q = s => [sin(s * 0.83 + 2) * 2.2, sin(s * 1.29) * 1.5, cos(s * 1.07) * 1.4];
      const view = p => { const q = rotate(p, t * 0.05, t * 0.11); q[2] += 6; return q; };
      const mirror = ([x, y, z]) => [-x, y, z];
      const N = 110;
      for (let i = 0; i < N; i++) {
        const s = t * 0.9 - i * 0.035, a = (1 - i / N) ** 1.5, hue = t * 20 + i * 1.6;
        const p = P(s), q = Q(s);
        r.line(view(p), view(q), hue, a);
        r.line(view(mirror(p)), view(mirror(q)), hue + 180, a * 0.6);
      }
    },
  },

  // Globe with two orbiting rings and their satellites.
  {
    draw(r, t) {
      r.fog = { near: 4.5, far: 7.5, min: 0.15 };
      const tilt = 0.4, spin = t * 0.3, D = 6;
      const g = p => { const q = rotate(rotate(p, 0, spin), tilt, 0, 0.3); q[2] += D; return q; };
      const SEG = 48;
      for (let i = 1; i < 9; i++) {                       // latitudes
        const lat = -Math.PI / 2 + i * Math.PI / 9, pts = [];
        for (let j = 0; j < SEG; j++) {
          const a = j / SEG * TAU;
          pts.push(g([cos(lat) * cos(a) * 1.5, sin(lat) * 1.5, cos(lat) * sin(a) * 1.5]));
        }
        r.poly(pts, 140, 0.8, true);
      }
      for (let i = 0; i < 12; i++) {                      // longitudes
        const a = i / 12 * TAU, pts = [];
        for (let j = 0; j <= SEG / 2; j++) {
          const lat = -Math.PI / 2 + j / (SEG / 2) * Math.PI;
          pts.push(g([cos(lat) * cos(a) * 1.5, sin(lat) * 1.5, cos(lat) * sin(a) * 1.5]));
        }
        r.poly(pts, 170, 0.8);
      }
      const sat = solid(OCTA, 0.18);
      for (const [rad, ax, az, speed, hue] of [[2.3, 1.2, 0.2, 0.7, 40], [2.7, -0.5, -0.6, -0.45, 330]]) {
        const o = p => { const q = rotate(p, ax, t * 0.05, az); q[2] += D; return q; };
        const pts = [];
        for (let j = 0; j < SEG * 2; j++) { const a = j / (SEG * 2) * TAU; pts.push(o([cos(a) * rad, 0, sin(a) * rad])); }
        r.poly(pts, hue, 0.6, true);
        const a = t * speed, c = [cos(a) * rad, 0, sin(a) * rad];
        const v = sat.verts.map(p => o(rotate(p, t * 2, t * 3).map((x, k) => x + c[k])));
        for (const [i, j] of sat.edges) r.line(v[i], v[j], hue);
      }
    },
  },

  // Rippling surface, seen from above at an angle.
  {
    draw(r, t) {
      r.fog = { near: 5, far: 12, min: 0.1 };
      const N = 34, S = 3.2;
      const y = (x, z) => { const d = hypot(x, z); return -0.45 * sin(d * 3 - t * 2.2) / (1 + d * 0.6); };
      const pt = (x, z) => { const q = rotate([x, y(x, z), z], -0.75, t * 0.12); q[2] += 8.5; q[1] += 0.2; return q; };
      for (let pass = 0; pass < 2; pass++)
        for (let i = 0; i <= N; i++) {
          const a = -S + i / N * 2 * S;
          for (let j = 0; j < N; j++) {
            const b0 = -S + j / N * 2 * S, b1 = -S + (j + 1) / N * 2 * S;
            const [x0, z0, x1, z1] = pass ? [a, b0, a, b1] : [b0, a, b1, a];
            const h = y((x0 + x1) / 2, (z0 + z1) / 2);
            r.line(pt(x0, z0), pt(x1, z1), 200 - h * 300, 0.85);
          }
        }
    },
  },

  // Cube made of grid lines, breathing into a sphere and back.
  {
    draw(r, t) {
      r.fog = { near: 4, far: 8, min: 0.2 };
      const n = 6, SUB = 12;
      const m = smooth(clamp01(0.5 + 0.8 * sin(t * 0.6)));
      const morph = p => {
        const l = hypot(...p), s = (1 - m) + m * 1.45 / l;
        const q = rotate(p.map(c => c * s), t * 0.3, t * 0.21, t * 0.13);
        q[2] += 6; return q;
      };
      for (let axis = 0; axis < 3; axis++)
        for (const side of signs)
          for (let dir = 0; dir < 2; dir++)
            for (let i = 0; i <= n; i++) {
              const fixed = -1 + 2 * i / n, pts = [];
              for (let j = 0; j <= SUB; j++) {
                const run = -1 + 2 * j / SUB, p = [0, 0, 0];
                p[axis] = side;
                p[(axis + 1 + dir) % 3] = fixed;
                p[(axis + 2 - dir) % 3] = run;
                pts.push(morph(p));
              }
              r.poly(pts, axis * 120 + (side > 0 ? 0 : 40) + t * 15, 0.85);
            }
    },
  },
];

export default {
  name: 'wire',
  label: 'Tussenfilmpjes',
  create() {
    const el = document.createElement('div');
    el.className = 'wire';
    const canvas = document.createElement('canvas');
    el.append(canvas);
    const r = renderer(canvas.getContext('2d'));

    const ro = new ResizeObserver(([e]) => {
      const dpr = min(devicePixelRatio || 1, 2);
      canvas.width = max(1, Math.round(e.contentRect.width * dpr));
      canvas.height = max(1, Math.round(e.contentRect.height * dpr));
      r.resize(canvas.width, canvas.height);
    });
    ro.observe(el);

    let scene = floor(Math.random() * SCENES.length), pending = null, fade = 0;
    let t0 = performance.now(), last = t0, raf;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = min(0.1, (now - last) / 1000);
      last = now;
      if (pending !== null) {                         // fade out, switch, fade in
        fade -= dt / 0.5;
        if (fade <= 0) { fade = 0; scene = pending; pending = null; t0 = now; }
      } else fade = min(1, fade + dt / 0.8);
      r.begin();
      SCENES[scene].draw(r, (now - t0) / 1000);
      r.end(fade);
    }
    raf = requestAnimationFrame(frame);

    const go = d => {
      const n = SCENES.length;
      pending = (((pending ?? scene) + d) % n + n) % n;
    };
    return {
      el,
      next: () => go(1),
      prev: () => go(-1),
      stop: () => { cancelAnimationFrame(raf); ro.disconnect(); },
    };
  },
};
