// © 2026 Chiara Giustiniani. All rights reserved.
// Shaders, kept as strings so the page also works when opened from disk.

const VERT = `#version 300 es
precision highp float;
in vec3 aPosition;
void main() {
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;
  gl_Position = p;
}`;

// Line field with ripples (0-15) and imprints (16-63).
const WAVE_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPalette;
uniform vec4 uData[64];
out vec4 fragColor;

const float PI2 = 6.2831853;
const float LINES = 55.0;
const float WAVE_AMP = 0.035;
const float WAVE_FREQ = 2.2;
const float SPEED = 0.25;
const float RIPPLE_SPEED = 0.18;
const float RIPPLE_K = 30.0;
const float RIPPLE_WIDTH = 4.0;
const float RIPPLE_DECAY = 0.7;
const float RIPPLE_GAIN = 1.3;
const float IMPRINT_GAIN = 1.0;
const float MAX_DISP = 0.05;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uTime * SPEED;

  float wave = WAVE_AMP * sin(uv.y * PI2 * WAVE_FREQ + t)
             + 0.4 * WAVE_AMP * sin(uv.y * PI2 * 5.1 + 1.3 + t * 0.7);

  float disp = 0.0;
  float glow = 0.0;

  for (int i = 0; i < 16; i++) {
    vec4 r = uData[i];
    if (!(r.w > 0.0)) continue;
    float age = uTime - r.z;
    if (!(age >= 0.0) || age > 10.0) continue;
    float d = length((uv - r.xy) * vec2(aspect, 1.0));
    float front = age * RIPPLE_SPEED;
    float ring = sin((d - front) * RIPPLE_K) * exp(-abs(d - front) * RIPPLE_WIDTH);
    float radial = (uv.x - r.x) * aspect / max(d, 1e-4);
    disp += RIPPLE_GAIN * r.w * ring * radial * exp(-age * RIPPLE_DECAY);
  }

  for (int i = 16; i < 64; i++) {
    vec4 m = uData[i];
    if (!(m.z > 0.0) || !(m.w > 0.001)) continue;
    vec2 d2 = (uv - m.xy) * vec2(aspect, 1.0);
    float g = exp(-dot(d2, d2) / (m.w * m.w));
    disp -= IMPRINT_GAIN * m.z * g * (d2.x / m.w);
    glow += g * (m.z / 0.03);
  }

  disp = clamp(disp, -MAX_DISP, MAX_DISP);
  float x = uv.x + wave + disp;

  float s = sin(x * PI2 * LINES);
  float band = 0.5 + 0.5 * sin(x * PI2 * 6.0 + 0.8);
  float thr = 0.2 + 0.6 * band;
  float aa = fwidth(s) * 1.5;
  float line = smoothstep(thr - aa, thr + aa, s);

  float shade = 0.55 + 0.45 * sin(x * PI2 * 3.0 + uv.y * 2.0 + t * 0.5);
  shade *= 1.0 + 0.35 * clamp(glow, 0.0, 1.0);

  fragColor = vec4(uPalette * line * shade, 1.0);
}`;

// Portrait: draws only the new imprints; the buffer keeps the maximum.
const STAMP_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec4 uStamps[16];     // x, y, strength, radius
uniform vec4 uStampInfo[16];  // r, g, b, arc angle
uniform int uCount;
out vec4 fragColor;

const float ARC_WIDTH = 0.9;
const float ARC_GAIN = 3.2;
const float ARC_SIZE = 0.7;
const float ARC_BLUR[3] = float[3](0.035, 0.07, 0.12);
const float ARC_WEIGHT[3] = float[3](1.0, 0.75, 0.5);
const float CORE = 0.009;
const float CORE_GAIN = 2.5;

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec3 col = vec3(0.0);

  for (int i = 0; i < 16; i++) {
    if (i >= uCount) break;
    vec4 m = uStamps[i];
    vec4 info = uStampInfo[i];
    vec2 rel = (uv - m.xy) * vec2(aspect, 1.0);
    float d = length(rel);
    float strength = 0.45 + 0.55 * clamp(m.z / 0.03, 0.0, 1.0);
    float ang = atan(rel.y, rel.x) - info.w;
    ang = atan(sin(ang), cos(ang));
    float window = exp(-(ang * ang) / (ARC_WIDTH * ARC_WIDTH));
    float arcs = 0.0;
    for (int k = 0; k < 3; k++) {
      float rad = m.w * ARC_SIZE * (0.45 + 0.45 * float(k + 1));
      float e = (d - rad) / (m.w * ARC_SIZE * ARC_BLUR[k]);
      arcs += exp(-e * e) * ARC_WEIGHT[k];
    }
    col += info.rgb * strength * arcs * window * ARC_GAIN;
    col += info.rgb * CORE_GAIN * strength * smoothstep(CORE, CORE * 0.3, d);
  }

  col = col / (1.0 + col * 0.35);
  col = pow(col, vec3(0.85));
  fragColor = vec4(col, 1.0);
}`;
