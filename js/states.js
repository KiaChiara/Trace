// © 2026 Chiara Giustiniani. All rights reserved.
// Presence, personal calibration and the four states (port of face_states).

const States = {
  CHANNELS: ['jawOpen', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'mouthPressLeft', 'mouthPressRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthShrugLower', 'mouthPucker', 'eyeBlinkLeft', 'eyeBlinkRight'],
  S: { present: false, base: null, tPrev: null, calStart: 0, calN: 0, state: 0, tState: 0, prox: null, eyesSince: null, lastSeen: -99 },
  out: { present: 0, calibration: 0, state: 0, lips_spread: 0, mouth_open: 0, chin_raise: 0, brows_up: 0, proximity: 0, dwell: 0 },

  update(t, seen, blend, landmarks, videoAspect) {
    const C = CONFIG, S = this.S;
    const dt = S.tPrev === null ? 0 : Math.max(0, t - S.tPrev);
    S.tPrev = t;

    if (seen) S.lastSeen = t;
    const present = seen || (S.present && t - S.lastSeen < C.ABSENT_GRACE);
    if (S.present && present && !seen) return this.out;   // face lost for a moment: keep everything

    const v = {};
    for (const n of this.CHANNELS) v[n] = blend[n] || 0;

    if (present && !S.present) {
      S.base = Object.assign({}, v);
      S.calStart = t; S.calN = 1; S.state = 0; S.tState = t; S.prox = null; S.eyesSince = null;
    }
    S.present = present;

    let calib = 0;
    const dev = {};
    for (const n of this.CHANNELS) dev[n] = 0;
    if (present) {
      const tc = t - S.calStart;
      if (tc < C.CAL_TIME) {
        S.calN += 1;
        const k = 1 / S.calN;
        for (const n of this.CHANNELS) S.base[n] += (v[n] - S.base[n]) * k;
        calib = tc / C.CAL_TIME;
      } else {
        calib = 1;
        for (const n of this.CHANNELS) dev[n] = v[n] - S.base[n];
        if (S.state === 0 && dt > 0) {
          const a = Math.min(1, dt / C.BASE_TAU);
          for (const n of this.CHANNELS) S.base[n] += (v[n] - S.base[n]) * a;
        }
      }
    }

    const lips = (dev.mouthPressLeft + dev.mouthPressRight + dev.mouthSmileLeft + dev.mouthSmileRight) / 4;
    const mouth = dev.jawOpen;
    const chin = Math.max(0, dev.mouthShrugLower);
    const brows = Math.max(0, (dev.browInnerUp + dev.browOuterUpLeft + dev.browOuterUpRight) / 3);

    const eyes = Math.min(v.eyeBlinkLeft, v.eyeBlinkRight);
    if (eyes > C.EYES_ON) { if (S.eyesSince === null) S.eyesSince = t; }
    else if (eyes < C.EYES_OFF) S.eyesSince = null;
    const eyesClosed = S.eyesSince !== null && t - S.eyesSince >= C.EYES_HOLD;

    if (present && calib >= 1) {
      const state = S.state;
      const scores = { 1: lips, 2: mouth };
      const names = { 1: 'lips_spread', 2: 'mouth_open' };
      let cand = state;
      if (state === 3) {
        if (!eyesClosed) cand = 0;
      } else {
        if (state !== 0 && scores[state] < C.THRESHOLDS[names[state]][1]) cand = 0;
        if (mouth > C.THRESHOLDS.mouth_open[0]) cand = 2;
        else if (cand === 0 && lips > C.THRESHOLDS.lips_spread[0]) cand = 1;
      }
      if (eyesClosed) cand = 3;
      if (cand !== state && t - S.tState >= C.MIN_HOLD) { S.state = cand; S.tState = t; }
    } else {
      S.state = 0; S.eyesSince = null;
    }

    let proximity = 0;
    if (present && landmarks) {
      const a = landmarks[33], b = landmarks[263];
      const d = Math.hypot((b.x - a.x) * videoAspect, b.y - a.y);
      let raw = (d - C.DIST_FAR) / (C.DIST_NEAR - C.DIST_FAR);
      raw = Math.min(1, Math.max(0, raw));
      S.prox = S.prox === null ? raw : S.prox + (raw - S.prox) * Math.min(1, dt / C.DIST_TAU);
      proximity = S.prox;
    }

    this.out = {
      present: present ? 1 : 0, calibration: calib, state: S.state,
      lips_spread: lips, mouth_open: mouth, chin_raise: chin, brows_up: brows,
      proximity: proximity, dwell: present ? Math.max(0, t - S.calStart - C.CAL_TIME) : 0,
    };
    return this.out;
  },
};
