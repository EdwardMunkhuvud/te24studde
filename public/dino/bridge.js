/* Studde integration. The vendored Chromium engine in runner.js is unmodified. */
(function () {
  'use strict';
  const channel = 'studde-dino';
  const origin = location.origin;
  const hint = document.getElementById('hint');
  let runId = null;
  let waiting = false;
  let ready = false;
  let pendingStart = null;
  let activeMs = 0;
  let best = 0;
  let readyTimer = null;
  const send = (type, extra) => parent.postMessage(Object.assign({ channel, type }, extra), origin);

  // Chrome embeds these sounds as data URLs. Use the same packaged audio files.
  Runner.prototype.loadSounds = function () {
    if (this.audioContext) { this.audioContext.resume().catch(() => {}); return; }
    try {
      this.audioContext = new AudioContext();
      const sounds = { BUTTON_PRESS: 'press.mp3', HIT: 'hit.mp3', SCORE: 'score.mp3' };
      Object.keys(sounds).forEach(key => {
        fetch(sounds[key]).then(response => response.arrayBuffer())
          .then(bytes => this.audioContext.decodeAudioData(bytes))
          .then(buffer => { this.soundFx[key] = buffer; }).catch(() => {});
      });
    } catch (_) { /* Audio is optional when a browser disables it. */ }
  };

  function requestStart(callback) {
    if (waiting || !ready) return;
    waiting = true;
    pendingStart = callback;
    hint.textContent = 'Startar rundan…';
    send('start');
  }

  const originalKeyDown = Runner.prototype.onKeyDown;
  Runner.prototype.onKeyDown = function (event) {
    if (waiting || !ready) { event.preventDefault(); return; }
    // Desktop Chrome primarily uses the keyboard; also accept the advertised
    // click on the dinosaur/canvas without treating unrelated controls as jumps.
    if (event.type === Runner.events.POINTERDOWN && event.target === this.canvas && !this.crashed) {
      event.preventDefault();
      event = { keyCode: 38, type: 'keydown', preventDefault() {} };
    }
    const jump = Runner.keycodes.JUMP[event.keyCode] || event.type === Runner.events.TOUCHSTART;
    if (!this.playing && !this.crashed && !this.paused && jump && !runId) {
      event.preventDefault();
      this.loadSounds(); // Preserve the user gesture needed to unlock audio.
      const type = event.type;
      requestStart(() => originalKeyDown.call(this, { type, keyCode: 32, preventDefault() {} }));
      return;
    }
    originalKeyDown.call(this, event);
  };
  const originalKeyUp = Runner.prototype.onKeyUp;
  Runner.prototype.onKeyUp = function (event) {
    if (waiting || !ready) return;
    originalKeyUp.call(this, event);
  };
  const originalRestart = Runner.prototype.restart;
  Runner.prototype.restart = function () {
    requestStart(() => originalRestart.call(this));
  };
  const originalUpdate = Runner.prototype.update;
  Runner.prototype.update = function () {
    if (runId && this.playing) {
      const now = getTimeStamp();
      activeMs += Math.max(0, now - (this.time || now));
    }
    originalUpdate.call(this);
  };
  const originalGameOver = Runner.prototype.gameOver;
  Runner.prototype.gameOver = function () {
    const result = { runId, score: this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan)), durationMs: Math.round(activeMs) };
    originalGameOver.call(this);
    hint.textContent = 'GAME OVER · Mellanslag eller tryck för en ny runda';
    if (runId) send('finish', result);
    runId = null;
  };
  const originalVisibility = Runner.prototype.onVisibilityChange;
  Runner.prototype.onVisibilityChange = function (event) {
    originalVisibility.call(this, event);
    if (runId && !this.crashed) hint.textContent = this.paused ? 'Pausad · Klicka på spelet för att fortsätta' : '';
  };
  // Clicking the score must not erase the account's stored personal best.
  DistanceMeter.prototype.resetHighScore = function () {};

  const runner = new Runner('#game');
  const sprites = [document.getElementById('offline-resources-1x'), document.getElementById('offline-resources-2x')];
  Promise.all(sprites.map(img => img.decode())).then(() => {
    runner.isDarkMode = true;
    runner.canvas.setAttribute('aria-label', 'Dino. Mellanslag eller pil upp för att hoppa, pil ned för att ducka.');
    send('ready');
    // The static iframe can load before React hydrates its parent. Retry the
    // handshake until the parent acknowledges it, so the first start is ready.
    readyTimer = setInterval(() => { if (!ready) send('ready'); }, 250);
  }).catch(() => { hint.textContent = 'Spelet kunde inte laddas. Ladda om sidan.'; });

  window.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== parent || event.data?.channel !== channel) return;
    const data = event.data;
    if (data.type === 'init') {
      ready = true;
      clearInterval(readyTimer);
      best = data.best || 0;
      if (runner.distanceMeter) runner.initializeHighScore(best / DistanceMeter.config.COEFFICIENT);
    } else if (data.type === 'started' && waiting && typeof data.runId === 'string') {
      waiting = false;
      runId = data.runId;
      activeMs = 0;
      hint.textContent = '';
      const callback = pendingStart;
      pendingStart = null;
      callback();
    } else if (data.type === 'start-error') {
      waiting = false;
      pendingStart = null;
      hint.textContent = data.error || 'Kunde inte starta. Försök igen.';
    } else if (data.type === 'best') {
      best = Math.max(best, data.best || 0);
      if (runner.distanceMeter) runner.initializeHighScore(best / DistanceMeter.config.COEFFICIENT);
    }
  });

  // Touch controls also allow ducking, which the original touch canvas lacks.
  function control(id, code) {
    const button = document.getElementById(id);
    button.addEventListener('pointerdown', event => {
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      if (runner.crashed) runner.restart();
      else runner.onKeyDown({ keyCode: code, type: 'keydown', preventDefault() {} });
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, () => runner.onKeyUp({ keyCode: code, type: 'keyup' })));
  }
  control('jump', 38);
  control('duck', 40);
  window.addEventListener('pagehide', () => { clearInterval(readyTimer); runner.stop(); runner.audioContext?.close(); });
}());
