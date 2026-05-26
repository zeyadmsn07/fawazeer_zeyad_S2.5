document.addEventListener('DOMContentLoaded', async () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const screens = {
    login:      document.getElementById('screen-login'),
    menu:       document.getElementById('screen-menu'),
    story:      document.getElementById('screen-story'),
    explain:    document.getElementById('screen-explain'),
    game:       document.getElementById('screen-game'),
    scoreboard: document.getElementById('screen-scoreboard'),
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const loginForm      = document.getElementById('loginForm');
  const usernameInput  = document.getElementById('usernameInput');
  const passwordInput  = document.getElementById('passwordInput');
  const loginError     = document.getElementById('loginError');
  const loginBtn       = document.getElementById('loginBtn');

  // ── Menu ───────────────────────────────────────────────────────────────────
  const displayNameLabel  = document.getElementById('displayNameLabel');
  const logoutBtn         = document.getElementById('logoutBtn');
  const dailyTitle        = document.getElementById('dailyTitle');
  const dailyDesc         = document.getElementById('dailyDesc');
  const playSection       = document.getElementById('playSection');
  const playBtn           = document.getElementById('playBtn');
  const completedSection  = document.getElementById('completedSection');
  const completedScoreLbl = document.getElementById('completedScoreLabel');
  const scoreboardBtn     = document.getElementById('scoreboardBtn');

  // ── Story screen ───────────────────────────────────────────────────────────
  const storyBackBtn      = document.getElementById('storyBackBtn');
  const storyImg          = document.getElementById('storyImg');
  const storyPrevBtn      = document.getElementById('storyPrevBtn');
  const storyNextBtn      = document.getElementById('storyNextBtn');
  const storyDots         = document.getElementById('storyDots');
  const storyToExplainBtn = document.getElementById('storyToExplainBtn');

  // ── Explain screen ─────────────────────────────────────────────────────────
  const explainBackBtn    = document.getElementById('explainBackBtn');
  const explainStartBtn   = document.getElementById('explainStartBtn');
  const explainWarning    = document.getElementById('explainWarning');
  const explainCancelBtn  = document.getElementById('explainCancelBtn');
  const explainReadyBtn   = document.getElementById('explainReadyBtn');

  // ── Game / HUD ─────────────────────────────────────────────────────────────
  const quitGameBtn         = document.getElementById('quitGameBtn');
  const gameOverlay         = document.getElementById('gameOverlay');
  const overlayIcon         = document.getElementById('overlayIcon');
  const overlayTitle        = document.getElementById('overlayTitle');
  const overlayBody         = document.getElementById('overlayBody');
  const overlayPrimaryBtn   = document.getElementById('overlayPrimaryBtn');
  const overlaySecondaryBtn = document.getElementById('overlaySecondaryBtn');

  // ── Scoreboard ─────────────────────────────────────────────────────────────
  const backFromScoreboardBtn = document.getElementById('backFromScoreboardBtn');
  const scoreboardLoading     = document.getElementById('scoreboardLoading');
  const scoreboardList        = document.getElementById('scoreboardList');

  // ── Characters & toast ─────────────────────────────────────────────────────
  const charLeft  = document.getElementById('charLeft');
  const charRight = document.getElementById('charRight');
  const toast     = document.getElementById('toast');

  // ── Music toggle ───────────────────────────────────────────────────────────
  const musicToggleBtn = document.getElementById('musicToggleBtn');

  // ═══════════════════════════════════════════════════════════════════════════
  // APP STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let _currentUser  = null;
  let _dailyData    = null;
  let _pendingScore = null;
  let _toastTimer   = null;

  // ── Story carousel state ───────────────────────────────────────────────────
  let _storyIndex = 0;

  // ▸ img6 added here — the only change needed to wire in the sixth story image
  const STORY_IMAGES = [
    '/assets/img/img1.png',
    '/assets/img/img2.png',
    '/assets/img/img3.png',
    '/assets/img/img4.png',
    '/assets/img/img5.png',
    '/assets/img/img6.png',   // ← new
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      if (el) el.classList.toggle('hidden', key !== name);
    });

    const onLogin   = name === 'login';
    const onMenu    = name === 'menu';
    const showChars = onLogin || onMenu;

    charLeft.classList.toggle('visible',    showChars);
    charRight.classList.toggle('visible',   showChars);
    charLeft.classList.toggle('menu-mode',  onMenu);
    charRight.classList.toggle('menu-mode', onMenu);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════════
  function showToast(message, duration = 2800) {
    if (_toastTimer) clearTimeout(_toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════════════════
  async function boot() {
    // ── Background image / characters / logo ───────────────────────────────
    if (typeof ASSETS !== 'undefined') {
      if (ASSETS.images?.background) {
        const sceneBg = document.getElementById('sceneBg');
        const bgImg   = new Image();
        bgImg.onload  = () => {
          sceneBg.style.backgroundImage = `url('${ASSETS.images.background}')`;
          sceneBg.style.backgroundSize  = 'cover';
        };
        bgImg.src = ASSETS.images.background;
      }
      if (ASSETS.characters?.left)  charLeft.style.backgroundImage  = `url('${ASSETS.characters.left}')`;
      if (ASSETS.characters?.right) charRight.style.backgroundImage = `url('${ASSETS.characters.right}')`;

      const logoEl = document.getElementById('logoImg');
      if (logoEl && ASSETS.images?.logo) {
        logoEl.src     = ASSETS.images.logo;
        logoEl.onerror = () => { logoEl.style.display = 'none'; };
      }
    }

    // ── Background music (default_track, lobby volume 0.35) ────────────────
    if (typeof MusicManager !== 'undefined') {
      const trackSrc = (typeof ASSETS !== 'undefined' && ASSETS.sounds?.defaultTrack)
        ? ASSETS.sounds.defaultTrack
        : '/assets/sounds/default_track.mp3';
      MusicManager.init(trackSrc);
      _syncMusicBtn();
    }

    // ── Game engine ────────────────────────────────────────────────────────
    GameEngine.init();

    // ── Story dots (built dynamically from STORY_IMAGES array) ─────────────
    _buildStoryDots();

    // ── Auth check ─────────────────────────────────────────────────────────
    try {
      const result = await FazooraAPI.getMe();
      if (result && result.user) {
        _currentUser = result.user;
        await _loadMenu();
      } else {
        showScreen('login');
      }
    } catch {
      showScreen('login');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSIC BUTTON
  // ═══════════════════════════════════════════════════════════════════════════
  function _syncMusicBtn() {
    if (!musicToggleBtn) return;
    musicToggleBtn.textContent = MusicManager.isMuted() ? '🔇' : '🎵';
    musicToggleBtn.title       = MusicManager.isMuted() ? 'Unmute music' : 'Mute music';
  }

  if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
      if (typeof MusicManager !== 'undefined') {
        MusicManager.toggleMute();
        _syncMusicBtn();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    _clearLoginError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      _setLoginError('Please enter both username and password.');
      return;
    }

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
      const data = await FazooraAPI.login(username, password);
      _currentUser = data.user;
      passwordInput.value = '';
      await _loadMenu();
    } catch (err) {
      _setLoginError(err.message || 'Login failed. Please try again.');
      const card = document.querySelector('.login-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });

  function _setLoginError(msg) {
    loginError.textContent = msg;
    usernameInput.classList.add('error');
    passwordInput.classList.add('error');
  }

  function _clearLoginError() {
    loginError.textContent = '';
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
  }

  [usernameInput, passwordInput].forEach(el =>
    el.addEventListener('input', _clearLoginError)
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MENU
  // ═══════════════════════════════════════════════════════════════════════════
  async function _loadMenu() {
    displayNameLabel.textContent = _currentUser.displayName || _currentUser.username;
    showScreen('menu');

    // Restore lobby music whenever the player returns to the menu
    if (typeof MusicManager !== 'undefined') {
      MusicManager.setVolume(0.35);
      MusicManager.restoreDefault();
    }

    try {
      _dailyData = await FazooraAPI.getDailyGame();
      _renderDailyCard(_dailyData);
    } catch (err) {
      showToast('⚠️ Could not load today\'s game. Try again later.');
      console.error('[Menu] getDailyGame error:', err);
    }
  }

  function _renderDailyCard(data) {
    dailyTitle.textContent = data.game.title       || 'Today\'s Fazoora';
    dailyDesc.textContent  = data.game.description || '';

    const locked = data.completed || data.played;

    if (locked) {
      playSection.classList.add('hidden');
      completedSection.classList.remove('hidden');

      if (data.completed && data.result) {
        completedScoreLbl.textContent = data.result.score;
      } else {
        completedScoreLbl.textContent = '—';
      }
    } else {
      playSection.classList.remove('hidden');
      completedSection.classList.add('hidden');
    }
  }

  logoutBtn.addEventListener('click', async () => {
    try { await FazooraAPI.logout(); } catch {}
    _currentUser  = null;
    _dailyData    = null;
    _pendingScore = null;
    showScreen('login');
    showToast('See you next time! 👋');
  });

  // ── Play button ─────────────────────────────────────────────────────────────
  playBtn.addEventListener('click', () => {
    if (!_dailyData) return;

    const gameId = _dailyData.game.gameId;

    if (gameId === 'baba-black-sheep') {
      _openStoryScreen();
    } else {
      _startGameSession();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STORY SCREEN  (image carousel)
  // ═══════════════════════════════════════════════════════════════════════════

  // Build one dot per story image — automatically reflects STORY_IMAGES.length
  function _buildStoryDots() {
    if (!storyDots) return;
    storyDots.innerHTML = '';
    STORY_IMAGES.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'story-dot';
      dot.setAttribute('aria-label', `Image ${i + 1}`);
      dot.addEventListener('click', () => { _storyIndex = i; _renderStorySlide(); });
      storyDots.appendChild(dot);
    });
  }

  function _openStoryScreen() {
    _storyIndex = 0;
    _renderStorySlide();
    showScreen('story');
  }

  function _renderStorySlide() {
    storyImg.src = STORY_IMAGES[_storyIndex];
    storyImg.alt = `Story image ${_storyIndex + 1} of ${STORY_IMAGES.length}`;

    storyDots.querySelectorAll('.story-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === _storyIndex);
    });

    const isFirst = _storyIndex === 0;
    const isLast  = _storyIndex === STORY_IMAGES.length - 1;

    storyPrevBtn.disabled = isFirst;
    storyNextBtn.classList.toggle('hidden', isLast);
    storyToExplainBtn.classList.toggle('hidden', !isLast);
  }

  storyBackBtn.addEventListener('click', () => showScreen('menu'));

  storyPrevBtn.addEventListener('click', () => {
    if (_storyIndex > 0) { _storyIndex--; _renderStorySlide(); }
  });

  storyNextBtn.addEventListener('click', () => {
    if (_storyIndex < STORY_IMAGES.length - 1) { _storyIndex++; _renderStorySlide(); }
  });

  storyToExplainBtn.addEventListener('click', () => {
    explainWarning.classList.add('hidden');
    explainStartBtn.disabled = false;
    showScreen('explain');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPLAIN / INSTRUCTIONS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  explainBackBtn.addEventListener('click', () => {
    showScreen('story');
    _storyIndex = STORY_IMAGES.length - 1;
    _renderStorySlide();
  });

  explainStartBtn.addEventListener('click', () => {
    explainWarning.classList.remove('hidden');
    explainStartBtn.disabled = true;
    explainWarning.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  explainCancelBtn.addEventListener('click', () => {
    explainWarning.classList.add('hidden');
    explainStartBtn.disabled = false;
  });

  explainReadyBtn.addEventListener('click', async () => {
    explainReadyBtn.disabled    = true;
    explainReadyBtn.textContent = 'Starting…';

    try {
      await FazooraAPI.markPlayed();
    } catch (err) {
      console.warn('[Explain] markPlayed failed:', err.message);
    }

    if (_dailyData) _dailyData.played = true;

    _startGameSession();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME SESSION
  // ═══════════════════════════════════════════════════════════════════════════
  function _startGameSession() {
    const { game } = _dailyData;

    // ── Switch to game music at 50% volume ──────────────────────────────────
    if (typeof MusicManager !== 'undefined') {
      MusicManager.setVolume(0.5);
      MusicManager.playTrack('/assets/sounds/fazoora1_track.mp3');
    }

    showScreen('game');
    setTimeout(() => {
      GameEngine.startGame(game.gameId, game.title, _onGameEnd);
    }, 120);
  }

  async function _onGameEnd(finalScore) {
    _pendingScore = finalScore;

    // ── Restore lobby music when game finishes ──────────────────────────────
    if (typeof MusicManager !== 'undefined') {
      MusicManager.setVolume(0.35);
      MusicManager.restoreDefault();
    }

    _showResultOverlay(finalScore);

    try {
      await FazooraAPI.submitScore(finalScore);

      if (_dailyData) {
        _dailyData.completed = true;
        _dailyData.played    = true;
        _dailyData.result    = {
          score:       finalScore,
          completedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      if (!err.message.includes('already submitted')) {
        showToast('⚠️ Score saved locally but server sync failed.');
        console.warn('[Game] submitScore error:', err);
      }
    }
  }

  function _showResultOverlay(score) {
    const excellent = score >= 1200;
    const good      = score >= 600;

    overlayIcon.textContent  = excellent ? '🏆' : good ? '🎉' : '😅';
    overlayTitle.textContent = excellent ? 'Fantastic!' : good ? 'Well Done!' : 'Good Try!';
    overlayBody.textContent  = `You scored ${score} point${score !== 1 ? 's' : ''} today!`;

    gameOverlay.classList.remove('hidden');
  }

  overlayPrimaryBtn.addEventListener('click', () => {
    gameOverlay.classList.add('hidden');
    _loadScoreboard();
  });

  overlaySecondaryBtn.addEventListener('click', () => {
    gameOverlay.classList.add('hidden');
    _loadMenu();
  });

  quitGameBtn.addEventListener('click', () => {
    GameEngine.abortGame();
    gameOverlay.classList.add('hidden');

    // Also restore lobby music if player quits mid-game
    if (typeof MusicManager !== 'undefined') {
      MusicManager.setVolume(0.35);
      MusicManager.restoreDefault();
    }

    _loadMenu();
    showToast('Game quit. Come back and try again! 👋');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCOREBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  scoreboardBtn.addEventListener('click', _loadScoreboard);
  backFromScoreboardBtn.addEventListener('click', _loadMenu);

  async function _loadScoreboard() {
    showScreen('scoreboard');
    scoreboardLoading.classList.remove('hidden');
    scoreboardList.innerHTML = '';

    try {
      const board = await FazooraAPI.getScoreboard();
      scoreboardLoading.classList.add('hidden');
      _renderScoreboard(board);
    } catch (err) {
      scoreboardLoading.classList.add('hidden');
      scoreboardList.innerHTML = `
        <li style="text-align:center;color:#ef4444;padding:1rem;font-weight:700;">
          Could not load scores. Please try again.
        </li>
      `;
      console.error('[Scoreboard] error:', err);
    }
  }

  function _renderScoreboard(board) {
    const rankEmojis = ['🥇', '🥈', '🥉'];

    board.forEach((entry, index) => {
      const rank  = index + 1;
      const isMe  = _currentUser && entry.userId === _currentUser.id;
      const emoji = rankEmojis[index] || `${rank}.`;

      const li = document.createElement('li');
      li.className = [
        'score-item',
        rank <= 3 ? `score-item--rank-${rank}` : '',
        isMe ? 'score-item--me' : '',
      ].filter(Boolean).join(' ');

      li.style.setProperty('--i', index);

      li.innerHTML = `
        <span class="score-rank" aria-label="Rank ${rank}">${emoji}</span>
        <span class="score-name">
          ${_escapeHtml(entry.displayName)}
          ${isMe ? '<span class="you-badge">YOU</span>' : ''}
        </span>
        <span class="score-meta">${entry.gamesPlayed} played</span>
        <span class="score-total" aria-label="${entry.totalScore} points">${entry.totalScore}</span>
      `;

      scoreboardList.appendChild(li);
    });
  }

  function _escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  // ─── Login shake animation ─────────────────────────────────────────────────
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes cardShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px);  }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px);  }
    }
    .login-card.shake { animation: cardShake 0.45s ease; }
  `;
  document.head.appendChild(shakeStyle);

  boot();
});