/**
 * Baba Black Sheep! — Game Module
 * ─────────────────────────────────────────────────────────────────────────────
 * A 60-second spacebar-clicker game.
 * • Exactly 15 black sheep appear among the white sheep throughout the round.
 * • Press SPACE on a black sheep → +100.  Press it on a white sheep → −100.
 * • Score never goes below 0.
 * • Images switch slowly at first, then progressively faster every 10 s.
 * • Sheep image fills the full canvas (cover-fit) for maximum visual impact.
 * • char3 sits in the bottom-right corner; it jumps on every SPACE press.
 * • sheep.mp3 plays as a one-shot SFX on every image change.
 */
(function () {

  // ─── Constants ──────────────────────────────────────────────────────────────
  const GAME_DURATION_MS  = 60_000;
  const BLACK_SHEEP_COUNT = 15;

  // Speed schedule — interval (ms) between sheep image changes
  const SPEED_BANDS = [
    { from:  0, to: 10, intervalMs: 3000 },
    { from: 10, to: 20, intervalMs: 2500 },
    { from: 20, to: 30, intervalMs: 2000 },
    { from: 30, to: 40, intervalMs: 1500 },
    { from: 40, to: 50, intervalMs: 1200 },
    { from: 50, to: 60, intervalMs: 1000 },
  ];

  // char3 display sizing (fraction of canvas dimensions)
  const CHAR3_WIDTH_RATIO  = 0.14;   // 14 % of canvas width
  const CHAR3_MARGIN_RIGHT = 18;     // px from right edge
  const CHAR3_MARGIN_BOTTOM = 18;    // px from bottom edge

  // Jump animation
  const CHAR3_JUMP_FRAMES = 28;      // total frames for one jump arc
  const CHAR3_JUMP_HEIGHT = 80;      // maximum px the character rises

  // ─── Module-level state ──────────────────────────────────────────────────────
  let _canvas, _ctx, _assets, _engineAPI;

  // Schedule: array of { triggerMs, isBlack, src }
  let _schedule       = [];
  let _schedIdx       = 0;
  let _currentSrc     = '';
  let _currentIsBlack = false;
  let _pressedThisSlot = false;
  let _prevSchedIdx   = -1;   // tracks last-activated slot to detect changes

  // Loaded Image objects keyed by src path
  let _images      = {};
  let _imagesReady = false;

  let _score    = 0;
  let _timeLeft = 60;
  let _startMs  = null;
  let _running  = false;

  // Flash feedback (brief colour wash)
  let _flashFrames  = 0;
  let _flashCorrect = true;

  // Score pop-up indicator
  let _scorePopText   = '';
  let _scorePopFrames = 0;

  // Loading animation
  let _loadingDots  = 0;
  let _loadingTimer = null;

  // char3 jump state
  let _charJumpFrames = 0;   // counts DOWN from CHAR3_JUMP_FRAMES → 0

  // Keydown handler reference for clean removal
  let _boundKeyDown = null;

  // ─── Schedule generator ──────────────────────────────────────────────────────

  function _buildSchedule(whiteSrcs, blackSrcs) {
    const slots  = [];
    let elapsed  = 0;

    while (elapsed < GAME_DURATION_MS) {
      const sec  = elapsed / 1000;
      const band = SPEED_BANDS.find(b => sec >= b.from && sec < b.to)
                 || SPEED_BANDS[SPEED_BANDS.length - 1];
      slots.push({ triggerMs: elapsed, isBlack: false, src: null });
      elapsed += band.intervalMs;
    }

    // Place exactly BLACK_SHEEP_COUNT black sheep (skip slot 0 for fairness)
    const pool = Array.from({ length: slots.length - 1 }, (_, i) => i + 1);
    _shuffle(pool);
    const blackSet = new Set(pool.slice(0, Math.min(BLACK_SHEEP_COUNT, pool.length)));

    slots.forEach((slot, i) => {
      slot.isBlack = blackSet.has(i);
      slot.src     = slot.isBlack ? _pick(blackSrcs) : _pick(whiteSrcs);
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
    return new Promise(resolve => {
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

  // ─── SFX helper ─────────────────────────────────────────────────────────────

  function _playSheepSfx() {
    if (typeof MusicManager !== 'undefined') {
      MusicManager.playSfx(_assets.sheepSfx, 0.75);
    } else if (_assets.sheepSfx) {
      // Fallback if MusicManager isn't loaded
      try {
        const sfx  = new Audio(_assets.sheepSfx);
        sfx.volume = 0.75;
        sfx.play().catch(() => {});
      } catch {}
    }
  }

  // ─── Canvas drawing helpers ───────────────────────────────────────────────────

  function _drawBackground() {
    const grad = _ctx.createLinearGradient(0, 0, 0, _canvas.height);
    grad.addColorStop(0, '#071520');
    grad.addColorStop(1, '#0d2535');
    _ctx.fillStyle = grad;
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Subtle dot-grid
    _ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    _ctx.lineWidth   = 1;
    const step = 50;
    for (let x = 0; x < _canvas.width;  x += step) {
      _ctx.beginPath(); _ctx.moveTo(x, 0); _ctx.lineTo(x, _canvas.height); _ctx.stroke();
    }
    for (let y = 0; y < _canvas.height; y += step) {
      _ctx.beginPath(); _ctx.moveTo(0, y); _ctx.lineTo(_canvas.width, y); _ctx.stroke();
    }
  }

  function _drawLoadingScreen() {
    _drawBackground();
    _ctx.save();
    _ctx.fillStyle    = 'rgba(255,255,255,0.85)';
    _ctx.font         = `bold ${Math.round(_canvas.height * 0.06)}px Fredoka One, sans-serif`;
    _ctx.textAlign    = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Loading sheep' + '.'.repeat((_loadingDots % 3) + 1), _canvas.width / 2, _canvas.height / 2);
    _ctx.restore();
  }

  /**
   * Draw the current sheep image in COVER mode — the image fills the entire
   * canvas, cropping edges proportionally so no letterboxing appears.
   */
  function _drawSheep() {
    const img = _images[_currentSrc];

    if (!img || !img.complete || img.naturalWidth === 0) {
      // Placeholder while image is loading
      _ctx.save();
      _ctx.fillStyle = _currentIsBlack ? '#1a1a2e' : '#f0f0f0';
      _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
      _ctx.fillStyle    = _currentIsBlack ? '#fff' : '#222';
      _ctx.font         = `${Math.round(_canvas.height * 0.35)}px sans-serif`;
      _ctx.textAlign    = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(_currentIsBlack ? '🐑' : '🐏', _canvas.width / 2, _canvas.height / 2);
      _ctx.restore();
      return;
    }

    // ── Cover-fit: scale so the image fills the full canvas, crop the edges ──
    const scaleX = _canvas.width  / img.naturalWidth;
    const scaleY = _canvas.height / img.naturalHeight;
    const scale  = Math.max(scaleX, scaleY);          // cover (not contain)

    const drawW = img.naturalWidth  * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = (_canvas.width  - drawW) / 2;       // centre horizontally
    const drawY = (_canvas.height - drawH) / 2;       // centre vertically

    _ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  /**
   * Draw char3 in the bottom-right corner.
   * When the player presses SPACE, _charJumpFrames is set to CHAR3_JUMP_FRAMES
   * and counts down to 0 each rendered frame; the character rises and falls
   * along a sine arc.
   */
  function _drawChar3() {
    const img = _images[_assets.char3];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const charW  = _canvas.width * CHAR3_WIDTH_RATIO;
    const charH  = (img.naturalHeight / img.naturalWidth) * charW;

    // Jump offset: parabolic arc using a sine curve (0→peak→0)
    const jumpOffset = _charJumpFrames > 0
      ? Math.sin((_charJumpFrames / CHAR3_JUMP_FRAMES) * Math.PI) * CHAR3_JUMP_HEIGHT
      : 0;

    if (_charJumpFrames > 0) _charJumpFrames--;

    const x = _canvas.width  - charW - CHAR3_MARGIN_RIGHT;
    const y = _canvas.height - charH - CHAR3_MARGIN_BOTTOM - jumpOffset;

    _ctx.save();
    // Slight drop shadow so char3 is visible against any background colour
    _ctx.shadowColor  = 'rgba(0,0,0,0.55)';
    _ctx.shadowBlur   = 12;
    _ctx.shadowOffsetY = 4;
    _ctx.drawImage(img, x, y, charW, charH);
    _ctx.restore();
  }

  function _drawHint() {
    _ctx.save();
    // Semi-transparent bar at the bottom so text is readable over any sheep
    _ctx.fillStyle = 'rgba(0,0,0,0.35)';
    _ctx.fillRect(0, _canvas.height - 38, _canvas.width, 38);

    _ctx.fillStyle    = 'rgba(255,255,255,0.90)';
    _ctx.font         = `700 ${Math.round(_canvas.height * 0.034)}px Nunito, sans-serif`;
    _ctx.textAlign    = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Press SPACE for black sheep!', _canvas.width / 2, _canvas.height - 10);
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

  function _drawScorePop() {
    if (_scorePopFrames <= 0) return;
    const alpha = _scorePopFrames / 30;
    const yOff  = (30 - _scorePopFrames) * 1.5;
    _ctx.save();
    _ctx.globalAlpha  = alpha;
    _ctx.fillStyle    = _scorePopText.startsWith('+') ? '#10b981' : '#ef4444';
    _ctx.font         = `bold ${Math.round(_canvas.height * 0.10)}px Fredoka One, sans-serif`;
    _ctx.textAlign    = 'center';
    _ctx.textBaseline = 'middle';
    // Draw with a dark outline for legibility over any sheep image
    _ctx.lineWidth    = 6;
    _ctx.strokeStyle  = 'rgba(0,0,0,0.55)';
    _ctx.strokeText(_scorePopText, _canvas.width / 2, _canvas.height * 0.28 - yOff);
    _ctx.fillText(_scorePopText,   _canvas.width / 2, _canvas.height * 0.28 - yOff);
    _ctx.restore();
    _scorePopFrames--;
  }

  function _drawFinalCountdown(secsLeft) {
    if (secsLeft > 5) return;
    _ctx.save();
    _ctx.globalAlpha  = 0.70;
    _ctx.fillStyle    = secsLeft <= 3 ? '#ef4444' : '#f59e0b';
    _ctx.font         = `bold ${Math.round(_canvas.height * 0.30)}px Fredoka One, sans-serif`;
    _ctx.textAlign    = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.lineWidth    = 8;
    _ctx.strokeStyle  = 'rgba(0,0,0,0.4)';
    _ctx.strokeText(secsLeft, _canvas.width / 2, _canvas.height / 2);
    _ctx.fillText(secsLeft,   _canvas.width / 2, _canvas.height / 2);
    _ctx.restore();
  }

  // ─── Slot management ────────────────────────────────────────────────────────

  function _activateSlot(idx) {
    const slot = _schedule[idx];
    _currentSrc       = slot.src;
    _currentIsBlack   = slot.isBlack;
    _pressedThisSlot  = false;

    // Play the sheep SFX on every image change (but not on the very first
    // slot that activates at the same moment _running becomes true)
    if (_running && idx !== 0) {
      _playSheepSfx();
    }
  }

  // ─── Spacebar handler ───────────────────────────────────────────────────────

  function _handleKeyDown(e) {
    if (!_running) return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    e.preventDefault();

    // Trigger char3 jump on every SPACE press (scored or not)
    _charJumpFrames = CHAR3_JUMP_FRAMES;

    // One scored press per image slot
    if (_pressedThisSlot) return;
    _pressedThisSlot = true;

    if (_currentIsBlack) {
      _score         += 100;
      _flashCorrect   = true;
      _scorePopText   = '+100';
    } else {
      _score          = Math.max(0, _score - 100);
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
      _startMs         = null;
      _running         = false;
      _schedIdx        = 0;
      _prevSchedIdx    = -1;
      _schedule        = [];
      _images          = {};
      _imagesReady     = false;
      _flashFrames     = 0;
      _scorePopFrames  = 0;
      _loadingDots     = 0;
      _charJumpFrames  = 0;

      engineAPI.updateScore(0);
      engineAPI.updateTimer('…');

      _loadingTimer = setInterval(() => { _loadingDots++; }, 400);

      // Preload ALL images: sheep variants + char3
      const sheepSrcs = [
        ...(assets.whiteSheep || []),
        ...(assets.blackSheep || []),
      ];
      const char3Src  = assets.char3 ? [assets.char3] : [];
      const allSrcs   = [...sheepSrcs, ...char3Src];

      _preloadImages(allSrcs).then(() => {
        clearInterval(_loadingTimer);
        _imagesReady = true;

        _schedule = _buildSchedule(assets.whiteSheep, assets.blackSheep);
        _activateSlot(0);         // no SFX for the very first slot (see _activateSlot)
        _prevSchedIdx = 0;

        _startMs  = performance.now();
        _running  = true;

        engineAPI.updateScore(0);
        engineAPI.updateTimer(60);

        _boundKeyDown = _handleKeyDown;
        document.addEventListener('keydown', _boundKeyDown);

        console.log(
          `[BabaBlackSheep] Started. ${_schedule.length} slots, ` +
          `${_schedule.filter(s => s.isBlack).length} black sheep.`
        );
      });

      console.log('[BabaBlackSheep] Preloading images…');
    },

    update(elapsed, ctx, canvas) {
      if (!_imagesReady) {
        _drawLoadingScreen();
        return;
      }

      if (!_running) return;

      const now       = performance.now();
      const elapsedMs = now - _startMs;

      // ── Advance schedule ────────────────────────────────────────────────────
      while (
        _schedIdx + 1 < _schedule.length &&
        elapsedMs >= _schedule[_schedIdx + 1].triggerMs
      ) {
        _schedIdx++;
        _activateSlot(_schedIdx);
      }

      // ── Timer display ───────────────────────────────────────────────────────
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

      // ── Render (order matters: bg → sheep → char3 → overlays) ──────────────
      _drawBackground();
      _drawSheep();           // full-canvas cover-fit
      _drawChar3();           // bottom-right mascot (with jump)
      _drawHint();            // "Press SPACE" bar at the bottom
      _drawFlashLayer();      // green/red wash on press
      _drawScorePop();        // +100 / -100 floating text
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