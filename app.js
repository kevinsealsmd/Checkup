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

    // Doppler monitor
    monitor: $('monitor'),
    waveformCanvas: $('waveform-canvas'),
    monitorPlaceholder: $('monitor-placeholder'),

    // Readout
    bpmNumber: $('bpm-number'),
    cheerPhrase: $('cheer-phrase'),

    // Camera
    cameraFeed: $('camera-feed'),
    cameraDenied: $('camera-denied'),

    // Vessel
    vesselWrap: $('vessel-wrap'),

    // Overlays
    searchingOverlay: $('searching-overlay'),
    sparkleBurst: $('sparkle-burst'),

    // Action bar
    btnBackScan: $('btn-back-scan'),
    btnScan: $('btn-scan'),
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
    els.btnBack.hidden = state.screen === 'menu';

    if (state.screen === 'menu') return;

    // --- Scan screen ---

    // BPM readout
    els.bpmNumber.textContent = state.bpm != null ? state.bpm : '--';

    // Cheer phrase
    els.cheerPhrase.textContent = state.cheerPhrase;

    // Monitor placeholder (visible only before first scan)
    els.monitorPlaceholder.hidden = state.scanPhase !== 'ready';

    // Scan button
    els.btnScan.textContent = state.scanPhase === 'found' ? 'Scan again' : 'Scan';
    els.btnScan.disabled = state.scanPhase === 'searching';

    // Searching overlay
    els.searchingOverlay.hidden = state.scanPhase !== 'searching';

    // Camera denied message
    els.cameraDenied.hidden = state.cameraStatus !== 'denied';

    // Vessel state
    if (state.scanPhase === 'found') {
      els.vesselWrap.classList.remove('vessel-wrap--idle');
      els.vesselWrap.classList.add('vessel-wrap--active');
    } else {
      els.vesselWrap.classList.remove('vessel-wrap--active');
      els.vesselWrap.classList.add('vessel-wrap--idle');
    }
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
  let waveformData = [];      // ring buffer of y-values (0–1) scrolling left
  let waveformPhase = 0;      // current phase within a beat cycle (0–1)
  let waveformLastTime = 0;

  function initWaveformCanvas() {
    var canvas = els.waveformCanvas;
    var rect = els.monitor.getBoundingClientRect();
    // Use devicePixelRatio for sharp rendering on retina displays
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // Store logical dimensions for drawing
    canvas._logicalW = rect.width;
    canvas._logicalH = rect.height;
  }

  // Generate a doppler-style waveform value for a given phase (0–1 within one beat)
  function dopplerWaveValue(phase) {
    // Systolic peak: sharp upstroke at ~0.05–0.20 of the cycle
    // Diastolic notch + bump: small bump at ~0.30–0.45
    // Rest: near baseline
    if (phase < 0.05) {
      // Upstroke
      var t = phase / 0.05;
      return 0.1 + t * 0.8;
    } else if (phase < 0.15) {
      // Systolic peak and early downstroke
      var t = (phase - 0.05) / 0.10;
      return 0.9 - t * 0.5;
    } else if (phase < 0.25) {
      // Continuing downstroke
      var t = (phase - 0.15) / 0.10;
      return 0.4 - t * 0.2;
    } else if (phase < 0.30) {
      // Dicrotic notch (small dip)
      var t = (phase - 0.25) / 0.05;
      return 0.2 - t * 0.08;
    } else if (phase < 0.40) {
      // Diastolic bump
      var t = (phase - 0.30) / 0.10;
      var bump = Math.sin(t * Math.PI) * 0.2;
      return 0.12 + bump;
    } else {
      // Diastolic runoff — slowly decay to baseline
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

    // Number of columns we render (one per ~2px for performance)
    var cols = Math.ceil(w / 2);
    waveformData = new Array(cols).fill(0);
    waveformPhase = 0;
    waveformLastTime = performance.now();

    var beatDuration = 60000 / bpm; // ms per beat
    // How much phase advances per ms
    var phasePerMs = 1 / beatDuration;
    // How many columns scroll per ms (scroll full width in ~3 seconds)
    var scrollSpeed = cols / 3000;

    var accumScroll = 0;

    function drawFrame(now) {
      var dt = now - waveformLastTime;
      waveformLastTime = now;
      // Cap dt to avoid huge jumps if tab was backgrounded
      if (dt > 100) dt = 16;

      // Advance phase
      waveformPhase += phasePerMs * dt;
      if (waveformPhase >= 1) waveformPhase -= 1;

      // Scroll: accumulate fractional columns
      accumScroll += scrollSpeed * dt;
      var colsToAdd = Math.floor(accumScroll);
      accumScroll -= colsToAdd;

      // Push new data points
      for (var i = 0; i < colsToAdd; i++) {
        // Advance phase for each sub-column too
        var subPhase = waveformPhase + (i / colsToAdd) * phasePerMs * dt;
        if (subPhase >= 1) subPhase -= 1;
        var val = dopplerWaveValue(subPhase);
        // Add slight noise for organic feel
        val += (Math.random() - 0.5) * 0.03;
        waveformData.push(Math.max(0, Math.min(1, val)));
      }
      // Trim from the front to keep fixed length
      while (waveformData.length > cols) {
        waveformData.shift();
      }

      // Draw
      ctx.clearRect(0, 0, w, h);

      // Dark background with subtle grid lines
      ctx.fillStyle = '#1a1a18';
      ctx.fillRect(0, 0, w, h);

      // Horizontal grid lines
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
      var margin = 8;
      var drawH = h - margin * 2;
      ctx.beginPath();
      ctx.strokeStyle = '#D4537E';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (var c = 0; c < waveformData.length; c++) {
        var x = (c / (cols - 1)) * w;
        // Invert y: higher value = higher on screen
        var y = margin + drawH * (1 - waveformData[c]);
        if (c === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow effect: draw the same path wider and translucent
      ctx.strokeStyle = 'rgba(212, 83, 126, 0.25)';
      ctx.lineWidth = 6;
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

  // Draw a flat baseline on the canvas (for searching state)
  function drawFlatline() {
    initWaveformCanvas();
    var canvas = els.waveformCanvas;
    var w = canvas._logicalW;
    var h = canvas._logicalH;
    var ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a18';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(127, 201, 191, 0.08)';
    ctx.lineWidth = 0.5;
    for (var g = 1; g < 4; g++) {
      var gy = h * g / 4;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Flat baseline with gentle noise (looks like a live but quiet signal)
    var margin = 8;
    var baseY = h - margin - 4;
    ctx.beginPath();
    ctx.strokeStyle = '#D4537E';
    ctx.lineWidth = 1.5;
    for (var x = 0; x < w; x += 2) {
      var y = baseY + (Math.random() - 0.5) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
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
      // Rear camera unavailable or denied — try front camera
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
    var length = sampleRate; // 1 second of noise
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
    // Whoosh 1 — the "lub"
    playWhoosh(now, 180, 0.6, 280, 40, 200);
    // Whoosh 2 — the "dub", starts 180ms after lub
    playWhoosh(now + 0.18, 135, 0.4, 200, 40, 160);
  }

  function startDopplerLoop(bpm) {
    initAudioContext();
    if (!noiseBuffer) noiseBuffer = createWhiteNoiseBuffer();
    playWhooshPair(); // Immediate first beat
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
    // Resume audio context on user gesture (Safari requirement)
    initAudioContext();

    // Request camera on first scan tap (not on screen entry — less jarring)
    requestCamera();

    state.scanPhase = 'searching';
    state.bpm = null;
    state.cheerPhrase = '';
    render();

    // Show flatline on monitor while searching
    drawFlatline();

    searchTimeout = setTimeout(onFound, 2500);
  }

  function onFound() {
    state.bpm = generateBpm();
    state.cheerPhrase = pickCheerPhrase(state.bpm);
    state.scanPhase = 'found';
    render();

    // Start scrolling doppler waveform on the monitor
    startWaveform(state.bpm);

    // Sparkle burst (one-shot animation)
    triggerSparkleBurst();

    // Start doppler audio
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
    els.sparkleBurst.hidden = false;
    els.sparkleBurst.classList.remove('playing');
    // Force reflow to restart animation
    void els.sparkleBurst.offsetWidth;
    els.sparkleBurst.classList.add('playing');

    setTimeout(function () {
      els.sparkleBurst.classList.remove('playing');
      els.sparkleBurst.hidden = true;
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
      // Stop waveform animation and audio to save battery
      stopWaveform();
      stopDopplerLoop();
    } else {
      // Resume based on current state
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
    els.btnBackScan.addEventListener('click', showMenu);

    // Scan button
    els.btnScan.addEventListener('click', function () {
      if (state.scanPhase === 'found') {
        resetScan();
        startScan();
      } else if (state.scanPhase === 'ready') {
        startScan();
      }
    });

    // Visibility change — pause/resume on app switch
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {
        // Service worker registration failed — app still works, just no offline support
      });
    }

    // Initial render
    render();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
