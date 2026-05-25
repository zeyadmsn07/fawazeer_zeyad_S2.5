const ASSETS = {
  images: {
    background: '/assets/images/back.png',
    logo: '/assets/images/logo.png',
  },

  characters: {
    left: '/assets/characters/char1.png',
    right: '/assets/characters/char2.png',
  },

  ui: {
    btnPlay: '/assets/ui/btn-play.png',
    btnScoreboard: '/assets/ui/btn-scoreboard.png',
    btnLogout: '/assets/ui/btn-logout.png',
    panelFrame: '/assets/ui/panel-frame.png',
    starFull: '/assets/ui/star-full.png',
    starEmpty: '/assets/ui/star-empty.png',
  },

  day1: {
    boxSprite: '/assets/images/day1-box.png',
    bgMusic: '/assets/images/day1-music.mp3',
    sfxHit: '/assets/images/day1-hit.wav',
    sfxMiss: '/assets/images/day1-miss.wav',
  },
};

const GameEngine = (() => {
  const _registry = {};

  let _activeGame = null;
  let _rafHandle = null;
  let _sessionStart = null;

  let _canvas, _ctx, _overlay, _hudScore, _hudTimer, _hudTitle;

  let _onGameEnd = null;

  function init() {
    _canvas = document.getElementById('gameCanvas');
    _ctx = _canvas.getContext('2d');
    _overlay = document.getElementById('gameOverlay');
    _hudScore = document.getElementById('hudScore');
    _hudTimer = document.getElementById('hudTimer');
    _hudTitle = document.getElementById('hudTitle');

    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);

    console.log('[GameEngine] Initialized. Registered games:', Object.keys(_registry));
  }

  function _resizeCanvas() {
    if (!_canvas) return;

    const rect = _canvas.getBoundingClientRect();

    _canvas.width = rect.width || 800;
    _canvas.height = rect.height || 500;
  }

  function register(gameId, module) {
    if (_registry[gameId]) {
      console.warn(`[GameEngine] Game "${gameId}" already registered; overwriting.`);
    }

    _registry[gameId] = module;

    console.log(`[GameEngine] Registered game: "${gameId}"`);
  }

  function startGame(gameId, gameTitle, onEnd) {
    const module = _registry[gameId];

    if (!module) {
      console.error(`[GameEngine] Game "${gameId}" not found in registry.`);
      _showError(`Could not load game "${gameId}". Please refresh.`);
      return;
    }

    _stopLoop();

    _activeGame = module;
    _onGameEnd = onEnd;
    _sessionStart = performance.now();

    if (_hudTitle) _hudTitle.textContent = gameTitle;
    if (_hudScore) _hudScore.textContent = 'Score: 0';
    if (_hudTimer) _hudTimer.textContent = '⏱ —';

    _hideOverlay();

    _resizeCanvas();

    module.start(_canvas, _ctx, ASSETS[gameId] || {}, {
      updateScore: _updateHudScore,
      updateTimer: _updateHudTimer,
      endGame: _handleGameEnd,
    });

    _startLoop();

    console.log(`[GameEngine] Started game: "${gameId}"`);
  }

  function abortGame() {
    _stopLoop();

    if (_activeGame && typeof _activeGame.destroy === 'function') {
      _activeGame.destroy();
    }

    _activeGame = null;

    _clearCanvas();

    console.log('[GameEngine] Game aborted by user.');
  }

  function _startLoop() {
    const tick = (timestamp) => {
      if (!_activeGame) return;

      const elapsed = timestamp - _sessionStart;

      _activeGame.update(elapsed, _ctx, _canvas);

      _rafHandle = requestAnimationFrame(tick);
    };

    _rafHandle = requestAnimationFrame(tick);
  }

  function _stopLoop() {
    if (_rafHandle !== null) {
      cancelAnimationFrame(_rafHandle);
      _rafHandle = null;
    }
  }

  function _clearCanvas() {
    if (_ctx && _canvas) {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    }
  }

  function _updateHudScore(score) {
    if (_hudScore) {
      _hudScore.textContent = `Score: ${score}`;
    }
  }

  function _updateHudTimer(seconds) {
    if (_hudTimer) {
      _hudTimer.textContent = seconds >= 0
        ? `⏱ ${seconds}s`
        : '⏱ —';
    }
  }

  function _handleGameEnd(finalScore, meta = {}) {
    _stopLoop();

    if (_activeGame && typeof _activeGame.destroy === 'function') {
      _activeGame.destroy();
    }

    _activeGame = null;

    console.log(`[GameEngine] Game ended. Final score: ${finalScore}`);

    if (typeof _onGameEnd === 'function') {
      _onGameEnd(finalScore);
    }
  }

  function _hideOverlay() {
    if (_overlay) {
      _overlay.classList.add('hidden');
    }
  }

  function _showError(message) {
    if (!_overlay) return;

    document.getElementById('overlayIcon').textContent = '❌';
    document.getElementById('overlayTitle').textContent = 'Oops!';
    document.getElementById('overlayBody').textContent = message;

    _overlay.classList.remove('hidden');
  }

  return {
    init,
    register,
    startGame,
    abortGame,
  };
})();