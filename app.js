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
    thumpMenuVideo: $('thump-menu-video'),
    thumpMenuFallback: $('thump-menu-fallback'),
    btnPulse: $('btn-pulse'),

    // Scan screen
    screenScan: $('screen-scan'),

    // Thump (scan)
    thumpScanIdle: $('thump-scan-idle'),
    thumpScanTalking: $('thump-scan-talking'),
    thumpScanCheering: $('thump-scan-cheering'),
    thumpScanFallback: $('thump-scan-fallback'),

    // Speech & BPM
    speechBubble: $('speech-bubble'),
    bpmNumber: $('bpm-number'),

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

  function getSpeechText() {
    if (state.scanPhase === 'ready') return 'Point the camera at a wrist and tap Scan!';
    if (state.scanPhase === 'searching') return 'Listening carefully...';
    return state.cheerPhrase;
  }

  // ============================================
  // 4. RENDER
  // ============================================

  function render() {
    // Screen visibility
    els.screenMenu.hidden = state.screen !== 'menu';
    els.screenScan.hidden = state.screen !== 'scan';
    els.btnBack.hidden = state.screen === 'menu';

    if (state.screen === 'menu') {
      // Ensure menu Thump is playing
      safePlay(els.thumpMenuVideo);
      return;
    }

    // --- Scan screen ---

    // Speech bubble
    els.speechBubble.textContent = getSpeechText();

    // BPM
    els.bpmNumber.textContent = state.bpm != null ? state.bpm : '--';

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

    // Thump video state
    updateThumpVideo();
  }

  // ============================================
  // 5. THUMP VIDEO MANAGEMENT
  // ============================================

  let thumpState = 'idle'; // 'idle' | 'talking' | 'cheering'
  let useFallbackThump = false;

  function setThumpState(newState) {
    thumpState = newState;
    updateThumpVideo();
  }

  function updateThumpVideo() {
    if (useFallbackThump) {
      els.thumpScanIdle.hidden = true;
      els.thumpScanTalking.hidden = true;
      els.thumpScanCheering.hidden = true;
      els.thumpScanFallback.hidden = false;
      return;
    }

    els.thumpScanFallback.hidden = true;
    els.thumpScanIdle.hidden = thumpState !== 'idle';
    els.thumpScanTalking.hidden = thumpState !== 'talking';
    els.thumpScanCheering.hidden = thumpState !== 'cheering';

    // Play the visible one
    if (thumpState === 'idle') safePlay(els.thumpScanIdle);
    else if (thumpState === 'talking') safePlay(els.thumpScanTalking);
    else if (thumpState === 'cheering') safePlay(els.thumpScanCheering);
  }

  function safePlay(video) {
    if (!video) return;
    // Safari: play() returns a promise that can reject if autoplay is blocked
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
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
  let cheerTimeout = null;

  function startScan() {
    // Resume audio context on user gesture (Safari requirement)
    initAudioContext();

    // Request camera on first scan tap (not on screen entry — less jarring)
    requestCamera();

    state.scanPhase = 'searching';
    state.bpm = null;
    setThumpState('talking');
    render();

    searchTimeout = setTimeout(onFound, 2500);
  }

  function onFound() {
    state.bpm = generateBpm();
    state.cheerPhrase = pickCheerPhrase(state.bpm);
    state.scanPhase = 'found';

    // Thump: cheering for ~1.5s, then talking
    setThumpState('cheering');
    cheerTimeout = setTimeout(function () {
      setThumpState('talking');
    }, 1500);

    render();

    // Sparkle burst (one-shot animation)
    triggerSparkleBurst();

    // Start doppler audio
    startDopplerLoop(state.bpm);
  }

  function resetScan() {
    stopDopplerLoop();
    clearTimeout(searchTimeout);
    clearTimeout(cheerTimeout);
    searchTimeout = null;
    cheerTimeout = null;
    state.scanPhase = 'ready';
    state.bpm = null;
    state.cheerPhrase = '';
    setThumpState('idle');
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

    // Pause scan videos
    els.thumpScanIdle.pause();
    els.thumpScanTalking.pause();
    els.thumpScanCheering.pause();
  }

  function showScan() {
    state.screen = 'scan';
    state.scanPhase = 'ready';
    state.bpm = null;
    setThumpState('idle');
    render();

    // Pause menu Thump
    els.thumpMenuVideo.pause();
  }

  // ============================================
  // 10. VIDEO PRELOADING & FALLBACKS
  // ============================================

  function preloadVideos() {
    var videos = [
      els.thumpMenuVideo,
      els.thumpScanIdle,
      els.thumpScanTalking,
      els.thumpScanCheering,
    ];

    videos.forEach(function (video) {
      if (video) video.load();
    });
  }

  function setupVideoFallbacks() {
    // Menu Thump fallback
    setupFallbackForVideo(els.thumpMenuVideo, els.thumpMenuFallback);

    // Scan Thump fallback — if any of the 3 scan videos fail, use fallback for all
    var scanVideos = [els.thumpScanIdle, els.thumpScanTalking, els.thumpScanCheering];
    var scanFailCount = 0;

    scanVideos.forEach(function (video) {
      var sources = video.querySelectorAll('source');
      var sourceFailCount = 0;
      sources.forEach(function (source) {
        source.addEventListener('error', function () {
          sourceFailCount++;
          if (sourceFailCount >= sources.length) {
            scanFailCount++;
            // If all 3 videos fail, use SVG fallback
            if (scanFailCount >= scanVideos.length) {
              useFallbackThump = true;
              updateThumpVideo();
            }
          }
        });
      });
    });
  }

  function setupFallbackForVideo(video, fallback) {
    if (!video || !fallback) return;
    var sources = video.querySelectorAll('source');
    var failCount = 0;
    sources.forEach(function (source) {
      source.addEventListener('error', function () {
        failCount++;
        if (failCount >= sources.length) {
          video.hidden = true;
          fallback.hidden = false;
        }
      });
    });
  }

  // ============================================
  // 11. VISIBILITY CHANGE HANDLER
  // ============================================

  function handleVisibilityChange() {
    if (document.hidden) {
      // Pause all videos to save battery
      els.thumpMenuVideo.pause();
      els.thumpScanIdle.pause();
      els.thumpScanTalking.pause();
      els.thumpScanCheering.pause();

      // Stop audio
      stopDopplerLoop();
    } else {
      // Resume based on current state
      render();

      // Restart doppler if we were in found state
      if (state.screen === 'scan' && state.scanPhase === 'found' && state.bpm) {
        startDopplerLoop(state.bpm);
      }
    }
  }

  // ============================================
  // 12. EVENT LISTENERS & INIT
  // ============================================

  function init() {
    // Preload videos
    preloadVideos();
    setupVideoFallbacks();

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
