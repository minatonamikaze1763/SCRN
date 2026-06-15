// =====================================================
// Screen Recorder Pro
// Part 1 - Core Setup
// =====================================================

// --------------------
// DOM Elements
// --------------------

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const stopBtn = document.getElementById("stopBtn");
const downloadBtn = document.getElementById("downloadBtn");

const micToggle = document.getElementById("micToggle");
const webcamToggle = document.getElementById("webcamToggle");

const qualitySelect = document.getElementById("quality");
const formatSelect = document.getElementById("format");
const filenameInput = document.getElementById("filename");

const screenPreview = document.getElementById("screenPreview");
const webcamPreview = document.getElementById("webcamPreview");

const canvas = document.getElementById("recordCanvas");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

const progressBar = document.getElementById("progress");
const progressText = document.getElementById("progressText");

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");

// --------------------
// Recorder Variables
// --------------------

let screenStream = null;
let webcamStream = null;
let microphoneStream = null;

let mixedAudioDestination = null;
let audioContext = null;

let recorder = null;
let recordedChunks = [];

let recordedBlob = null;

let canvasStream = null;

let drawLoopId = null;

let timerInterval = null;
let elapsedSeconds = 0;

let ffmpegLoaded = false;

// --------------------
// Timer Functions
// --------------------

function startTimer() {
  elapsedSeconds = 0;

  timerInterval = setInterval(() => {
    elapsedSeconds++;

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    timerEl.textContent =
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);

  timerInterval = null;
}

function resetTimer() {
  stopTimer();

  elapsedSeconds = 0;

  timerEl.textContent = "00:00:00";
}

// --------------------
// Status Helpers
// --------------------

function setStatus(message) {
  statusEl.textContent = message;
}

function setProgress(percent) {
  progressBar.style.width = percent + "%";

  progressText.textContent = Math.round(percent) + "%";
}

// --------------------
// Quality Presets
// --------------------

function getResolution() {
  const quality = parseInt(qualitySelect.value);

  switch (quality) {
    case 720:
      return {
        width: 1280,
        height: 720,
      };

    case 1080:
      return {
        width: 1920,
        height: 1080,
      };

    case 1440:
      return {
        width: 2560,
        height: 1440,
      };

    case 2160:
      return {
        width: 3840,
        height: 2160,
      };

    default:
      return {
        width: 1920,
        height: 1080,
      };
  }
}

// --------------------
// Stream Capture
// --------------------

async function captureScreen() {
  setStatus("Requesting screen access...");

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: 30,
    },

    audio: true,
  });

  screenPreview.srcObject = stream;

  return stream;
}

async function captureMicrophone() {
  if (!micToggle.checked) {
    return null;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const microphones = devices.filter((d) => d.kind === "audioinput");

    if (microphones.length === 0) {
      console.warn("No microphone found.");

      setStatus("No microphone detected.");

      return null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    return stream;
  } catch (error) {
    console.warn("Microphone unavailable:", error);

    setStatus("Recording without microphone");

    return null;
  }
}

async function captureWebcam() {
  if (!webcamToggle.checked) {
    webcamPreview.srcObject = null;

    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    webcamPreview.srcObject = stream;

    return stream;
  } catch (error) {
    console.error(error);

    setStatus("Webcam permission denied");

    return null;
  }
}

// --------------------
// Audio Mixing
// --------------------

async function createMixedAudio() {
  audioContext = new AudioContext();

  mixedAudioDestination = audioContext.createMediaStreamDestination();

  // Screen Audio

  if (screenStream && screenStream.getAudioTracks().length) {
    const screenAudioSource = audioContext.createMediaStreamSource(
      new MediaStream(screenStream.getAudioTracks()),
    );

    screenAudioSource.connect(mixedAudioDestination);
  }

  // Microphone Audio

  if (microphoneStream && microphoneStream.getAudioTracks().length) {
    const micAudioSource = audioContext.createMediaStreamSource(
      new MediaStream(microphoneStream.getAudioTracks()),
    );

    micAudioSource.connect(mixedAudioDestination);
  }

  return mixedAudioDestination.stream;
}

// --------------------
// Canvas Setup
// --------------------

function setupCanvas() {
  const resolution = getResolution();

  canvas.width = resolution.width;

  canvas.height = resolution.height;
}

// --------------------
// Start Recording Flow
// --------------------

startBtn.addEventListener("click", async () => {
  try {
    setStatus("Preparing recorder...");

    setupCanvas();

    screenStream = await captureScreen();

    microphoneStream = await captureMicrophone();

    webcamStream = await captureWebcam();

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;

    setStatus("Initializing...");

    // Part 2 continues here
  } catch (error) {
    console.error(error);

    setStatus("Recording failed to start");
  }
});

// =====================================================
// Part 2 - Canvas Rendering & Recording Engine
// =====================================================

// --------------------
// Canvas Draw Loop
// --------------------

function startCanvasRendering() {
  const screenVideo = document.createElement("video");

  screenVideo.srcObject = screenStream;
  screenVideo.muted = true;
  screenVideo.playsInline = true;

  screenVideo.play();

  let webcamVideo = null;

  if (webcamStream) {
    webcamVideo = document.createElement("video");

    webcamVideo.srcObject = webcamStream;
    webcamVideo.muted = true;
    webcamVideo.playsInline = true;

    webcamVideo.play();
  }

  function drawFrame() {
    const width = canvas.width;
    const height = canvas.height;

    // Background

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Main Screen

    if (screenVideo.readyState >= 2) {
      ctx.drawImage(screenVideo, 0, 0, width, height);
    }

    // Webcam Overlay

    if (webcamVideo && webcamVideo.readyState >= 2) {
      const overlayWidth = width * 0.22;

      const overlayHeight = overlayWidth * 0.56;

      const x = width - overlayWidth - 25;

      const y = height - overlayHeight - 25;

      // Shadow

      ctx.save();

      ctx.shadowColor = "rgba(0,0,0,0.6)";

      ctx.shadowBlur = 15;

      ctx.fillStyle = "#111";

      roundRect(x, y, overlayWidth, overlayHeight, 15);

      ctx.fill();

      ctx.restore();

      // Clip Webcam

      ctx.save();

      roundRect(x, y, overlayWidth, overlayHeight, 15);

      ctx.clip();

      ctx.drawImage(webcamVideo, x, y, overlayWidth, overlayHeight);

      ctx.restore();
    }

    drawLoopId = requestAnimationFrame(drawFrame);
  }

  drawFrame();
}

// --------------------
// Rounded Rectangle
// --------------------

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();

  ctx.moveTo(x + radius, y);

  ctx.lineTo(x + width - radius, y);

  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);

  ctx.lineTo(x + width, y + height - radius);

  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);

  ctx.lineTo(x + radius, y + height);

  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);

  ctx.lineTo(x, y + radius);

  ctx.quadraticCurveTo(x, y, x + radius, y);

  ctx.closePath();
}

// --------------------
// Create Recorder
// --------------------

async function startRecordingEngine() {
  startCanvasRendering();

  let mixedAudioStream;

  try {
    mixedAudioStream = await createMixedAudio();
  } catch (err) {
    console.warn("Audio mixer failed:", err);

    mixedAudioStream = new MediaStream();
  }

  canvasStream = canvas.captureStream(30);

  const finalTracks = [...canvasStream.getVideoTracks()];

  if (mixedAudioStream && mixedAudioStream.getAudioTracks().length) {
    finalTracks.push(...mixedAudioStream.getAudioTracks());
  }

  const finalStream = new MediaStream(finalTracks);

  recorder = new MediaRecorder(finalStream, {
    mimeType: "video/webm;codecs=vp9,opus",
  });

  recordedChunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    recordedBlob = new Blob(recordedChunks, {
      type: "video/webm",
    });

    downloadBtn.disabled = false;

    setStatus("Recording ready");

    setProgress(100);
  };

  recorder.start(1000);

  startTimer();

  setStatus("Recording...");

  // Stop if user stops sharing

  const track = screenStream.getVideoTracks()[0];

  if (track) {
    track.addEventListener("ended", async () => {
      if (recorder && recorder.state !== "inactive") {
        stopBtn.click();
      }
    });
  }
}

// --------------------
// Pause Recording
// --------------------

pauseBtn.addEventListener("click", () => {
  if (!recorder || recorder.state !== "recording") {
    return;
  }

  recorder.pause();

  pauseBtn.disabled = true;
  resumeBtn.disabled = false;

  setStatus("Paused");
});

// --------------------
// Resume Recording
// --------------------

resumeBtn.addEventListener("click", () => {
  if (!recorder || recorder.state !== "paused") {
    return;
  }

  recorder.resume();

  pauseBtn.disabled = false;

  resumeBtn.disabled = true;

  setStatus("Recording...");
});

// --------------------
// Stop Recording
// --------------------

stopBtn.addEventListener("click", async () => {
  try {
    stopTimer();

    cancelAnimationFrame(drawLoopId);

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    stopBtn.disabled = true;

    pauseBtn.disabled = true;

    resumeBtn.disabled = true;

    startBtn.disabled = false;

    // Stop screen

    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    // Stop webcam

    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
    }

    // Stop mic

    if (microphoneStream) {
      microphoneStream.getTracks().forEach((track) => track.stop());
    }

    setStatus("Finalizing...");
  } catch (error) {
    console.error(error);

    setStatus("Stop failed");
  }
});

// --------------------
// Continue Start Flow
// --------------------

async function continueRecordingStartup() {
  await startRecordingEngine();
}

// =====================================================
// Part 3 - FFmpeg Export Engine
// =====================================================

let ffmpeg = null;

// --------------------
// Load FFmpeg
// --------------------

async function loadFFmpeg() {
  if (ffmpegLoaded) {
    return;
  }

  loadingOverlay.classList.remove("hidden");

  loadingTitle.textContent = "Loading FFmpeg";

  loadingText.textContent = "Downloading conversion engine...";

  try {
    const { FFmpeg } = FFmpegWASM;

    ffmpeg = new FFmpeg();

    ffmpeg.on("progress", ({ progress }) => {
      const value = Math.round(progress * 100);

      setProgress(value);

      loadingText.textContent = `Loading ${value}%`;
    });

    await ffmpeg.load();

    ffmpegLoaded = true;
  } catch (error) {
    console.error(error);

    throw error;
  } finally {
    loadingOverlay.classList.add("hidden");
  }
}

// --------------------
// Download WEBM
// --------------------

function downloadWebm(blob) {
  const filename = (filenameInput.value || "recording").trim();

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = `${filename}.webm`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
}

// --------------------
// MP4 Conversion
// --------------------

async function convertToMp4(blob) {
  await loadFFmpeg();

  loadingOverlay.classList.remove("hidden");

  loadingTitle.textContent = "Converting to MP4";

  loadingText.textContent = "Please wait...";

  setProgress(0);

  const inputData = new Uint8Array(await blob.arrayBuffer());

  await ffmpeg.writeFile("input.webm", inputData);

  await ffmpeg.exec([
    "-i",
    "input.webm",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "output.mp4",
  ]);

  const output = await ffmpeg.readFile("output.mp4");

  const mp4Blob = new Blob([output], {
    type: "video/mp4",
  });

  const filename = (filenameInput.value || "recording").trim();

  const url = URL.createObjectURL(mp4Blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = `${filename}.mp4`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

  loadingOverlay.classList.add("hidden");

  setProgress(100);
}

// --------------------
// MKV Conversion
// --------------------

async function convertToMkv(blob) {
  await loadFFmpeg();

  loadingOverlay.classList.remove("hidden");

  loadingTitle.textContent = "Converting to MKV";

  loadingText.textContent = "Please wait...";

  setProgress(0);

  const inputData = new Uint8Array(await blob.arrayBuffer());

  await ffmpeg.writeFile("input.webm", inputData);

  await ffmpeg.exec([
    "-i",
    "input.webm",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "output.mkv",
  ]);

  const output = await ffmpeg.readFile("output.mkv");

  const mkvBlob = new Blob([output], {
    type: "video/x-matroska",
  });

  const filename = (filenameInput.value || "recording").trim();

  const url = URL.createObjectURL(mkvBlob);

  const a = document.createElement("a");

  a.href = url;

  a.download = `${filename}.mkv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

  loadingOverlay.classList.add("hidden");

  setProgress(100);
}

// --------------------
// Export Button
// --------------------

downloadBtn.addEventListener("click", async () => {
  if (!recordedBlob) {
    alert("No recording available.");

    return;
  }

  try {
    const format = formatSelect.value;

    if (format === "webm") {
      downloadWebm(recordedBlob);

      return;
    }

    if (format === "mp4") {
      await convertToMp4(recordedBlob);

      return;
    }

    if (format === "mkv") {
      await convertToMkv(recordedBlob);

      return;
    }
  } catch (error) {
    console.error(error);

    loadingOverlay.classList.add("hidden");

    alert("Conversion failed. Check console.");
  }
});

// --------------------
// Initial State
// --------------------

setStatus("Ready");

setProgress(0);

resetTimer();

console.log("Screen Recorder Pro Ready");
