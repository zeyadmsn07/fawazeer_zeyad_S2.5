/**
 * Baba Black Sheep! — Game Module
 * ─────────────────────────────────────────────────────────────────────────────
 * A 60-second spacebar-clicker game.
 * • Exactly 15 black sheep appear among the white sheep throughout the round.
 * • Press SPACE on a black sheep → +100. Press it on a white sheep → −100.
 * • Score never goes below 0.
 * • Images switch slowly at first, then progressively faster every 10 seconds.
 * • All rendering is done on the shared GameEngine canvas.
 */
(function () {

  // ─── Constants ──────────────────────────────────────────────────────────────
  const GAME_DURATION_MS  = 60_000;  // 60 seconds
  const BLACK_SHEEP_COUNT = 15;

  // Speed schedule: every N ms the sheep image changes.
  // Applied in bands keyed by elapsed-seconds threshold.
  const SPEED_BANDS = [
    { from:  0, to: 10, intervalMs: 3000 },
    { from: 10, to: 20, intervalMs: 2500 },
    { from: 20, to: 30, intervalMs: 2000 },
    { from: 30, to: 40, intervalMs: 1500 },
    { from: 40, to: 50, intervalMs: 1200 },
    { from: 50, to: 60, intervalMs: 1000 },
  ];

  // ─── Module-level state ──────────────────────────────────────────────────────
  let _canvas, _ctx, _assets, _engineAPI;

  /** Pre-generated playbook: array of { triggerMs, isBlack, src } */
  let _schedule     = [];
  let _schedIdx     = 0;           // index of the *current* slot in _schedule
  let _currentSrc   = '';
  let _currentIsBlack = false;
  let _pressedThisSlot = false;

  /** Loaded Image objects keyed by src path */
  let _images = {};
  let _imagesReady = false;

  let _score      = 0;
  let _timeLeft   = 60;
  let _startMs    = null;
  let _running    = false;

  // Flash feedback (brief colour wash over the canvas)
  let _flashFrames  = 0;
  let _flashCorrect = true;

  // Countdown overlay during image preload
  let _loadingDots = 0;
  let _loadingTimer = null;

  // Keydown handler stored so we can cleanly remove it
  let _boundKeyDown = null;

  // ─── Schedule generator ──────────────────────────────────────────────────────

  /**
   * Build a list of { triggerMs, isBlack, src } objects covering the full
   * 60-second window with exactly BLACK_SHEEP_COUNT black sheep.
   */
  function _buildSchedule(whiteSrcs, blackSrcs) {
    const slots = [];
    let elapsed = 0;

    while (elapsed < GAME_DURATION_MS) {
      // Determine the interval for the current second
      const elapsedSec = elapsed / 1000;
      const band = SPEED_BANDS.find(b => elapsedSec >= b.from && elapsedSec < b.to)
                || SPEED_BANDS[SPEED_BANDS.length - 1];

      slots.push({ triggerMs: elapsed, isBlack: false, src: null });
      elapsed += band.intervalMs;
    }

    // Randomly place BLACK_SHEEP_COUNT black sheep (avoid first slot so player
    // isn't immediately caught off guard)
    const pool = Array.from({ length: slots.length - 1 }, (_, i) => i + 1);
    _shuffle(pool);
    const blackIndices = new Set(pool.slice(0, Math.min(BLACK_SHEEP_COUNT, pool.length)));

    slots.forEach((slot, i) => {
      if (blackIndices.has(i)) {
        slot.isBlack = true;
        slot.src = _pick(blackSrcs);
      } else {
        slot.src = _pick(whiteSrcs);
      }
    });

    return slots;
  }

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ─── Image pre-loader ────────────────────────────────────────────────────────

  function _preloadImages(srcs) {
    return new Promise((resolve) => {
      let remaining = srcs.length;
      if (remaining === 0) { resolve(); return; }

      srcs.forEach(src => {
        const img = new Image();
        img.onload = img.onerror = () => {
          _images[src] = img;
          if (--remaining === 0) resolve();
        };
        img.src = src;
      });
    });
  }

  // ─── Canvas drawing helpers ───────────────────────────────────────────────────

  function _drawBackground() {
    // Match the app's dark ocean background
    const grad = _ctx.createLinearGradient(0, 0, 0, _canvas.height);
    grad.addColorStop(0, '#071520');
    grad.addColorStop(1, '#0d2535');
    _ctx.fillStyle = grad;
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Subtle grid
    _ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    _ctx.lineWidth = 1;
    const step = 50;
    for (let x = 0; x < _canvas.width; x += step) {
      _ctx.beginPath(); _ctx.moveTo(x, 0); _ctx.lineTo(x, _canvas.height); _ctx.stroke();
    }
    for (let y = 0; y < _canvas.height; y += step) {
      _ctx.beginPath(); _ctx.moveTo(0, y); _ctx.lineTo(_canvas.width, y); _ctx.stroke();
    }
  }

  function _drawLoadingScreen() {
    _drawBackground();
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.85)';
    _ctx.font = `bold ${Math.round(_canvas.height * 0.06)}px Fredoka One, sans-serif`;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Loading sheep' + '.'.repeat((_loadingDots % 3) + 1), _canvas.width / 2, _canvas.height / 2);
    _ctx.restore();
  }

  function _drawSheep() {
    const img = _images[_currentSrc];
    if (!img || !img.complete || img.naturalWidth === 0) {
      // Fallback placeholder
      _ctx.save();
      _ctx.fillStyle = _currentIsBlack ? '#1a1a2e' : '#f0f0f0';
      const fw = _canvas.width  * 0.5;
      const fh = _canvas.height * 0.55;
      const fx = (_canvas.width  - fw) / 2;
      const fy = (_canvas.height - fh) / 2;
      _ctx.beginPath();
      _ctx.roundRect(fx, fy, fw, fh, 24);
      _ctx.fill();
      _ctx.fillStyle = _currentIsBlack ? '#fff' : '#222';
      _ctx.font = `${Math.round(fh * 0.55)}px sans-serif`;
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(_currentIsBlack ? '🐑' : '🐏', _canvas.width / 2, _canvas.height / 2);
      _ctx.restore();
      return;
    }

    // Draw image centred, fitting within ~65% of the canvas
    const maxW = _canvas.width  * 0.65;
    const maxH = _canvas.height * 0.65;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth  * ratio;
    const h = img.naturalHeight * ratio;
    const x = (_canvas.width  - w) / 2;
    const y = (_canvas.height - h) / 2 - _canvas.height * 0.03;

    _ctx.drawImage(img, x, y, w, h);
  }

  function _drawHint() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,0.55)';
    _ctx.font = `600 ${Math.round(_canvas.height * 0.035)}px Nunito, sans-serif`;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Press SPACE for black sheep!', _canvas.width / 2, _canvas.height - 16);
    _ctx.restore();
  }

  function _drawFlashLayer() {
    if (_flashFrames <= 0) return;
    _ctx.save();
    _ctx.globalAlpha = (_flashFrames / 12) * 0.45;
    _ctx.fillStyle   = _flashCorrect ? '#10b981' : '#ef4444';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    _ctx.restore();
    _flashFrames--;
  }

  // Draw a large +100 / -100 indicator in the center
  let _scorePopText  = '';
  let _scorePopFrames = 0;

  function _drawScorePop() {
    if (_scorePopFrames <= 0) return;
    const alpha = _scorePopFrames / 30;
    const y = _canvas.height / 2 - (_canvas.height * 0.22) - (30 - _scorePopFrames) * 1.2;
    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.fillStyle = _scorePopText.startsWith('+') ? '#10b981' : '#ef4444';
    _ctx.font = `bold ${Math.round(_canvas.height * 0.09)}px Fredoka One, sans-serif`;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(_scorePopText, _canvas.width / 2, y);
    _ctx.restore();
    _scorePopFrames--;
  }

  function _drawFinalCountdown(secsLeft) {
    if (secsLeft > 5) return;
    _ctx.save();
    _ctx.globalAlpha = 0.65;
    _ctx.fillStyle = secsLeft <= 3 ? '#ef4444' : '#f59e0b';
    _ctx.font = `bold ${Math.round(_canvas.height * 0.32)}px Fredoka One, sans-serif`;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(secsLeft, _canvas.width / 2, _canvas.height / 2);
    _ctx.restore();
  }

  // ─── Slot management ────────────────────────────────────────────────────────

  function _activateSlot(idx) {
    const slot = _schedule[idx];
    _currentSrc      = slot.src;
    _currentIsBlack  = slot.isBlack;
    _pressedThisSlot = false;
  }

  // ─── Spacebar handler ───────────────────────────────────────────────────────

  function _handleKeyDown(e) {
    if (!_running) return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    e.preventDefault();

    // One scored press per image slot
    if (_pressedThisSlot) return;
    _pressedThisSlot = true;

    if (_currentIsBlack) {
      _score += 100;
      _flashCorrect   = true;
      _scorePopText   = '+100';
    } else {
      _score = Math.max(0, _score - 100);
      _flashCorrect   = false;
      _scorePopText   = '-100';
    }

    _flashFrames    = 12;
    _scorePopFrames = 30;

    _engineAPI.updateScore(_score);
  }

  // ─── Game module interface ───────────────────────────────────────────────────

  const BabaBlackSheepGame = {

    start(canvas, ctx, assets, engineAPI) {
      _canvas    = canvas;
      _ctx       = ctx;
      _assets    = assets;
      _engineAPI = engineAPI;

      _score           = 0;
      _timeLeft        = 60;
      _startMs         = null;   // set after images load
      _running         = false;
      _schedIdx        = 0;
      _schedule        = [];
      _images          = {};
      _imagesReady     = false;
      _flashFrames     = 0;
      _scorePopFrames  = 0;
      _loadingDots     = 0;

      engineAPI.updateScore(0);
      engineAPI.updateTimer('…');

      // Animate loading dots while preloading
      _loadingTimer = setInterval(() => { _loadingDots++; }, 400);

      const allSrcs = [...(assets.whiteSheep || []), ...(assets.blackSheep || [])];

      _preloadImages(allSrcs).then(() => {
        clearInterval(_loadingTimer);
        _imagesReady = true;

        _schedule = _buildSchedule(assets.whiteSheep, assets.blackSheep);
        _activateSlot(0);

        _startMs  = performance.now();
        _running  = true;

        engineAPI.updateScore(0);
        engineAPI.updateTimer(60);

        _boundKeyDown = _handleKeyDown;
        document.addEventListener('keydown', _boundKeyDown);

        console.log(
          `[BabaBlackSheep] Started. Schedule has ${_schedule.length} slots, ` +
          `${_schedule.filter(s => s.isBlack).length} black sheep.`
        );
      });

      console.log('[BabaBlackSheep] Preloading images…');
    },

    update(elapsed, ctx, canvas) {
      // Show loading screen while images are still preloading
      if (!_imagesReady) {
        _drawLoadingScreen();
        return;
      }

      if (!_running) return;

      const now       = performance.now();
      const elapsedMs = now - _startMs;

      // ── Advance schedule index ──────────────────────────────────────────────
      while (
        _schedIdx + 1 < _schedule.length &&
        elapsedMs >= _schedule[_schedIdx + 1].triggerMs
      ) {
        _schedIdx++;
        _activateSlot(_schedIdx);
      }

      // ── Update timer display ────────────────────────────────────────────────
      const newTimeLeft = Math.max(0, 60 - Math.floor(elapsedMs / 1000));
      if (newTimeLeft !== _timeLeft) {
        _timeLeft = newTimeLeft;
        _engineAPI.updateTimer(_timeLeft);
      }

      // ── End condition ───────────────────────────────────────────────────────
      if (elapsedMs >= GAME_DURATION_MS) {
        _running = false;
        _engineAPI.endGame(_score, {
          icon:    _score >= 1200 ? '🏆' : _score >= 600 ? '🎉' : '😅',
          message: `You scored ${_score} points!`,
        });
        return;
      }

      // ── Render ──────────────────────────────────────────────────────────────
      _drawBackground();
      _drawSheep();
      _drawHint();
      _drawFlashLayer();
      _drawScorePop();
      _drawFinalCountdown(_timeLeft);
    },

    destroy() {
      _running = false;
      clearInterval(_loadingTimer);
      if (_boundKeyDown) {
        document.removeEventListener('keydown', _boundKeyDown);
        _boundKeyDown = null;
      }
      console.log('[BabaBlackSheep] Destroyed.');
    },
  };

  // ─── Register ────────────────────────────────────────────────────────────────

  if (typeof GameEngine !== 'undefined') {
    GameEngine.register('baba-black-sheep', BabaBlackSheepGame);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      GameEngine.register('baba-black-sheep', BabaBlackSheepGame);
    });
  }

})();