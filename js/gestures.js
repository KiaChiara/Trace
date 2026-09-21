// © 2026 Chiara Giustiniani. All rights reserved.
// Gestures, ripples, imprints (memory), particles and the palette (port of gestures).

const Gestures = {
  ripples: [], imprints: [], active: {}, last: {}, rest: {}, stamps: [],
  particles: [], colour: CONFIG.PALETTES[0].slice(),
  present: false, arrival: 0, count: 0, changes: 0, prevState: null, startDate: null,
  aspect: 16 / 9,
  onVisitEnd: null,     // called with the caption lines when a visitor leaves

  initParticles() {
    this.particles = [];
    for (let i = 0; i < CONFIG.N_PARTICLES; i++) {
      this.particles.push([0.05 + Math.random() * 0.9, 0.05 + Math.random() * 0.9, (Math.random() - 0.5) * 0.002, (Math.random() - 0.5) * 0.002]);
    }
  },

  faceCenter(pts) {
    const ids = [33, 263, 10, 152];
    let x = 0, y = 0;
    for (const i of ids) { x += pts[i].x; y += pts[i].y; }
    return [x / ids.length, y / ids.length];
  },

  mappedCenter(pts) {
    const [cx, cy] = this.faceCenter(pts);
    const ax = 0.5 + (cx - 0.5) * CONFIG.MOVE_GAIN;
    const ay = 0.5 + (cy - 0.5) * CONFIG.MOVE_GAIN;
    return [Math.min(0.85, Math.max(0.15, ax)), Math.min(0.85, Math.max(0.15, ay))];
  },

  groupPosition(pts, group) {
    let x = 0, y = 0;
    for (const i of group) { x += pts[i].x; y += pts[i].y; }
    x /= group.length; y /= group.length;
    const [cx, cy] = this.faceCenter(pts);
    const [ax, ay] = this.mappedCenter(pts);
    return [ax + (x - cx) * CONFIG.FACE_SCALE, ay + (y - cy) * CONFIG.FACE_SCALE];
  },

  readDev(blend, ch, gesture) {
    const raw = blend[ch] || 0;
    if (this.rest[ch] === undefined) { this.rest[ch] = raw; return 0; }
    if (!(gesture in this.active)) this.rest[ch] += (raw - this.rest[ch]) * Math.min(1, (1 / 60) / CONFIG.DEV_TAU);
    return raw - this.rest[ch];
  },

  addImprint(x, y, strength, radius, colour, angle, t) {
    let best = null, bestD = null;
    for (const m of this.imprints) {
      const d = Math.hypot((m[0] - x) * this.aspect, m[1] - y);
      if (bestD === null || d < bestD) { best = m; bestD = d; }
    }
    if (best && bestD < CONFIG.MERGE_DIST) {
      best[2] = Math.min(CONFIG.IMPRINT_MAX, best[2] + strength);
      best[3] = Math.max(best[3], radius);
    } else {
      const m = [x, y, strength, radius, t];
      if (this.imprints.length < CONFIG.N_IMPRINTS) this.imprints.push(m);
      else {
        let oldest = 0;
        for (let i = 1; i < this.imprints.length; i++) if (this.imprints[i][4] < this.imprints[oldest][4]) oldest = i;
        this.imprints[oldest] = m;
      }
    }
    // the portrait keeps every gesture: stamped once, then forgotten here
    this.stamps.push([x, y, strength, radius, colour[0], colour[1], colour[2], angle]);
  },

  captionLines(t) {
    const secs = Math.floor(t - this.arrival);
    const d = this.startDate || new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '  ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    return [
      'VISIT          ' + stamp,
      'DURATION       ' + pad(Math.floor(secs / 60)) + ':' + pad(secs % 60),
      'GESTURES       ' + this.count,
      'STATE CHANGES  ' + this.changes,
    ];
  },

  update(t, st, face) {
    const C = CONFIG;
    const present = st.present > 0.5;
    const calibrated = st.calibration >= 1;

    if (present && !this.present) {
      this.arrival = t; this.count = 0; this.changes = 0; this.prevState = null; this.startDate = new Date();
    }
    if (!present && this.present) {
      if (this.onVisitEnd && t - this.arrival >= C.MIN_VISIT) this.onVisitEnd(this.captionLines(t));
      this.ripples = []; this.imprints = []; this.active = {}; this.last = {}; this.rest = {};
    }
    this.present = present;

    if (present && calibrated && face.seen && face.landmarks) {
      const pts = face.landmarks;
      for (const name in C.GESTURES) {
        const [src, chans, on, off, groups, amp, impS, impR, colour] = C.GESTURES[name];
        let value = -1e9;
        for (const c of chans) {
          const v = src === 'dev' ? this.readDev(face.blend, c, name) : (src === 'states' ? st[c] : (face.blend[c] || 0));
          value = Math.max(value, v);
        }
        const g = this.active[name];
        const ready = t - (this.last[name] !== undefined ? this.last[name] : -99) >= C.COOLDOWN;
        if (!g && value > on && ready) {
          this.last[name] = t;
          this.count += 1;
          const ng = { peak: value, spots: [], ripples: [], centre: this.mappedCenter(pts) };
          for (const grp of groups) {
            const [x, y] = this.groupPosition(pts, grp);
            const r = [x, y, t, amp];
            this.ripples.push(r); ng.ripples.push(r); ng.spots.push([x, y]);
          }
          this.active[name] = ng;
        } else if (g) {
          g.peak = Math.max(g.peak, value);
          const gain = Math.min(C.MAX_GAIN, g.peak / on);
          for (const r of g.ripples) r[3] = amp * gain;
          if (value < off) {
            const [ax, ay] = g.centre;
            for (const [x, y] of g.spots) {
              const radius = impR * Math.sqrt(gain);
              const jx = x + (Math.random() * 2 - 1) * C.SPOT_JITTER / this.aspect;
              const jy = y + (Math.random() * 2 - 1) * C.SPOT_JITTER;
              const angle = Math.atan2(jy - ay, (jx - ax) * this.aspect) + (Math.random() * 2 - 1) * C.ANGLE_JITTER;
              this.addImprint(jx, jy, impS * gain, radius, colour, angle, t);
            }
            delete this.active[name];
          }
        }
      }
    }

    if (present) {
      if (this.prevState !== null && st.state !== this.prevState) this.changes += 1;
      this.prevState = st.state;
    }

    this.ripples = this.ripples.filter(r => t - r[2] < C.RIPPLE_LIFE).slice(-C.N_RIPPLES);
    this.moveParticles(t);

    const target = C.PALETTES[st.state] || C.PALETTES[0];
    const k = Math.min(1, (1 / 60) / C.COLOR_TAU);
    for (let i = 0; i < 3; i++) this.colour[i] += (target[i] - this.colour[i]) * k;
  },

  moveParticles(t) {
    const C = CONFIG, P = this.particles, A = this.aspect;
    if (P.length === 0) this.initParticles();
    const fronts = [];
    for (const r of this.ripples) { const age = t - r[2]; if (age < 1.5) fronts.push([r[0], r[1], age * 0.18, r[3]]); }
    for (const p of P) {
      p[2] += (Math.random() * 2 - 1) * C.P_DRIFT;
      p[3] += (Math.random() * 2 - 1) * C.P_DRIFT;
      for (const [fx, fy, front, amp] of fronts) {
        const dx = (p[0] - fx) * A, dy = p[1] - fy;
        const d = Math.hypot(dx, dy) + 1e-4;
        const push = Math.min(amp * C.P_FLEE * Math.exp(-Math.abs(d - front) * 10), C.P_MAX_SPEED);
        p[2] += dx / d * push; p[3] += dy / d * push;
      }
      p[2] += (0.5 - p[0]) * C.P_CENTER;
      p[3] += (0.5 - p[1]) * C.P_CENTER;
      if (p[0] < C.P_MARGIN) p[2] += (C.P_MARGIN - p[0]) * C.P_WALL;
      if (p[0] > 1 - C.P_MARGIN) p[2] -= (p[0] - (1 - C.P_MARGIN)) * C.P_WALL;
      if (p[1] < C.P_MARGIN) p[3] += (C.P_MARGIN - p[1]) * C.P_WALL;
      if (p[1] > 1 - C.P_MARGIN) p[3] -= (p[1] - (1 - C.P_MARGIN)) * C.P_WALL;
      p[2] *= C.P_DAMP; p[3] *= C.P_DAMP;
      const sp = Math.hypot(p[2], p[3]);
      if (sp > C.P_MAX_SPEED) { p[2] *= C.P_MAX_SPEED / sp; p[3] *= C.P_MAX_SPEED / sp; }
      p[0] = Math.min(1.02, Math.max(-0.02, p[0] + p[2]));
      p[1] = Math.min(1.02, Math.max(-0.02, p[1] + p[3]));
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        for (let j = i + 1; j < P.length; j++) {
          const b = P[j];
          const dx = (a[0] - b[0]) * A, dy = a[1] - b[1];
          const d = Math.hypot(dx, dy);
          if (d < C.P_SEPARATION && d > 1e-6) {
            const push = (C.P_SEPARATION - d) * 0.5, ux = dx / d, uy = dy / d;
            a[0] += ux * push / A; a[1] += uy * push;
            b[0] -= ux * push / A; b[1] -= uy * push;
          }
        }
      }
    }
  },

  // 64 x vec4 for the line shader: ripples (0-15) + imprints (16-63)
  uniformData() {
    const data = new Float32Array(64 * 4);
    this.ripples.slice(0, 16).forEach((r, i) => data.set(r.slice(0, 4), i * 4));
    this.imprints.slice(0, 48).forEach((m, i) => data.set(m.slice(0, 4), (16 + i) * 4));
    return data;
  },

  // new imprints for the portrait, returned once and then cleared
  takeStamps() {
    const s = this.stamps.slice(0, 16);
    this.stamps = this.stamps.slice(16);
    return s;
  },
};
