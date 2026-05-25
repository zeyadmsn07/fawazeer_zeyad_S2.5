/**
 * MusicManager
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages a single looping background audio track that persists across all
 * screens. Respects browser autoplay policy by attempting playback on the
 * first user interaction when autoplay is blocked.
 *
 * Usage:
 *   MusicManager.init('/assets/sounds/default_track.mp3');
 *   MusicManager.playTrack('/assets/sounds/other.mp3');  // override
 *   MusicManager.restoreDefault();                        // go back to default
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
        // Autoplay blocked — will resume on next user interaction
      });
    }
  }

  function _onUserInteraction() {
    // Attempt to resume if paused (handles browser autoplay restriction)
    if (_audio && _audio.paused && !_muted) {
      _tryPlay();
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Call once on page load. Attempts to start the default track immediately;
   * falls back to playing on the first user interaction if autoplay is blocked.
   *
   * @param {string} defaultSrc  Path to the default looping audio file.
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

    // Resume on first interaction (handles browsers that block autoplay)
    ['click', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, _onUserInteraction);
    });
  }

  /**
   * Override the current track with a new one (e.g. gameplay music).
   * Call restoreDefault() to return to the menu/lobby music.
   *
   * @param {string} src  Path to the replacement audio file.
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
   * Return to the default looping track (e.g. after gameplay ends).
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
   * Pause playback without changing the current source.
   */
  function pause() {
    if (_audio) _audio.pause();
  }

  /**
   * Resume the current track (useful after a temporary pause).
   */
  function resume() {
    _tryPlay();
  }

  /**
   * Toggle mute on/off. Returns the new muted state (true = muted).
   *
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
   * Set volume (0.0 – 1.0).
   *
   * @param {number} v
   */
  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_audio) _audio.volume = _volume;
  }

  /** @returns {boolean} */
  function isMuted() { return _muted; }

  /** @returns {boolean} */
  function isPlaying() { return _audio && !_audio.paused; }

  return { init, playTrack, restoreDefault, pause, resume, toggleMute, setVolume, isMuted, isPlaying };
})();