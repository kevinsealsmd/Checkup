// ============================================
// Checkup! — app.js
// ============================================

(function () {
  'use strict';

  // ============================================
  // 1. STATE
  // ============================================
  const state = {
    screen: 'menu',        // 'menu' | 'scan'
    scanPhase: 'ready',    // 'ready' | 'searching' | 'found'
    bpm: null,             // number | null
    cameraStatus: 'idle',  // 'idle' | 'active' | 'denied'
    cheerPhrase: '',
  };

  // ============================================
  // 2. DOM REFERENCES
  // ============================================
  const $ = (id) => document.getElementById(id);

  const els = {
    // Top bar
    btnBack: $('btn-back'),

    // Menu screen
    screenMenu: $('screen-menu'),
    btnPulse: $('btn-pulse'),

    // Scan screen
    screenScan: $('screen-scan'),

    // Device frame
    deviceScreen: $('device-screen'),
    deviceScanBtn: $('device-scan-btn'),

    // Screen content
    cameraFeed: $('camera-feed'),
    cameraDenied: $('camera-denied'),
    waveformCanvas: $('waveform-canvas'),
    screenBpm: $('screen-bpm'),
    bpmNumber: $('bpm-number'),
    screenCheer: $('screen-cheer'),
    screenPlaceholder: $('screen-placeholder'),

    // Overlays
    searchingOverlay: $('searching-overlay'),
    sparkleBurst: $('sparkle-burst'),
  };

  // ============================================
  // 3. PURE FUNCTIONS
  // ============================================

  function generateBpm() {
    return Math.floor(Math.random() * (110 - 78 + 1)) + 78;
  }

  function pickCheerPhrase(bpm) {
    const fast = [
      'Zoom! Fast like a bunny!',
      'Super speedy heart!',
      'That heart is racing!',
    ];
    const normal = [
      'Wow, what a strong heart!',
      'A happy, healthy thump!',
      'Great beat! High five!',
    ];
    const calm = [
      'Calm and steady, nice job!',
      'A cool, chill heartbeat!',
      'Relaxed and strong!',
    ];

    let pool;
    if (bpm > 105) pool = fast;
    else if (bpm >= 90) pool = normal;
    else pool = calm;

    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ============================================
  // 4. RENDER
  // ============================================

  function render() {
    // Screen visibility — toggle active class
    els.screenMenu.classList.toggle('screen--active', state.screen === 'menu');
    els.screenScan.classList.toggle('screen--active', state.screen === 'scan');

    // Back button: only visible when not on menu
    els.btnBack.classList.toggle('visible', state.screen !== 'menu');

    if (state.screen === 'menu') return;

    // --- Scan screen ---
    // Use class toggling instead of hidden attribute — hidden gets
    // overridden by CSS display/position properties on absolute elements.

    // Placeholder (shown only in ready state)
    els.screenPlaceholder.classList.toggle('visible', state.scanPhase === 'ready');

    // Camera denied message
    els.cameraDenied.classList.toggle('visible', state.cameraStatus === 'denied');

    // Waveform canvas visibility (shown only in found state)
    els.waveformCanvas.classList.toggle('visible', state.scanPhase === 'found');

    // BPM readout (shown only in found state)
    els.screenBpm.classList.toggle('visible', state.scanPhase === 'found');
    els.bpmNumber.textContent = state.bpm != null ? state.bpm : '--';

    // Cheer phrase
    els.screenCheer.textContent = state.cheerPhrase;

    // Searching overlay
    els.searchingOverlay.classList.toggle('visible', state.scanPhase === 'searching');
  }

  // ============================================
  // 5. DOPPLER WAVEFORM (Canvas)
  // ============================================
  //
  // Draws a scrolling waveform that mimics a real doppler spectral display:
  // a dark background with a coral-pink waveform trace scrolling left.
  // Each heartbeat produces a sharp systolic peak followed by a smaller
  // diastolic bump, similar to an arterial doppler waveform.

  let waveformAnimId = null;
  let waveformData = [];
  let waveformPhase = 0;
  let waveformLastTime = 0;

  function initWaveformCanvas() {
    var canvas = els.waveformCanvas;
    var rect = els.deviceScreen.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvas._logicalW = rect.width;
    canvas._logicalH = rect.height;
  }

  function dopplerWaveValue(phase) {
    if (phase < 0.05) {
      var t = phase / 0.05;
      return 0.1 + t * 0.8;
    } else if (phase < 0.15) {
      var t = (phase - 0.05) / 0.10;
      return 0.9 - t * 0.5;
    } else if (phase < 0.25) {
      var t = (phase - 0.15) / 0.10;
      return 0.4 - t * 0.2;
    } else if (phase < 0.30) {
      var t = (phase - 0.25) / 0.05;
      return 0.2 - t * 0.08;
    } else if (phase < 0.40) {
      var t = (phase - 0.30) / 0.10;
      var bump = Math.sin(t * Math.PI) * 0.2;
      return 0.12 + bump;
    } else {
      var t = (phase - 0.40) / 0.60;
      return 0.12 * (1 - t * 0.7);
    }
  }

  function startWaveform(bpm) {
    initWaveformCanvas();
    var canvas = els.waveformCanvas;
    var w = canvas._logicalW;
    var h = canvas._logicalH;
    var ctx = canvas.getContext('2d');

    var cols = Math.ceil(w / 2);
    waveformData = new Array(cols).fill(0);
    waveformPhase = 0;
    waveformLastTime = performance.now();

    var beatDuration = 60000 / bpm;
    var phasePerMs = 1 / beatDuration;
    var scrollSpeed = cols / 3000;
    var accumScroll = 0;

    function drawFrame(now) {
      var dt = now - waveformLastTime;
      waveformLastTime = now;
      if (dt > 100) dt = 16;

      waveformPhase += phasePerMs * dt;
      if (waveformPhase >= 1) waveformPhase -= 1;

      accumScroll += scrollSpeed * dt;
      var colsToAdd = Math.floor(accumScroll);
      accumScroll -= colsToAdd;

      for (var i = 0; i < colsToAdd; i++) {
        var subPhase = waveformPhase + (i / colsToAdd) * phasePerMs * dt;
        if (subPhase >= 1) subPhase -= 1;
        var val = dopplerWaveValue(subPhase);
        val += (Math.random() - 0.5) * 0.03;
        waveformData.push(Math.max(0, Math.min(1, val)));
      }
      while (waveformData.length > cols) {
        waveformData.shift();
      }

      ctx.clearRect(0, 0, w, h);

      // Dark background
      ctx.fillStyle = '#1a1a18';
      ctx.fillRect(0, 0, w, h);

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(127, 201, 191, 0.08)';
      ctx.lineWidth = 0.5;
      for (var g = 1; g < 4; g++) {
        var gy = h * g / 4;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Waveform trace
      var margin = 6;
      var drawH = h - margin * 2;
      ctx.beginPath();
      ctx.strokeStyle = '#D4537E';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (var c = 0; c < waveformData.length; c++) {
        var x = (c / (cols - 1)) * w;
        var y = margin + drawH * (1 - waveformData[c]);
        if (c === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow
      ctx.strokeStyle = 'rgba(212, 83, 126, 0.25)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (var c = 0; c < waveformData.length; c++) {
        var x = (c / (cols - 1)) * w;
        var y = margin + drawH * (1 - waveformData[c]);
        if (c === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      waveformAnimId = requestAnimationFrame(drawFrame);
    }

    waveformAnimId = requestAnimationFrame(drawFrame);
  }

  function stopWaveform() {
    if (waveformAnimId) {
      cancelAnimationFrame(waveformAnimId);
      waveformAnimId = null;
    }
  }

  // ============================================
  // 6. CAMERA MODULE
  // ============================================

  let cameraStream = null;
  let cameraRequested = false;

  async function requestCamera() {
    if (cameraRequested) return;
    cameraRequested = true;

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch (_e) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
      } catch (_e2) {
        state.cameraStatus = 'denied';
        render();
        return;
      }
    }

    els.cameraFeed.srcObject = cameraStream;
    state.cameraStatus = 'active';
    render();
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
    els.cameraFeed.srcObject = null;
    state.cameraStatus = 'idle';
    cameraRequested = false;
  }

  // ============================================
  // 7. AUDIO MODULE (Doppler Synthesis)
  // ============================================

  let audioCtx = null;
  let noiseBuffer = null;
  let dopplerInterval = null;

  function initAudioContext() {
    if (!audioCtx) {
      // Safari: older versions use webkitAudioContext
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Safari: AudioContext is suspended until resumed inside a user gesture handler
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function createWhiteNoiseBuffer() {
    var sampleRate = audioCtx.sampleRate;
    var length = sampleRate;
    var buffer = audioCtx.createBuffer(1, length, sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function playWhoosh(startTime, freq, peakGain, durationMs, attackMs, releaseMs) {
    var source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;

    var bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = freq;
    bandpass.Q.value = 2;

    var gainNode = audioCtx.createGain();
    var attack = attackMs / 1000;
    var duration = durationMs / 1000;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    source.connect(bandpass);
    bandpass.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(startTime);
    source.stop(startTime + duration);
  }

  function playWhooshPair() {
    var now = audioCtx.currentTime;
    playWhoosh(now, 180, 0.6, 280, 40, 200);
    playWhoosh(now + 0.18, 135, 0.4, 200, 40, 160);
  }

  function startDopplerLoop(bpm) {
    initAudioContext();
    if (!noiseBuffer) noiseBuffer = createWhiteNoiseBuffer();
    playWhooshPair();
    var interval = 60000 / bpm;
    dopplerInterval = setInterval(playWhooshPair, interval);
  }

  function stopDopplerLoop() {
    if (dopplerInterval) {
      clearInterval(dopplerInterval);
      dopplerInterval = null;
    }
  }

  // ============================================
  // 8. SCAN STATE MACHINE
  // ============================================

  let searchTimeout = null;

  function startScan() {
    initAudioContext();
    requestCamera();

    state.scanPhase = 'searching';
    state.bpm = null;
    state.cheerPhrase = '';
    render();

    searchTimeout = setTimeout(onFound, 2500);
  }

  function onFound() {
    state.bpm = generateBpm();
    state.cheerPhrase = pickCheerPhrase(state.bpm);
    state.scanPhase = 'found';
    render();

    startWaveform(state.bpm);
    triggerSparkleBurst();
    startDopplerLoop(state.bpm);
  }

  function resetScan() {
    stopDopplerLoop();
    stopWaveform();
    clearTimeout(searchTimeout);
    searchTimeout = null;
    state.scanPhase = 'ready';
    state.bpm = null;
    state.cheerPhrase = '';
    render();
  }

  function triggerSparkleBurst() {
    els.sparkleBurst.style.display = 'block';
    els.sparkleBurst.classList.remove('playing');
    void els.sparkleBurst.offsetWidth;
    els.sparkleBurst.classList.add('playing');

    setTimeout(function () {
      els.sparkleBurst.classList.remove('playing');
      els.sparkleBurst.style.display = '';
    }, 900);
  }

  // ============================================
  // 9. NAVIGATION
  // ============================================

  function showMenu() {
    resetScan();
    stopCamera();
    state.screen = 'menu';
    render();
  }

  function showScan() {
    state.screen = 'scan';
    state.scanPhase = 'ready';
    state.bpm = null;
    state.cheerPhrase = '';
    render();
  }

  // ============================================
  // 10. VISIBILITY CHANGE HANDLER
  // ============================================

  function handleVisibilityChange() {
    if (document.hidden) {
      stopWaveform();
      stopDopplerLoop();
    } else {
      if (state.screen === 'scan' && state.scanPhase === 'found' && state.bpm) {
        startWaveform(state.bpm);
        startDopplerLoop(state.bpm);
      }
    }
  }

  // ============================================
  // 11. EVENT LISTENERS & INIT
  // ============================================

  function init() {
    // Navigation
    els.btnPulse.addEventListener('click', showScan);
    els.btnBack.addEventListener('click', showMenu);

    // Scan button (invisible overlay on device image)
    els.deviceScanBtn.addEventListener('click', function () {
      if (state.scanPhase === 'found') {
        resetScan();
        startScan();
      } else if (state.scanPhase === 'ready') {
        startScan();
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {});
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
