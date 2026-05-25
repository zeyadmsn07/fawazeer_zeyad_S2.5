const FazooraAPI = (() => {

  async function _request(url, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const config = {
      headers: defaultHeaders,
      credentials: 'same-origin',
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      },
    };

    let response;

    try {
      response = await fetch(url, config);
    } catch {
      throw new Error('Network error — please check your connection.');
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Server returned an unexpected response (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      const msg =
        (data && data.error)
          ? data.error
          : `HTTP ${response.status}`;

      throw new Error(msg);
    }

    return data;
  }

  async function login(username, password) {
    return _request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async function logout() {
    return _request('/api/logout', { method: 'POST' });
  }

  async function getMe() {
    try {
      return await _request('/api/me');
    } catch (err) {
      if (
        err.message.includes('Not authenticated') ||
        err.message.includes('401')
      ) {
        return null;
      }
      throw err;
    }
  }

  async function getDailyGame() {
    return _request('/api/daily');
  }

  // Called when the player confirms they are ready to play (one-attempt lock)
  async function markPlayed() {
    return _request('/api/mark-played', { method: 'POST' });
  }

  async function submitScore(score) {
    return _request('/api/score', {
      method: 'POST',
      body: JSON.stringify({ score }),
    });
  }

  async function getScoreboard() {
    return _request('/api/scoreboard');
  }

  return {
    login,
    logout,
    getMe,
    getDailyGame,
    markPlayed,
    submitScore,
    getScoreboard,
  };

})();