// © 2026 Chiara Giustiniani. All rights reserved.
// All tunable values of the piece in one place.
// Coordinates are normalised 0-1, with (0,0) at the bottom left of the screen.

const CONFIG = {
  // ---------------------------------------------------------------- presence and calibration
  CAL_TIME: 3.0,           // seconds of neutral face used as the personal baseline
  ABSENT_GRACE: 2.0,       // seconds without a face before the visitor counts as gone
  MIN_VISIT: 5.0,          // shorter visits do not produce a portrait
  BASE_TAU: 20.0,          // slow baseline update while the face is neutral
  MIN_HOLD: 0.4,           // minimum seconds in a state before switching

  // thresholds on the offset from the baseline: [enter, exit]
  THRESHOLDS: {
    mouth_open: [0.15, 0.08],
    lips_spread: [0.09, 0.045],
  },
  EYES_ON: 0.6,            // both eyes above this = closed
  EYES_OFF: 0.4,
  EYES_HOLD: 0.8,          // seconds, so a blink is ignored

  // proximity from the distance between the outer eye corners
  // (in units of the video height): far ~1 m, near ~35 cm
  DIST_FAR: 0.14,
  DIST_NEAR: 0.40,
  DIST_TAU: 0.5,

  // ---------------------------------------------------------------- gestures
  N_RIPPLES: 16,
  N_IMPRINTS: 48,          // imprints used by the live image (the portrait keeps all)
  RIPPLE_LIFE: 6.0,
  IMPRINT_MAX: 0.03,
  MERGE_DIST: 0.008,
  SPOT_JITTER: 0.035,
  ANGLE_JITTER: 0.8,
  FACE_SCALE: 2.2,
  MOVE_GAIN: 1.8,
  MAX_GAIN: 3.0,
  COOLDOWN: 1.0,
  DEV_TAU: 20.0,

  // [source, channels, on, off, landmark groups, ripple amp, imprint strength, imprint radius, colour]
  // source: 'states' = derived values, 'blend' = raw blendshapes,
  //         'dev' = raw blendshapes minus the visitor's resting value
  GESTURES: {
    blink_left:  ['blend', ['eyeBlinkLeft'], 0.5, 0.3, [[386, 374]], 0.006, 0.002, 0.05, [0.35, 0.95, 0.85]],
    blink_right: ['blend', ['eyeBlinkRight'], 0.5, 0.3, [[159, 145]], 0.006, 0.002, 0.05, [0.35, 0.95, 0.85]],
    mouth_open:  ['states', ['mouth_open'], 0.15, 0.08, [[13, 14]], 0.020, 0.006, 0.08, [1.00, 0.38, 0.62]],
    lips_spread: ['states', ['lips_spread'], 0.15, 0.08, [[61], [291]], 0.012, 0.004, 0.06, [1.00, 0.72, 0.30]],
    brows_up:    ['states', ['brows_up'], 0.11, 0.055, [[105], [334]], 0.010, 0.003, 0.06, [0.75, 0.95, 1.00]],
    chin_raise:  ['states', ['chin_raise'], 0.14, 0.07, [[152]], 0.010, 0.003, 0.06, [0.40, 0.45, 1.00]],
    squint:      ['dev', ['eyeSquintLeft', 'eyeSquintRight'], 0.20, 0.10, [[159, 145], [386, 374]], 0.008, 0.003, 0.05, [0.55, 1.00, 0.70]],
    look_up:     ['dev', ['eyeLookUpLeft', 'eyeLookUpRight'], 0.35, 0.18, [[151]], 0.008, 0.003, 0.06, [0.85, 0.88, 1.00]],
    look_down:   ['dev', ['eyeLookDownLeft', 'eyeLookDownRight'], 0.35, 0.18, [[6]], 0.008, 0.003, 0.06, [0.85, 0.88, 1.00]],
    nose_sneer:  ['dev', ['noseSneerLeft', 'noseSneerRight'], 0.15, 0.07, [[98], [327]], 0.010, 0.003, 0.05, [0.70, 1.00, 0.35]],
    cheek_puff:  ['dev', ['cheekPuff'], 0.08, 0.04, [[50], [280]], 0.012, 0.004, 0.07, [1.00, 0.55, 0.40]],
    pucker:      ['dev', ['mouthPucker'], 0.40, 0.20, [[0]], 0.010, 0.003, 0.06, [1.00, 0.50, 0.85]],
    mouth_left:  ['dev', ['mouthLeft'], 0.20, 0.10, [[291]], 0.008, 0.003, 0.05, [1.00, 0.85, 0.50]],
    mouth_right: ['dev', ['mouthRight'], 0.20, 0.10, [[61]], 0.008, 0.003, 0.05, [1.00, 0.85, 0.50]],
  },

  // ---------------------------------------------------------------- particles
  N_PARTICLES: 190,
  P_RADIUS: 0.005,
  P_DRIFT: 0.00010,
  P_DAMP: 0.90,
  P_MAX_SPEED: 0.006,
  P_SEPARATION: 0.038,
  P_FLEE: 0.9,
  P_MARGIN: 0.10,
  P_WALL: 0.06,
  P_CENTER: 0.0012,

  // ---------------------------------------------------------------- colour per state
  // 0 neutral, 1 lips spread, 2 mouth open, 3 eyes closed
  PALETTES: [
    [0.35, 0.95, 0.85],
    [1.00, 0.72, 0.30],
    [1.00, 0.38, 0.62],
    [0.40, 0.45, 1.00],
  ],
  COLOR_TAU: 1.5,

  // ---------------------------------------------------------------- music
  BPM_MIN: 60,
  BPM_MAX: 120,
  TEMPO_TAU: 2.5,
  CHORD_BARS: 1,
  DWELL_FULL: 90,
  LAYER_ENTRY: { pad: 0, arp: 5, melody: 15, texture: 30 },
  SCALES: {
    0: ['D', 'E', 'F#', 'A', 'B'],
    1: ['D', 'E', 'F#', 'G#', 'A', 'B', 'C#'],
    2: ['D', 'E', 'F#', 'G#', 'A#', 'C'],
    3: ['D', 'F', 'G', 'A', 'C'],
  },
  PROGRESSIONS: {
    0: [['B2', 'F#3', 'A3', 'D4'], ['E2', 'B2', 'D3', 'A3'], ['A2', 'E3', 'A3', 'B3'], ['D3', 'A3', 'B3', 'E4', 'F#4']],
    1: [['B2', 'F#3', 'A3', 'C#4', 'D4'], ['E2', 'B2', 'F#3', 'G#3'], ['A2', 'E3', 'G#3', 'B3', 'C#4'], ['D3', 'A3', 'C#4', 'F#4', 'G#4']],
    2: [['D3', 'F#3', 'A#3', 'C4'], ['E3', 'G#3', 'C4', 'D4'], ['F#3', 'A#3', 'D4', 'E4'], ['G#3', 'C4', 'E4', 'F#4']],
    3: [['D3', 'F3', 'A3', 'C4'], ['F2', 'C3', 'G3', 'A3'], ['G2', 'C3', 'D3', 'F3'], ['A2', 'D3', 'G3', 'C4']],
  },
  MELODY_RANGE: ['D4', 'D6'],
  TEXTURE_RANGE: ['D6', 'D7'],
  ARP_OCTAVES: [4, 5],
  ARP_DIV: 2,
};
