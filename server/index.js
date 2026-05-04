const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { db: firestore } = require('./firebase');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const DB_FILE = path.join(__dirname, 'db.json');

// Active timeout timers (in-memory)
const timeoutTimers = {};

function clearTimeoutTimer(teamId) {
  if (timeoutTimers[teamId]) {
    clearTimeout(timeoutTimers[teamId]);
    delete timeoutTimers[teamId];
  }
}

// ── Helpers ──────────────────────────────────────────────
function getDefaultDB() {
  return {
    gameState: {
      isGameActive: false,
      isPaused: false,
      status: 'not_started',
      phase: 'phase1', // 'phase1' or 'phase2'
      gameStartedAt: null,
      pausedAt: null,
      elapsedBeforePause: 0,
      domains: ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'],
      timeoutDurationOverride: null
    },
    teams: [],
    matchmakingQueue: [],
    activeMatches: [],
    matchHistory: [],
    notifications: [],
    tokenHistory: [],
    // Track constraints: { teamId: { opponents: {opponentId: count}, domains: {domain: count}, opponentDomains: {"opId:domain": count}, lastOpponent: id, lastDomain: str } }
    matchConstraints: {}
  };
}

async function readDB() {
  const dbObj = getDefaultDB();
  if (firestore) {
    try {
      const gsDoc = await firestore.collection('system').doc('gameState').get();
      if (gsDoc.exists) {
        dbObj.gameState = { ...dbObj.gameState, ...gsDoc.data() };
        const collections = ['teams', 'matchmakingQueue', 'activeMatches', 'matchHistory', 'notifications', 'tokenHistory'];
        for (const col of collections) {
          const snapshot = await firestore.collection(col).get();
          dbObj[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        // Read constraints doc
        const cDoc = await firestore.collection('system').doc('matchConstraints').get();
        if (cDoc.exists) dbObj.matchConstraints = cDoc.data();
        await reconcileTimeouts(dbObj);
        return dbObj;
      } else {
        try {
          if (fs.existsSync(DB_FILE)) {
            const localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            await writeDB(localData);
            return localData;
          }
        } catch (e) { console.error('Migration failed:', e.message); }
      }
    } catch (err) { console.error('Firestore Read Error:', err); }
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const merged = { ...dbObj, ...JSON.parse(data) };
    await reconcileTimeouts(merged);
    return merged;
  } catch (err) { return dbObj; }
}

async function writeDB(data) {
  // Ensure matchConstraints exists
  if (!data.matchConstraints) data.matchConstraints = {};
  if (firestore) {
    try {
      await firestore.collection('system').doc('gameState').set(data.gameState);
      await firestore.collection('system').doc('matchConstraints').set(data.matchConstraints);
      const collections = ['teams', 'matchmakingQueue', 'activeMatches', 'matchHistory', 'notifications', 'tokenHistory'];
      for (const colName of collections) {
        const batch = firestore.batch();
        const currentDocs = await firestore.collection(colName).get();
        currentDocs.forEach(doc => batch.delete(doc.ref));
        (data[colName] || []).forEach(item => {
          const docRef = firestore.collection(colName).doc(item.id || String(Date.now()));
          const { id, ...cleanItem } = item;
          batch.set(docRef, cleanItem);
        });
        await batch.commit();
      }
    } catch (err) { console.error('Firestore Write Error:', err); }
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function addNotification(db, message) {
  db.notifications.unshift({ id: 'n_' + Date.now(), message, time: new Date().toLocaleTimeString() });
  if (db.notifications.length > 50) db.notifications.pop();
}

function resetTimedOutTeam(db, team) {
  clearTimeoutTimer(team.id);
  team.tokens = 1;
  team.status = 'idle';
  team.timeoutUntil = null;
  team.lastTokenUpdateTime = Date.now();
  db.tokenHistory.unshift({ id: 'th_' + Date.now(), team: team.name, change: '+1', reason: 'Timeout reset', timestamp: new Date().toLocaleTimeString() });
  addNotification(db, `⏰ ${team.name} timeout ended — reset to 1 token!`);
}

function armTimeoutTimer(team) {
  const remaining = team.timeoutUntil - Date.now();
  if (remaining <= 0) return false;
  clearTimeoutTimer(team.id);
  timeoutTimers[team.id] = setTimeout(async () => {
    const freshDb = await readDB();
    const t = freshDb.teams.find(x => x.id === team.id);
    if (t && t.status === 'timeout') {
      resetTimedOutTeam(freshDb, t);
      await writeDB(freshDb);
      broadcast(freshDb);
    }
    clearTimeoutTimer(team.id);
  }, remaining);
  return true;
}

async function reconcileTimeouts(db) {
  let changed = false;
  const now = Date.now();

  for (const team of db.teams || []) {
    if (team.status !== 'timeout') {
      clearTimeoutTimer(team.id);
      continue;
    }

    if (!team.timeoutUntil || team.timeoutUntil <= now) {
      resetTimedOutTeam(db, team);
      changed = true;
      continue;
    }

    if (!timeoutTimers[team.id]) {
      armTimeoutTimer(team);
    }
  }

  if (changed) {
    await writeDB(db);
  }
}

async function sweepTimeouts() {
  try {
    const db = await readDB();
    await reconcileTimeouts(db);
  } catch (err) {
    console.error('Timeout sweep failed:', err);
  }
}

function getGameElapsedMs(gs) {
  if (!gs.gameStartedAt) return 0;
  if (gs.isPaused && gs.pausedAt) return gs.pausedAt - gs.gameStartedAt;
  if (gs.isGameActive) return Date.now() - gs.gameStartedAt;
  return 0;
}

function getTimeoutDuration(gs) {
  if (gs.timeoutDurationOverride) return gs.timeoutDurationOverride;
  const elapsed = getGameElapsedMs(gs);
  return elapsed < 30 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000;
}

// Check match constraints
function canMatch(db, teamAId, teamBId, domain) {
  const c = db.matchConstraints || {};
  const cA = c[teamAId] || {};
  const cB = c[teamBId] || {};

  // Same opponent ≤ 2 times
  if ((cA.opponents?.[teamBId] || 0) >= 2) return { ok: false, reason: 'Already faced this opponent 2 times' };
  // No consecutive repeat opponent
  if (cA.lastOpponent === teamBId) return { ok: false, reason: 'Cannot face same opponent consecutively' };
  if (cB.lastOpponent === teamAId) return { ok: false, reason: 'Cannot face same opponent consecutively' };

  if (domain) {
    // Same domain ≤ 2 times per team
    if ((cA.domains?.[domain] || 0) >= 2) return { ok: false, reason: `Team already played ${domain} 2 times` };
    if ((cB.domains?.[domain] || 0) >= 2) return { ok: false, reason: `Opponent already played ${domain} 2 times` };
    // Same opponent + same domain → only once
    const keyAB = `${teamBId}:${domain}`;
    const keyBA = `${teamAId}:${domain}`;
    if ((cA.opponentDomains?.[keyAB] || 0) >= 1) return { ok: false, reason: 'Already played this opponent in this domain' };
    // No consecutive domain
    if (cA.lastDomain === domain) return { ok: false, reason: 'Cannot repeat same domain consecutively' };
    if (cB.lastDomain === domain) return { ok: false, reason: 'Opponent cannot repeat same domain consecutively' };
  }
  return { ok: true };
}

function recordConstraints(db, teamAId, teamBId, domain) {
  if (!db.matchConstraints) db.matchConstraints = {};
  for (const [me, opp] of [[teamAId, teamBId], [teamBId, teamAId]]) {
    if (!db.matchConstraints[me]) db.matchConstraints[me] = { opponents: {}, domains: {}, opponentDomains: {}, lastOpponent: null, lastDomain: null };
    const c = db.matchConstraints[me];
    c.opponents[opp] = (c.opponents[opp] || 0) + 1;
    if (domain) {
      c.domains[domain] = (c.domains[domain] || 0) + 1;
      c.opponentDomains[`${opp}:${domain}`] = (c.opponentDomains[`${opp}:${domain}`] || 0) + 1;
      c.lastDomain = domain;
    }
    c.lastOpponent = opp;
  }
}

function pickDomainForTeams(db, teamAId, teamBId, preferredDomain) {
  const allDomains = db.gameState.domains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
  const available = allDomains.filter((d) => canMatch(db, teamAId, teamBId, d).ok);
  const pool = available.length > 0 ? available : allDomains;

  if (preferredDomain && pool.includes(preferredDomain)) {
    return { domain: preferredDomain, availableDomains: pool };
  }

  const domain = pool[Math.floor(Math.random() * pool.length)];
  return { domain, availableDomains: pool };
}

function getPublicState(db) {
  return {
    gameState: db.gameState,
    teams: db.teams.map(t => ({
      id: t.id, name: t.name, leader: t.leader, memberNames: t.memberNames,
      members: t.memberNames ? t.memberNames.length : 0,
      tokens: t.tokens, status: t.status, totalTime: t.totalTime || 0,
      timeoutUntil: t.timeoutUntil || null, lastTokenUpdateTime: t.lastTokenUpdateTime || null
    })),
    matchmakingQueue: db.matchmakingQueue || [],
    activeMatches: db.activeMatches,
    matchHistory: db.matchHistory,
    notifications: db.notifications,
    tokenHistory: db.tokenHistory,
    matchConstraints: db.matchConstraints || {}
  };
}

function broadcast(db) { io.emit('stateUpdate', getPublicState(db)); }

function startTimeoutTimer(db, team) {
  clearTimeoutTimer(team.id);
  const duration = getTimeoutDuration(db.gameState);
  team.status = 'timeout';
  team.timeoutUntil = Date.now() + duration;

  timeoutTimers[team.id] = setTimeout(async () => {
    const freshDb = await readDB();
    const t = freshDb.teams.find(x => x.id === team.id);
    if (t && t.status === 'timeout') {
      resetTimedOutTeam(freshDb, t);
      await writeDB(freshDb);
      broadcast(freshDb);
    }
    clearTimeoutTimer(team.id);
  }, duration);
}

// ── Socket.IO ────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  readDB().then(db => socket.emit('stateUpdate', getPublicState(db)));

  // ── AUTH ──
  socket.on('login', async ({ username, password }, callback) => {
    const db = await readDB();
    if (username === 'iamadmin' && password === 'iamadmin') {
      return callback({ success: true, role: 'admin', teamId: null, teamName: null });
    }
    const team = db.teams.find(t => t.name.toLowerCase() === username.toLowerCase());
    if (team && team.password === password) {
      return callback({ success: true, role: 'player', teamId: team.id, teamName: team.name });
    }
    return callback({ success: false, error: 'Invalid username or password' });
  });

  // ── ADMIN: CREATE TEAM ──
  socket.on('createTeam', async (teamData) => {
    const db = await readDB();
    const { name, memberNames, leader, password } = teamData;
    if (db.teams.find(t => t.name.toLowerCase() === name.toLowerCase())) {
      return socket.emit('error', { message: 'Team name already exists' });
    }
    const newTeam = {
      id: 't_' + Date.now(), name, memberNames: memberNames || [],
      leader: leader || (memberNames && memberNames[0]) || name,
      password: password || '1234', tokens: 1, status: 'idle',
      totalTime: 0, timeoutUntil: null, lastTokenUpdateTime: Date.now()
    };
    db.teams.push(newTeam);
    db.tokenHistory.unshift({ id: 'th_' + Date.now(), team: newTeam.name, change: '+1', reason: 'Initial assignment', timestamp: new Date().toLocaleTimeString() });
    addNotification(db, `Team "${newTeam.name}" has entered the arena!`);
    await writeDB(db);
    broadcast(db);
  });

  // ── ADMIN: DELETE TEAM ──
  socket.on('deleteTeam', async (teamId) => {
    const db = await readDB();
    const team = db.teams.find(t => t.id === teamId);
    if (team) {
      db.matchmakingQueue = (db.matchmakingQueue || []).filter(q => q.teamId !== teamId);
      db.teams = db.teams.filter(t => t.id !== teamId);
      if (timeoutTimers[teamId]) { clearTimeout(timeoutTimers[teamId]); delete timeoutTimers[teamId]; }
      addNotification(db, `Team "${team.name}" has been removed.`);
      await writeDB(db);
      broadcast(db);
    }
  });

  // ── ADMIN: EDIT TEAM ──
  socket.on('editTeam', async (teamData) => {
    const db = await readDB();
    const { id, name, memberNames, leader, password, tokens } = teamData;
    const team = db.teams.find(t => t.id === id);
    if (team) {
      if (name) team.name = name;
      if (memberNames) team.memberNames = memberNames;
      if (leader) team.leader = leader;
      if (password) team.password = password;
      if (tokens !== undefined) { team.tokens = tokens; team.lastTokenUpdateTime = Date.now(); }
      addNotification(db, `Team "${team.name}" details updated by Admin.`);
      await writeDB(db);
      broadcast(db);
    }
  });

  // ── ADMIN: ADJUST TOKENS ──
  socket.on('updateTokens', async ({ teamId, amount, reason }) => {
    const db = await readDB();
    const team = db.teams.find(t => t.id === teamId);
    if (team) {
      team.tokens += amount;
      team.lastTokenUpdateTime = Date.now();
      db.tokenHistory.unshift({ id: 'th_' + Date.now(), team: team.name, change: amount > 0 ? `+${amount}` : `${amount}`, reason: reason || 'Admin adjustment', timestamp: new Date().toLocaleTimeString() });
      addNotification(db, `Admin adjusted ${team.name}'s tokens by ${amount > 0 ? '+' : ''}${amount}`);
      await writeDB(db);
      broadcast(db);
    }
  });

  // ── ADMIN: START GAME ──
  socket.on('startGame', async () => {
    const db = await readDB();
    if (db.gameState.isGameActive) return;
    if (db.gameState.isPaused) {
      const pauseDuration = Date.now() - db.gameState.pausedAt;
      db.gameState.gameStartedAt += pauseDuration;
      db.gameState.isPaused = false;
      db.gameState.isGameActive = true;
      db.gameState.status = 'active';
      addNotification(db, '▶️ Game Resumed!');
    } else {
      db.gameState.isGameActive = true;
      db.gameState.gameStartedAt = Date.now();
      db.gameState.status = 'active';
      db.gameState.phase = 'phase1';
      addNotification(db, `🚀 TOURNAMENT STARTED! Phase 1 — Standard Matchmaking`);
    }
    await writeDB(db);
    broadcast(db);
  });

  // ── ADMIN: PAUSE GAME ──
  socket.on('stopGame', async () => {
    const db = await readDB();
    if (db.gameState.isGameActive && !db.gameState.isPaused) {
      db.gameState.isGameActive = false;
      db.gameState.isPaused = true;
      db.gameState.status = 'paused';
      db.gameState.pausedAt = Date.now();
      addNotification(db, `⏸️ GAME PAUSED by the Admin.`);
      await writeDB(db);
      broadcast(db);
    }
  });

  // ── ADMIN: RESET GAME ──
  socket.on('resetGame', async () => {
    Object.values(timeoutTimers).forEach(t => clearTimeout(t));
    Object.keys(timeoutTimers).forEach(k => delete timeoutTimers[k]);
    const db = getDefaultDB();
    await writeDB(db);
    io.emit('gameReset');
    io.emit('stateUpdate', getPublicState(db));
  });

  // ── ADMIN: TOGGLE PHASE ──
  socket.on('togglePhase', async () => {
    const db = await readDB();
    const newPhase = db.gameState.phase === 'phase1' ? 'phase2' : 'phase1';
    db.gameState.phase = newPhase;
    const label = newPhase === 'phase2' ? '🔥 PHASE 2 (WAGER MODE) ACTIVATED!' : '📋 PHASE 1 (STANDARD) RESTORED.';
    addNotification(db, label);
    await writeDB(db);
    broadcast(db);
  });

  // ── ADMIN: SPIN DOMAIN ──
  socket.on('spinDomain', async ({ matchId, preferredDomain }, callback) => {
    const db = await readDB();
    const match = db.activeMatches.find(m => m.id === matchId);
    if (!match) return callback?.({ error: 'Match not found' });

    const { domain, availableDomains } = pickDomainForTeams(db, match.teamA.id, match.teamB.id, preferredDomain);
    match.domain = domain;
    await writeDB(db);
    broadcast(db);
    callback?.({ domain, availableDomains });
  });

  // ── ADMIN: UPDATE DOMAINS ──
  socket.on('updateDomains', async (newDomains) => {
    const db = await readDB();
    db.gameState.domains = newDomains;
    await writeDB(db);
    broadcast(db);
  });

  // ── ADMIN: SET TIMEOUT DURATION ──
  socket.on('setTimeoutDuration', async (durationMs) => {
    const db = await readDB();
    db.gameState.timeoutDurationOverride = durationMs;
    await writeDB(db);
    broadcast(db);
  });

  // ── PLAYER: JOIN QUEUE ──
  socket.on('joinQueue', async ({ teamId }) => {
    const db = await readDB();
    if (!db.gameState.isGameActive || db.gameState.isPaused) return;
    const team = db.teams.find(t => t.id === teamId);
    if (!team || team.status !== 'idle') return;
    if (!db.matchmakingQueue) db.matchmakingQueue = [];
    if (db.matchmakingQueue.find(q => q.teamId === teamId)) return;

    team.status = 'queued';
    db.matchmakingQueue.push({ teamId, teamName: team.name, tokens: team.tokens, joinedAt: Date.now() });
    addNotification(db, `🔍 ${team.name} joined the matchmaking queue!`);

    // Try auto-match
    tryAutoMatch(db);

    await writeDB(db);
    broadcast(db);
  });

  // ── PLAYER: LEAVE QUEUE ──
  socket.on('leaveQueue', async ({ teamId }) => {
    const db = await readDB();
    if (!db.matchmakingQueue) db.matchmakingQueue = [];
    db.matchmakingQueue = db.matchmakingQueue.filter(q => q.teamId !== teamId);
    const team = db.teams.find(t => t.id === teamId);
    if (team && team.status === 'queued') team.status = 'idle';
    await writeDB(db);
    broadcast(db);
  });

  // ── ADMIN: CREATE MATCH (from queue pair) ──
  socket.on('createMatch', async (data, callback) => {
    const db = await readDB();
    const { teamAId, teamBId, domain } = data;

    const t1 = db.teams.find(t => t.id === teamAId);
    const t2 = db.teams.find(t => t.id === teamBId);
    if (!t1 || !t2) return;

    // Guard: ensure neither team is already in an active match
    if ((db.activeMatches || []).some(m => m.teamA.id === teamAId || m.teamB.id === teamAId || m.teamA.id === teamBId || m.teamB.id === teamBId)) {
      return callback?.({ error: 'One or both teams are already in an active match' });
    }

    // Remove from queue
    if (!db.matchmakingQueue) db.matchmakingQueue = [];
    db.matchmakingQueue = db.matchmakingQueue.filter(q => q.teamId !== teamAId && q.teamId !== teamBId);

    // Calculate stakes
    let stakes = 1;
    if (db.gameState.phase === 'phase2') {
      stakes = Math.max(t1.tokens, t2.tokens); // placeholder, actual calc on winner
    }

    const { domain: finalDomain } = pickDomainForTeams(db, t1.id, t2.id, domain);

    // Use a single startTime for both teams and the match so timers stay consistent
    const startTime = Date.now();

    const match = {
      id: 'm_' + Date.now(),
      teamA: { id: t1.id, name: t1.name, tokens: t1.tokens },
      teamB: { id: t2.id, name: t2.name, tokens: t2.tokens },
      domain: finalDomain || 'TBD',
      stakes,
      status: 'Fighting',
      startTime: startTime,
      isWager: db.gameState.phase === 'phase2'
    };

    // mark teams as fighting and note their match id so UI can show synchronized state
    t1.status = 'fighting';
    t2.status = 'fighting';
    t1.currentMatchId = match.id;
    t2.currentMatchId = match.id;

    db.activeMatches.push(match);
    addNotification(db, `🔥 MATCH: ${t1.name} vs ${t2.name} — ${match.domain}!`);
    await writeDB(db);
    broadcast(db);
    callback?.({ success: true, matchId: match.id, domain: match.domain });
  });

  // ── ADMIN: DECLARE WINNER ──
  socket.on('declareWinner', async (data) => {
    const db = await readDB();
    const { matchId, winnerId } = data;
    const matchIdx = db.activeMatches.findIndex(m => m.id === matchId);
    if (matchIdx === -1) return;

    const match = db.activeMatches[matchIdx];
    db.activeMatches.splice(matchIdx, 1);

    const tA = db.teams.find(t => t.id === match.teamA.id);
    const tB = db.teams.find(t => t.id === match.teamB.id);
    if (!tA || !tB) return;

    const isAWinner = tA.id === winnerId;
    const winner = isAWinner ? tA : tB;
    const loser = isAWinner ? tB : tA;
    const elapsed = Date.now() - match.startTime;
    winner.totalMatchTime = (winner.totalMatchTime || 0) + elapsed;
    loser.totalMatchTime = (loser.totalMatchTime || 0) + elapsed;

    // Record constraints
    recordConstraints(db, tA.id, tB.id, match.domain);

    if (db.gameState.phase === 'phase2') {
      // WAGER MODE token rules
      const wA = winner.tokens;
      const wB = loser.tokens;
      if (wA > wB) {
        // Higher token team wins → takes ALL of loser's tokens
        winner.tokens += loser.tokens;
        loser.tokens = 0;
      } else if (wA < wB) {
        // Lower token team wins → gets floor((A+B)/2)
        const total = wA + wB;
        winner.tokens = Math.floor(total / 2);
        loser.tokens = total - winner.tokens;
      } else {
        // Equal tokens → winner takes all
        winner.tokens += loser.tokens;
        loser.tokens = 0;
      }
      winner.lastTokenUpdateTime = Date.now();
      loser.lastTokenUpdateTime = Date.now();

      db.tokenHistory.unshift(
        { id: 'th1_' + Date.now(), team: winner.name, change: `→${winner.tokens}`, reason: `Wager won vs ${loser.name}`, timestamp: new Date().toLocaleTimeString() },
        { id: 'th2_' + Date.now(), team: loser.name, change: `→${loser.tokens}`, reason: `Wager lost vs ${winner.name}`, timestamp: new Date().toLocaleTimeString() }
      );

      // 0 tokens in phase 2 = permanent elimination
      if (loser.tokens === 0) {
        loser.status = 'eliminated';
        addNotification(db, `☠️ ${loser.name} ELIMINATED in Wager Mode!`);
      } else {
        loser.status = 'idle';
      }
      winner.status = 'idle';
      addNotification(db, `🏆 WAGER: ${winner.name} DEFEATED ${loser.name}! (${match.domain})`);

    } else {
      // PHASE 1: standard ±1 token
      winner.tokens += 1;
      loser.tokens = Math.max(0, loser.tokens - 1);
      winner.lastTokenUpdateTime = Date.now();
      loser.lastTokenUpdateTime = Date.now();

      db.tokenHistory.unshift(
        { id: 'th1_' + Date.now(), team: winner.name, change: '+1', reason: `Won vs ${loser.name} (${match.domain})`, timestamp: new Date().toLocaleTimeString() },
        { id: 'th2_' + Date.now(), team: loser.name, change: '-1', reason: `Lost vs ${winner.name} (${match.domain})`, timestamp: new Date().toLocaleTimeString() }
      );

      winner.status = 'idle';

      // Loser at 0 tokens → timeout
      if (loser.tokens === 0) {
        startTimeoutTimer(db, loser);
        addNotification(db, `⏰ ${loser.name} hit 0 tokens — entering timeout!`);
      } else {
        loser.status = 'idle';
      }

      addNotification(db, `🏆 ${winner.name} DEFEATED ${loser.name} in ${match.domain}! (+1 token)`);
    }

    // Clear currentMatchId on both teams so their UI state is synchronized
    if (tA) tA.currentMatchId = null;
    if (tB) tB.currentMatchId = null;

    db.matchHistory.unshift({
      id: 'mh_' + Date.now(), winner: winner.name, loser: loser.name,
      domain: match.domain, stakes: match.isWager ? 'WAGER' : 1,
      duration: elapsed, timestamp: new Date().toLocaleTimeString(),
      isWager: match.isWager
    });

    await writeDB(db);
    broadcast(db);
  });

  socket.on('disconnect', () => { console.log('Client disconnected:', socket.id); });
});

// ── Auto-match logic ──
function tryAutoMatch(db) {
  if (!db.matchmakingQueue || db.matchmakingQueue.length < 2) return;

  const queue = [...db.matchmakingQueue];
  const matched = new Set();
  const isPhase2 = db.gameState.phase === 'phase2';

  for (let i = 0; i < queue.length; i++) {
    if (matched.has(queue[i].teamId)) continue;
    const a = queue[i];
    const aTeam = db.teams.find(t => t.id === a.teamId);
    if (!aTeam) continue;

    // Priority: Phase 1 (min diff), Phase 2 (max diff)
    let bestMatch = null;
    let bestPriority = isPhase2 ? -1 : 999;

    for (let j = i + 1; j < queue.length; j++) {
      if (matched.has(queue[j].teamId)) continue;
      const b = queue[j];
      const bTeam = db.teams.find(t => t.id === b.teamId);
      if (!bTeam) continue;

      const diff = Math.abs(aTeam.tokens - bTeam.tokens);
      if (!isPhase2 && diff > 3) continue;

      // Check constraints (without domain for now)
      const check = canMatch(db, a.teamId, b.teamId, null);
      if (!check.ok) continue;

      if (isPhase2) {
        if (diff > bestPriority) {
          bestPriority = diff;
          bestMatch = b;
        }
      } else {
        if (diff < bestPriority) {
          bestPriority = diff;
          bestMatch = b;
        }
      }
    }

    if (bestMatch) {
      matched.add(a.teamId);
      matched.add(bestMatch.teamId);
      // Mark as matched (admin will create the actual match)
      const aT = db.teams.find(t => t.id === a.teamId);
      const bT = db.teams.find(t => t.id === bestMatch.teamId);
      if (aT) aT.status = 'matched';
      if (bT) bT.status = 'matched';

      // Update queue entries
      const qa = db.matchmakingQueue.find(q => q.teamId === a.teamId);
      const qb = db.matchmakingQueue.find(q => q.teamId === bestMatch.teamId);
      if (qa) qa.matchedWith = bestMatch.teamId;
      if (qb) qb.matchedWith = a.teamId;

      addNotification(db, `🎯 MATCHED: ${a.teamName} vs ${bestMatch.teamName}!`);
    }
  }
}

app.get('/reset', async (req, res) => {
  await writeDB(getDefaultDB());
  broadcast(getDefaultDB());
  res.json({ message: 'Database reset.' });
});

const PORT = 3001;
server.listen(PORT, () => { console.log(`Socket.IO Server running on port ${PORT}`); });

setInterval(sweepTimeouts, 5000);
