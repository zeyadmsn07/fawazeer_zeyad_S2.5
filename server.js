const express    = require('express');
const session    = require('express-session');
const fs         = require('fs');
const path       = require('path');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
const DB_PATH = path.join(__dirname, 'data', 'db.json');
 
const USERS = [
  { id: 1,  username: 'Hady',    password: '12345*',  displayName: 'Hady'    },
  { id: 2,  username: 'Mostafa', password: '12345*',  displayName: 'Mostafa' },
  { id: 3,  username: 'Joe E.',  password: '12345*',  displayName: 'Joe E.'  },
  { id: 4,  username: 'Joe S.',  password: '12345*',  displayName: 'Joe S.'  },
  { id: 5,  username: 'Mo S.',   password: '12345*',  displayName: 'Mo S.'   },
  { id: 6,  username: 'Mo I.',   password: '12345*',  displayName: 'Mo I.'   },
  { id: 7,  username: 'Mazen',   password: '12345*',  displayName: 'Mazen'   },
  { id: 8,  username: 'Abdo',    password: '12345*',  displayName: 'Abdo'    },
];

// ─── Date-specific game overrides ────────────────────────────────────────────
// Games scheduled for a specific calendar date take priority over the rotation.
const DATE_OVERRIDES = {
  '2026-05-26': {
    gameId:      'baba-black-sheep',
    title:       'Baba Black Sheep!',
    description: 'Press SPACE every time a black sheep appears — but don\'t press it on the white ones!',
  },
};
 
const DAILY_SCHEDULE = [
  { gameId: 'day1', title: 'The Speedy Box', description: 'Click the moving box before time runs out!' },
];
 
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const empty = { scores: {}, playedStates: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // Ensure playedStates key always exists
    if (!parsed.playedStates) parsed.playedStates = {};
    return parsed;
  } catch {
    const empty = { scores: {}, playedStates: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
}
 
function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}
 
function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
 
function getTodaysGame() {
  const today = todayString();

  // Date-specific override takes priority
  if (DATE_OVERRIDES[today]) {
    return { ...DATE_OVERRIDES[today], dateString: today };
  }

  // Fall back to day-of-year rotation
  const now      = new Date();
  const start    = new Date(now.getFullYear(), 0, 0);
  const diff     = now - start;
  const oneDay   = 86400000;
  const dayOfYear = Math.floor(diff / oneDay);
  const idx      = (dayOfYear - 1) % DAILY_SCHEDULE.length;
  return {
    ...DAILY_SCHEDULE[idx],
    dateString: today,
  };
}
 
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
 
app.use(session({
  secret: 'fazoora-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
 
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  next();
}
 
// ─── Auth endpoints ───────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
 
  const user = USERS.find(
    u => u.username === username.trim() && u.password === password
  );
 
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
 
  req.session.user = { id: user.id, username: user.username, displayName: user.displayName };
  return res.json({ success: true, user: req.session.user });
});
 
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});
 
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// ─── Daily game endpoint ──────────────────────────────────────────────────────
 
app.get('/api/daily', requireAuth, (req, res) => {
  const game      = getTodaysGame();
  const db        = readDb();
  const userId    = String(req.session.user.id);
  const todayKey  = game.dateString;
 
  const userScores = db.scores[userId] || {};
  const todayEntry = userScores[todayKey] || null;

  // Check if the user has already started today's game (even if they didn't finish)
  const played = !!(db.playedStates[userId] && db.playedStates[userId][todayKey]);
 
  res.json({
    game,
    completed: !!todayEntry,
    played,
    result: todayEntry,
  });
});

// ─── Mark played (call when player presses "I'm Ready") ──────────────────────

app.post('/api/mark-played', requireAuth, (req, res) => {
  const game     = getTodaysGame();
  const db       = readDb();
  const userId   = String(req.session.user.id);
  const todayKey = game.dateString;

  if (!db.playedStates[userId]) db.playedStates[userId] = {};
  db.playedStates[userId][todayKey] = true;

  writeDb(db);
  return res.json({ success: true });
});
 
// ─── Score endpoint ───────────────────────────────────────────────────────────

app.post('/api/score', requireAuth, (req, res) => {
  const { score } = req.body;
 
  if (typeof score !== 'number' || score < 0 || !isFinite(score)) {
    return res.status(400).json({ error: 'Invalid score value.' });
  }
 
  const game     = getTodaysGame();
  const db       = readDb();
  const userId   = String(req.session.user.id);
  const todayKey = game.dateString;
 
  if (!db.scores[userId]) db.scores[userId] = {};
 
  if (db.scores[userId][todayKey]) {
    return res.status(409).json({ error: 'Score already submitted for today.' });
  }
 
  db.scores[userId][todayKey] = {
    gameId:      game.gameId,
    score:       Math.round(score),
    completedAt: new Date().toISOString(),
  };
 
  writeDb(db);
 
  return res.json({
    success:  true,
    saved:    db.scores[userId][todayKey],
  });
});

// ─── Scoreboard ───────────────────────────────────────────────────────────────
 
app.get('/api/scoreboard', requireAuth, (req, res) => {
  const db = readDb();
 
  const board = USERS.map(user => {
    const uid        = String(user.id);
    const userScores = db.scores[uid] || {};
    const entries    = Object.values(userScores);
    const totalScore = entries.reduce((sum, e) => sum + (e.score || 0), 0);
    const gamesPlayed = entries.length;
    const lastPlayed = entries.length
      ? entries.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0].completedAt
      : null;
 
    return {
      userId:      user.id,
      displayName: user.displayName,
      username:    user.username,
      totalScore,
      gamesPlayed,
      lastPlayed,
    };
  });
 
  board.sort((a, b) => b.totalScore - a.totalScore);
 
  res.json(board);
});
 
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
app.listen(PORT, () => {
  console.log(`\n🎮 Fazoora Platform running at http://localhost:${PORT}`);
  console.log(`📅 Today's game: ${JSON.stringify(getTodaysGame())}\n`);
});