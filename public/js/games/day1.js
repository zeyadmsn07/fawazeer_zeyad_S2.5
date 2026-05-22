(function () {

  let _canvas;
  let _ctx;
  let _assets;
  let _engineAPI;

  let _box = {
    x: 0,
    y: 0,
    w: 80,
    h: 80,
    vx: 4,
    vy: 3,
    color: '#7c3aed',
    hitGlow: 0,
  };

  let _score = 0;
  let _hits = 0;
  let _timeLeft = 15;
  let _lastTickTime = null;
  let _running = false;
  let _frameCount = 0;

  let _particles = [];

  function _randomisePosition() {
    _box.x =
      Math.random() * (_canvas.width - _box.w);

    _box.y =
      Math.random() * (_canvas.height - _box.h);
  }

  function _bumpDifficulty() {
    const factor = 1 + (_hits * 0.04);

    const baseSpeed = 4;

    _box.vx =
      (Math.random() > 0.5 ? 1 : -1) *
      baseSpeed *
      factor;

    _box.vy =
      (Math.random() > 0.5 ? 1 : -1) *
      (baseSpeed - 1) *
      factor;

    if (_hits % 3 === 0 && _box.w > 40) {
      _box.w -= 4;
      _box.h -= 4;
    }
  }

  function _spawnParticles(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle =
        (Math.PI * 2 / count) * i;

      const speed =
        2 + Math.random() * 4;

      _particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        radius: 4 + Math.random() * 4,
        color: [
          '#f59e0b',
          '#7c3aed',
          '#10b981',
          '#3b82f6'
        ][Math.floor(Math.random() * 4)],
      });
    }
  }

  function _onClick(event) {
    if (!_running) return;

    const rect =
      _canvas.getBoundingClientRect();

    const scaleX =
      _canvas.width / rect.width;

    const scaleY =
      _canvas.height / rect.height;

    const mx =
      (event.clientX - rect.left) * scaleX;

    const my =
      (event.clientY - rect.top) * scaleY;

    if (
      mx >= _box.x &&
      mx <= _box.x + _box.w &&
      my >= _box.y &&
      my <= _box.y + _box.h
    ) {
      _hits++;
      _score += 10;

      _engineAPI.updateScore(_score);

      _box.hitGlow = 8;

      _spawnParticles(mx, my);

      _bumpDifficulty();

      _randomisePosition();
    }
  }

  function _drawBackground() {
    const grad =
      _ctx.createLinearGradient(
        0,
        0,
        0,
        _canvas.height
      );

    grad.addColorStop(0, '#0d0828');
    grad.addColorStop(1, '#1a1040');

    _ctx.fillStyle = grad;

    _ctx.fillRect(
      0,
      0,
      _canvas.width,
      _canvas.height
    );

    _ctx.strokeStyle =
      'rgba(255,255,255,0.03)';

    _ctx.lineWidth = 1;

    const step = 40;

    for (
      let x = 0;
      x < _canvas.width;
      x += step
    ) {
      _ctx.beginPath();

      _ctx.moveTo(x, 0);

      _ctx.lineTo(
        x,
        _canvas.height
      );

      _ctx.stroke();
    }

    for (
      let y = 0;
      y < _canvas.height;
      y += step
    ) {
      _ctx.beginPath();

      _ctx.moveTo(0, y);

      _ctx.lineTo(
        _canvas.width,
        y
      );

      _ctx.stroke();
    }
  }

  function _drawBox() {
    _ctx.save();

    if (_box.hitGlow > 0) {
      _ctx.shadowBlur = 30;
      _ctx.shadowColor = '#f59e0b';

      _box.hitGlow--;
    } else {
      _ctx.shadowBlur = 12;
      _ctx.shadowColor = _box.color;
    }

    _ctx.fillStyle = _box.color;

    _ctx.beginPath();

    _ctx.roundRect(
      _box.x,
      _box.y,
      _box.w,
      _box.h,
      12
    );

    _ctx.fill();

    _ctx.shadowBlur = 0;

    _ctx.fillStyle =
      'rgba(255,255,255,0.18)';

    _ctx.beginPath();

    _ctx.roundRect(
      _box.x + 8,
      _box.y + 8,
      _box.w * 0.45,
      _box.h * 0.22,
      6
    );

    _ctx.fill();

    _ctx.fillStyle = '#fff';

    _ctx.font =
      `bold ${Math.round(_box.w * 0.28)}px Nunito`;

    _ctx.textAlign = 'center';

    _ctx.textBaseline = 'middle';

    _ctx.fillText(
      'TAP!',
      _box.x + _box.w / 2,
      _box.y + _box.h / 2
    );

    _ctx.restore();
  }

  function _drawParticles() {
    _particles.forEach((p) => {
      _ctx.save();

      _ctx.globalAlpha = p.life;

      _ctx.fillStyle = p.color;

      _ctx.beginPath();

      _ctx.arc(
        p.x,
        p.y,
        p.radius * p.life,
        0,
        Math.PI * 2
      );

      _ctx.fill();

      _ctx.restore();
    });
  }

  function _updateParticles() {
    _particles =
      _particles.filter((p) => p.life > 0);

    _particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.04;
    });
  }

  function _drawCountdownOverlay(secondsLeft) {
    if (secondsLeft > 3) return;

    _ctx.save();

    _ctx.globalAlpha = 0.7;

    _ctx.fillStyle =
      secondsLeft <= 1
        ? '#ef4444'
        : '#f59e0b';

    _ctx.font =
      `bold ${Math.round(_canvas.height * 0.35)}px Fredoka One`;

    _ctx.textAlign = 'center';

    _ctx.textBaseline = 'middle';

    _ctx.fillText(
      secondsLeft,
      _canvas.width / 2,
      _canvas.height / 2
    );

    _ctx.restore();
  }

  const Day1Game = {

    start(canvas, ctx, assets, engineAPI) {
      _canvas = canvas;
      _ctx = ctx;
      _assets = assets;
      _engineAPI = engineAPI;

      _score = 0;
      _hits = 0;
      _timeLeft = 15;
      _lastTickTime = performance.now();
      _running = true;
      _frameCount = 0;
      _particles = [];

      _box.w = 80;
      _box.h = 80;

      _randomisePosition();

      _bumpDifficulty();

      _engineAPI.updateScore(0);

      _engineAPI.updateTimer(_timeLeft);

      _canvas.addEventListener(
        'click',
        _onClick
      );

      console.log('[Day1] Game started.');
    },

    update(elapsedMs, ctx, canvas) {
      if (!_running) return;

      _frameCount++;

      const now = performance.now();

      const delta =
        now - _lastTickTime;

      if (delta >= 1000) {
        _timeLeft--;

        _lastTickTime = now;

        _engineAPI.updateTimer(
          _timeLeft
        );

        if (_timeLeft <= 0) {
          _running = false;

          _engineAPI.endGame(
            _score,
            {
              icon:
                _score >= 50
                  ? '🎉'
                  : '😅',

              message:
                `You clicked the box ${_hits} time${_hits !== 1 ? 's' : ''}!`,
            }
          );

          return;
        }
      }

      _box.x += _box.vx;
      _box.y += _box.vy;

      if (
        _box.x <= 0 ||
        _box.x + _box.w >= _canvas.width
      ) {
        _box.vx *= -1;

        _box.x = Math.max(
          0,
          Math.min(
            _box.x,
            _canvas.width - _box.w
          )
        );
      }

      if (
        _box.y <= 0 ||
        _box.y + _box.h >= _canvas.height
      ) {
        _box.vy *= -1;

        _box.y = Math.max(
          0,
          Math.min(
            _box.y,
            _canvas.height - _box.h
          )
        );
      }

      _drawBackground();

      _drawBox();

      _updateParticles();

      _drawParticles();

      _drawCountdownOverlay(_timeLeft);
    },

    destroy() {
      _running = false;

      if (_canvas) {
        _canvas.removeEventListener(
          'click',
          _onClick
        );
      }

      _particles = [];

      console.log('[Day1] Destroyed.');
    },

  };

  if (typeof GameEngine !== 'undefined') {
    GameEngine.register(
      'day1',
      Day1Game
    );
  } else {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        GameEngine.register(
          'day1',
          Day1Game
        );
      }
    );
  }

})();