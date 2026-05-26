/**
 * MusicManager
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages a single looping background audio track that persists across all
 * screens. Respects browser autoplay policy by attempting playback on the
 * first user interaction when autoplay is blocked.
 *
 * Usage:
 *   MusicManager.init('/assets/sounds/default_track.mp3');
 *   MusicManager.playTrack('/assets/sounds/fazoora1_track.mp3'); // override
 *   MusicManager.setVolume(0.5);
 *   MusicManager.restoreDefault();   // return to lobby music
 *   MusicManager.playSfx('/assets/sounds/sheep.mp3'); // one-shot SFX
 *   MusicManager.toggleMute();
 */
const MusicManager = (() => {
  let _audio       = null;
  let _defaultSrc  = null;
  let _currentSrc  = null;
  let _muted       = false;
  let _volume      = 0.35;
  let _initialized = false;

  // ─── Internal helpers ────────────────────────────────────────────────────

  function _tryPlay() {
    if (!_audio || _muted) return;
    const promise = _audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // Autoplay blocked — will resume on the next user interaction
      });
    }
  }

  function _onUserInteraction() {
    if (_audio && _audio.paused && !_muted) {
      _tryPlay();
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Call once on page load with the default looping track.
   * Attempts immediate playback; falls back to first user interaction.
   *
   * @param {string} defaultSrc
   */
  function init(defaultSrc) {
    if (_initialized) return;
    _initialized = true;

    _defaultSrc = defaultSrc;
    _currentSrc = defaultSrc;

    _audio = document.getElementById('bgMusic');
    if (!_audio) {
      _audio = document.createElement('audio');
      _audio.id = 'bgMusic';
      document.body.appendChild(_audio);
    }

    _audio.loop    = true;
    _audio.volume  = _volume;
    _audio.preload = 'auto';
    _audio.src     = _defaultSrc;

    _tryPlay();

    ['click', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, _onUserInteraction);
    });
  }

  /**
   * Override the looping background track (e.g. switch to gameplay music).
   * Call restoreDefault() to return to the lobby/menu track.
   *
   * @param {string} src
   */
  function playTrack(src) {
    if (!_audio) return;
    if (src === _currentSrc && !_audio.paused) return;

    _audio.pause();
    _audio.currentTime = 0;
    _currentSrc = src;
    _audio.src  = src;
    _tryPlay();
  }

  /**
   * Return to the default looping track.
   */
  function restoreDefault() {
    if (!_audio || !_defaultSrc) return;
    if (_currentSrc === _defaultSrc && !_audio.paused) return;

    _audio.pause();
    _audio.currentTime = 0;
    _currentSrc = _defaultSrc;
    _audio.src  = _defaultSrc;
    _tryPlay();
  }

  /**
   * Play a one-shot sound effect without interrupting the background track.
   * A fresh Audio element is created, played, then garbage-collected.
   *
   * @param {string} src       Path to the SFX file.
   * @param {number} [vol=0.8] Playback volume (0.0–1.0).
   */
  function playSfx(src, vol = 0.8) {
    if (_muted || !src) return;
    try {
      const sfx   = new Audio(src);
      sfx.volume  = Math.max(0, Math.min(1, vol));
      sfx.play().catch(() => {});  // silently swallow autoplay blocks
    } catch (err) {
      // Non-critical — SFX failure should never crash the game
    }
  }

  /**
   * Pause the background track without changing the source.
   */
  function pause() {
    if (_audio) _audio.pause();
  }

  /**
   * Resume the current background track.
   */
  function resume() {
    _tryPlay();
  }

  /**
   * Toggle mute. Returns the new muted state (true = muted).
   * @returns {boolean}
   */
  function toggleMute() {
    _muted = !_muted;
    if (_audio) {
      if (_muted) {
        _audio.pause();
      } else {
        _tryPlay();
      }
    }
    return _muted;
  }

  /**
   * Set background-track volume (0.0–1.0).
   * Does NOT affect SFX volume.
   * @param {number} v
   */
  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_audio) _audio.volume = _volume;
  }

  /** @returns {boolean} */
  function isMuted() { return _muted; }

  /** @returns {boolean} */
  function isPlaying() { return !!(_audio && !_audio.paused); }

  return {
    init,
    playTrack,
    restoreDefault,
    playSfx,
    pause,
    resume,
    toggleMute,
    setVolume,
    isMuted,
    isPlaying,
  };
})();