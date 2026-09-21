// © 2026 Chiara Giustiniani. All rights reserved.
// p5.js sketch: screens, line field, particles and the accumulated portrait.

let waveShader, stampShader, portrait;
let phase = 'intro';          // intro | loading | live | end
let prevPresent = false;

const $ = id => document.getElementById(id);

function setup() {
  pixelDensity(1);
  const cnv = createCanvas(windowWidth, windowHeight, WEBGL);
  cnv.parent(document.body);          // keep the canvas behind the page, not inside a panel
  noStroke();
  waveShader = createShader(VERT, WAVE_FRAG);

  portrait = createGraphics(1280, 720, WEBGL);
  portrait.pixelDensity(1);
  portrait.noStroke();
  stampShader = portrait.createShader(VERT, STAMP_FRAG);
  portrait.background(0);

  Gestures.onVisitEnd = showEnd;
  $('start').addEventListener('click', startPiece);
  $('end').addEventListener('click', () => { if (Gestures.present) showEnd(Gestures.captionLines(millis() / 1000)); });
  $('again').addEventListener('click', restart);
  $('full').addEventListener('click', () => fullscreen(!fullscreen()));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

async function startPiece() {
  phase = 'loading';
  $('start').disabled = true;
  try {
    $('status').textContent = 'Starting the sound…';
    await Music.start();                 // must happen right after the click
    $('status').textContent = 'Starting the camera…';
    await Face.init();
  } catch (err) {
    phase = 'intro';
    $('start').disabled = false;
    $('status').textContent = err && err.name === 'NotAllowedError'
      ? 'Camera access is blocked. Allow the camera for this page in the address bar, then press Start again.'
      : 'The camera or the face model could not start. Check that no other app is using the camera and reload the page.';
    return;
  }
  $('intro').hidden = true;
  $('controls').hidden = false;
  phase = 'live';
}

function resetPortrait() {
  portrait.blendMode(BLEND);
  portrait.background(0);
}

function restart() {
  $('end-screen').hidden = true;
  $('controls').hidden = false;
  States.S.present = false;
  Gestures.present = false;
  Gestures.ripples = []; Gestures.imprints = []; Gestures.stamps = []; Gestures.active = {}; Gestures.rest = {};
  Music.M.running = false;
  prevPresent = false;
  resetPortrait();
  phase = 'live';
}

function showEnd(lines) {
  if (phase === 'end') return;
  phase = 'end';
  if (Music.started) Music.silence();
  Music.M.running = false;

  const out = createGraphics(1280, 720);
  out.pixelDensity(1);
  out.image(portrait, 0, 0, 1280, 720);
  out.noStroke();
  out.fill(140);
  out.textFont('Menlo, Consolas, monospace');
  out.textSize(14);
  lines.forEach((line, i) => out.text(line, 40, 720 - 36 - (lines.length - 1 - i) * 18));
  const url = out.elt.toDataURL('image/png');
  out.remove();

  $('portrait').src = url;
  $('download').href = url;
  $('download').download = 'visit_' + lines[0].slice(15).replace(/[.: ]+/g, '') + '.png';
  $('controls').hidden = true;
  $('hint').hidden = true;
  $('end-screen').hidden = false;
}

function stampPortrait(stamps) {
  if (stamps.length === 0) return;
  const pos = new Float32Array(16 * 4), info = new Float32Array(16 * 4);
  stamps.forEach((s, i) => { pos.set(s.slice(0, 4), i * 4); info.set(s.slice(4, 8), i * 4); });
  portrait.shader(stampShader);
  portrait.blendMode(LIGHTEST);            // keep the brightest: nothing is ever erased
  stampShader.setUniform('uRes', [portrait.width, portrait.height]);
  stampShader.setUniform('uStamps', pos);
  stampShader.setUniform('uStampInfo', info);
  stampShader.setUniform('uCount', stamps.length);
  portrait.rect(0, 0, portrait.width, portrait.height);
}

function updateHint(st) {
  const hint = $('hint');
  let text = '';
  if (!st.present) text = 'Look at the screen to begin.';
  else if (st.calibration < 1) text = 'Hold a relaxed, neutral face for a moment.';
  hint.hidden = text === '';
  hint.textContent = text;
}

function draw() {
  const t = millis() / 1000;
  const dt = Math.min(0.1, deltaTime / 1000);
  Gestures.aspect = width / height;

  if (phase === 'live') {
    Face.update();
    const st = States.update(t, Face.seen, Face.blend, Face.landmarks, Face.aspect);
    if (st.present && !prevPresent) resetPortrait();
    prevPresent = st.present > 0.5;
    Gestures.update(t, st, Face);
    Music.update(st, dt);
    stampPortrait(Gestures.takeStamps());
    updateHint(st);
  } else if (phase !== 'end') {
    Gestures.moveParticles(t);              // the field stays alive behind the intro
  }

  // line field
  shader(waveShader);
  waveShader.setUniform('uRes', [width, height]);
  waveShader.setUniform('uTime', t);
  waveShader.setUniform('uPalette', Gestures.colour);
  waveShader.setUniform('uData', Gestures.uniformData());
  rect(0, 0, width, height);

  // particles
  resetShader();
  drawingContext.disable(drawingContext.DEPTH_TEST);
  push();
  translate(-width / 2, -height / 2);
  const c = Gestures.colour;
  for (const p of Gestures.particles) {
    const b = 0.5 + Math.min(1, Math.hypot(p[2], p[3]) / CONFIG.P_MAX_SPEED);
    fill(Math.min(255, (c[0] + 1) * 0.5 * 255 * b), Math.min(255, (c[1] + 1) * 0.5 * 255 * b), Math.min(255, (c[2] + 1) * 0.5 * 255 * b));
    circle(p[0] * width, (1 - p[1]) * height, CONFIG.P_RADIUS * 2 * width);
  }
  pop();
}
