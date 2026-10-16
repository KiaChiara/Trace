// © 2026 Chiara Giustiniani. All rights reserved.
// Generative music with Tone.js (port of music_engine; Logic is replaced by
// four browser synths, and the CC mappings drive their filters and reverb).

const Music = {
  started: false,
  st: null,            // latest States output, read by the clock
  M: { running: false, step: 0, state: 0, pending: 0, chordIdx: 0, mel: null, arpI: 0, arpDir: 1, bpm: 60 },
  PC: { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 },

  noteNum(name) {
    const pitch = name.slice(0, -1), oct = parseInt(name.slice(-1), 10);
    return this.PC[pitch] + (oct + 1) * 12;
  },
  freq(n) { return Tone.Frequency(n, 'midi').toFrequency(); },

  scaleNotes(state, low, high) {
    const pcs = new Set(CONFIG.SCALES[state].map(p => this.PC[p]));
    const out = [];
    for (let n = this.noteNum(low); n <= this.noteNum(high); n++) if (pcs.has(n % 12)) out.push(n);
    return out;
  },
  chord() {
    const prog = CONFIG.PROGRESSIONS[this.M.state];
    return prog[this.M.chordIdx % prog.length].map(n => this.noteNum(n));
  },

  // iPhone: Safari mutes Web Audio when the phone is on silent.
  // iOS 17+: index.html asks for the 'playback' session before Tone.js loads.
  // Older iOS: a silent <audio> loop, started inside the click, switches the session.
  keepPlayingOnSilent() {
    // full-quality silence (44.1 kHz, stereo, 16-bit, 0.5 s): low-quality clips are ignored by iOS
    const rate = 44100, ch = 2, frames = rate / 2, bytes = frames * ch * 2;
    const buf = new ArrayBuffer(44 + bytes);
    const v = new DataView(buf);
    const text = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); text(8, 'WAVE');
    text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    text(36, 'data'); v.setUint32(40, bytes, true);          // samples stay 0 = silence
    const el = document.createElement('audio');
    el.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    el.loop = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('x-webkit-airplay', 'deny');
    el.play().catch(() => { /* not needed on this device */ });
    this.silentLoop = el;
  },

  async start() {
    this.keepPlayingOnSilent();
    await Tone.start();
    const limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: 6, wet: 0.3 }).connect(limiter);
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.3, wet: 0.25 }).connect(this.reverb);

    this.padFilter = new Tone.Filter(900, 'lowpass').connect(this.reverb);
    this.padVol = new Tone.Volume(-14).connect(this.padFilter);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 1.6 },
    }).connect(this.padVol);

    this.melFilter = new Tone.Filter(3500, 'lowpass').connect(this.delay);
    this.melody = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 1.2 },
      volume: -10,
    }).connect(this.melFilter);

    this.texture = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.4 },
      volume: -18,
    }).connect(this.reverb);

    this.arpFilter = new Tone.Filter(1800, 'lowpass').connect(this.delay);
    this.arp = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 },
      volume: -20,
    }).connect(this.arpFilter);

    Tone.Transport.bpm.value = CONFIG.BPM_MIN;
    Tone.Transport.scheduleRepeat(time => this.step(time), '16n');
    Tone.Transport.start();
    this.started = true;
  },

  // called every frame from the sketch
  update(st, dt) {
    if (!this.started) return;
    this.st = st;
    const present = st.present > 0.5;
    const M = this.M;
    if (!present) {
      if (M.running) { this.silence(); M.running = false; }
      return;
    }
    if (!M.running) {
      M.running = true; M.step = 0; M.chordIdx = 0; M.mel = null; M.arpI = 0;
      M.state = M.pending = st.state;
      M.bpm = CONFIG.BPM_MIN + (CONFIG.BPM_MAX - CONFIG.BPM_MIN) * st.proximity;
    }
    M.pending = st.state;
    const target = CONFIG.BPM_MIN + (CONFIG.BPM_MAX - CONFIG.BPM_MIN) * st.proximity;
    M.bpm += (target - M.bpm) * Math.min(1, dt / CONFIG.TEMPO_TAU);
    Tone.Transport.bpm.value = M.bpm;

    // the former Logic CCs: expressions shape the sound continuously
    const clamp = x => Math.min(1, Math.max(0, x));
    this.padFilter.frequency.rampTo(500 + 3500 * clamp(st.lips_spread / 0.5), 0.1);
    this.reverb.wet.rampTo(0.25 + 0.45 * clamp(st.mouth_open / 0.4), 0.2);
    this.arpFilter.frequency.rampTo(900 + 4000 * clamp(st.brows_up / 0.3), 0.1);
    this.melFilter.frequency.rampTo(4000 - 3000 * clamp(st.chin_raise / 0.3), 0.1);
    this.padVol.volume.rampTo(-18 + 8 * st.proximity, 0.2);
  },

  silence() {
    this.pad.releaseAll();
    this.texture.releaseAll();
    this.melody.triggerRelease();
    this.arp.triggerRelease();
  },

  step(time) {
    const M = this.M, st = this.st, C = CONFIG;
    if (!M.running || !st) return;
    const sixteenth = Tone.Time('16n').toSeconds();
    const density = Math.min(1, st.dwell / C.DWELL_FULL);
    const prox = st.proximity;
    const vel = (lo, hi) => (lo + (hi - lo) * prox) / 127;

    if (M.step % 16 === 0) {
      const bar = M.step / 16;
      let newChord = bar % C.CHORD_BARS === 0;
      if (newChord && M.step > 0) M.chordIdx += 1;
      if (M.pending !== M.state) { M.state = M.pending; newChord = true; }
      if (newChord) {
        this.pad.releaseAll(time);
        this.pad.triggerAttack(this.chord().map(n => this.freq(n)), time, vel(45, 75));
      }
    }

    const inBeat = M.step % 4;
    if (st.dwell >= C.LAYER_ENTRY.arp && M.step % C.ARP_DIV === 0 && Math.random() < 0.6 + 0.4 * density) {
      const pcs = [...new Set(this.chord().map(n => n % 12))].sort((a, b) => a - b);
      const pool = [];
      for (let o = C.ARP_OCTAVES[0]; o <= C.ARP_OCTAVES[1]; o++) for (const pc of pcs) pool.push(pc + (o + 1) * 12);
      const i = ((M.arpI % pool.length) + pool.length) % pool.length;
      this.arp.triggerAttackRelease(this.freq(pool[i]), sixteenth * C.ARP_DIV * 0.9, time, vel(40, 80));
      let next = i + M.arpDir;
      if (next >= pool.length || next < 0) { M.arpDir *= -1; next = i + M.arpDir; }
      M.arpI = next;
    }

    if (st.dwell >= C.LAYER_ENTRY.melody && M.step % 2 === 0 && Math.random() < 0.25 + 0.5 * density) {
      const pool = this.scaleNotes(M.state, C.MELODY_RANGE[0], C.MELODY_RANGE[1]);
      if (M.mel === null) M.mel = Math.floor(pool.length / 2);
      const steps = [-2, -1, -1, 1, 1, 2];
      M.mel = Math.min(pool.length - 1, Math.max(0, M.mel + steps[Math.floor(Math.random() * steps.length)]));
      let note = pool[M.mel];
      if (inBeat === 0) {
        const chordPcs = new Set(this.chord().map(n => n % 12));
        const cands = pool.filter(n => chordPcs.has(n % 12));
        if (cands.length) {
          note = cands.reduce((a, b) => Math.abs(b - note) < Math.abs(a - note) ? b : a);
          M.mel = pool.indexOf(note);
        }
      }
      const len = [2, 4, 6][Math.floor(Math.random() * 3)];
      this.melody.triggerAttackRelease(this.freq(note), sixteenth * len, time, vel(55, 100));
    }

    if (st.dwell >= C.LAYER_ENTRY.texture && Math.random() < 0.05 + 0.25 * density) {
      const pool = this.scaleNotes(M.state, C.TEXTURE_RANGE[0], C.TEXTURE_RANGE[1]);
      const note = pool[Math.floor(Math.random() * pool.length)];
      this.texture.triggerAttackRelease(this.freq(note), sixteenth, time, vel(30, 65));
    }

    M.step += 1;
  },
};
