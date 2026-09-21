// © 2026 Chiara Giustiniani. All rights reserved.
// Webcam + MediaPipe Face Landmarker (runs entirely in the browser).

const MEDIAPIPE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const Face = {
  ready: false,
  video: null,
  landmarker: null,
  lastVideoTime: -1,
  aspect: 16 / 9,
  // latest reading
  seen: false,
  landmarks: null,   // 478 points, converted to screen space (x mirrored, y up)
  blend: {},         // blendshape name -> score

  async init() {
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.aspect = this.video.videoWidth / this.video.videoHeight;

    const vision = await import(MEDIAPIPE_URL);
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_URL + '/wasm');
    this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
    this.ready = true;
  },

  update() {
    if (!this.ready || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    const res = this.landmarker.detectForVideo(this.video, performance.now());
    if (!res.faceLandmarks || res.faceLandmarks.length === 0) {
      this.seen = false;
      return;
    }
    this.seen = true;
    // mirror like a mirror, and put y upwards like the shaders
    this.landmarks = res.faceLandmarks[0].map(p => ({ x: 1 - p.x, y: 1 - p.y }));
    const blend = {};
    if (res.faceBlendshapes && res.faceBlendshapes.length > 0) {
      for (const c of res.faceBlendshapes[0].categories) blend[c.categoryName] = c.score;
    }
    this.blend = blend;
  },
};
