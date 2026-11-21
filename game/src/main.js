// The Gloaming Archive — boot, the main loop, the state machine, the
// deterministic screenshot staging, and a small built-in self test.

// A tiny seeded random generator so staged screenshots look the same
// every time they are taken.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Game = {
  state: 'title', // title | intro | playing | paused | caught | levelclear | gameover
  levelIndex: 0,
  level: null, // runtime level (grid, pages, ink, wardens' routes...)
  player: null,
  wardens: [],
  coins: [],
  suspicion: 0, // 0..100, the highest warden suspicion
  alarm: false,
  alarmTimer: 0,
  coinsLeft: CONFIG.coinsPerLevel,
  pagesGot: 0,
  score: 0,
  levelScore: 0,
  levelRank: 'C',
  totalScore: 0,
  totalAlarms: 0,
  totalNearMisses: 0,
  levelTime: 0,
  nearMisses: 0,
  alarmsThisLevel: 0,
  ghost: true,
  muted: false,
  time: 0,
  frozen: false, // staging mode: render but do not advance the world
  rng: Math.random,
  canvas: null,
  ctx: null,
};

// Deep-copy a level definition into a fresh runtime level.
function buildRuntimeLevel(levelDef) {
  const level = {
    grid: levelDef.grid.slice(),
    lanterns: levelDef.lanterns,
    shadows: levelDef.shadows,
    ferns: levelDef.ferns,
    exit: levelDef.exit,
    pages: levelDef.pages.map(function (p) {
      return { x: p[0], y: p[1], taken: false };
    }),
    ink: levelDef.ink.map(function (p) {
      return { x: p[0], y: p[1], taken: false };
    }),
  };
  return level;
}

// Load a level fresh: reset the player, wardens, timers and counters.
function loadLevel(index) {
  Game.levelIndex = index;
  Game.level = buildRuntimeLevel(LEVELS[index]);
  Game.player = createPlayer(LEVELS[index]);
  Game.wardens = createWardens(LEVELS[index]);
  Game.coins = [];
  Game.suspicion = 0;
  Game.alarm = false;
  Game.alarmTimer = 0;
  Game.coinsLeft = CONFIG.coinsPerLevel;
  Game.pagesGot = 0;
  Game.levelTime = 0;
  Game.nearMisses = 0;
  Game.alarmsThisLevel = 0;
  Game.ghost = true;
  Game.levelScore = 0;
  Game.levelRank = 'C';
  Game.state = 'intro';
}

// The title screen sits over level 1 so the archive is visible behind it.
function setupTitleBackdrop() {
  Game.levelIndex = 0;
  Game.level = buildRuntimeLevel(LEVELS[0]);
  Game.player = createPlayer(LEVELS[0]);
  Game.wardens = createWardens(LEVELS[0]);
  Game.coins = [];
  Game.suspicion = 0;
  Game.alarm = false;
  Game.state = 'title';
}

// Called when a chasing warden touches the player.
function onPlayerCaught() {
  if (Game.state !== 'playing') return;
  Game.state = 'caught';
  Game.totalAlarms += 1;
  AudioSys.caughtSound();
}

// Called when the player steps onto an open exit.
function onLevelComplete() {
  if (Game.state !== 'playing') return;
  const level = LEVELS[Game.levelIndex];
  const timeBonus = Math.max(0, Math.round((level.parTime - Game.levelTime) * CONFIG.timeBonusPerSecond));
  const ghostBonus = Game.ghost ? CONFIG.ghostBonus : 0;
  const coinBonus = Game.coinsLeft * CONFIG.coinBonus;
  Game.levelScore = Game.score + timeBonus + ghostBonus + coinBonus;
  Game.levelRank = rankForLevel();
  Game.totalScore += Game.levelScore;
  Game.totalNearMisses += Game.nearMisses;
  Game.score = Game.levelScore;
  Game.state = 'levelclear';
  AudioSys.winSound();
}

// One simulation step: player, then wardens, then coins and the clock.
function updateGame(dt) {
  if (Game.state !== 'playing') return;
  Game.levelTime += dt;
  updatePlayer(Game.level, Game.player, dt);
  if (Game.state !== 'playing') return;
  updateWardens(Game.level, Game.player, dt);
  for (const coin of Game.coins) coin.t += dt;
  Game.coins = Game.coins.filter(function (coin) {
    return coin.t < 2.5;
  });
}

// ---- Deterministic screenshot staging (?shot=...&seed=...) ----
// Each scene sets up a fixed moment, runs a fixed number of steps with
// the seeded random generator, then freezes the world so the frame the
// screenshot takes is always the same.

function stageScene(shot, seed) {
  Game.rng = mulberry32(seed || 7);
  Game.muted = true;
  if (shot === 'start') {
    setupTitleBackdrop();
    Game.state = 'title';
    return;
  }
  if (shot === 'win') {
    loadLevel(2);
    Game.state = 'playing';
    Game.pagesGot = 3;
    Game.level.pages.forEach(function (p) {
      p.taken = true;
    });
    Game.levelTime = 172;
    Game.nearMisses = 2;
    Game.alarmsThisLevel = 0;
    Game.ghost = true;
    Game.score = 450;
    onLevelComplete();
    return;
  }
  if (shot === 'alarm') {
    loadLevel(2);
    Game.state = 'playing';
    // Wren sneaking into the shadow at the south-west corner.
    Game.player.x = tileCenterX(3);
    Game.player.y = tileCenterY(14);
    Game.player.sneaking = true;
    // One warden in full alarm, close behind, cone sweeping red.
    const warden = Game.wardens[2];
    warden.x = tileCenterX(6);
    warden.y = tileCenterY(14);
    warden.facing = Math.atan2(
      Game.player.y - warden.y,
      Game.player.x - warden.x,
    );
    warden.state = 'chase';
    warden.suspicion = 100;
    warden.lastSeen = { x: Game.player.x, y: Game.player.y };
    Game.suspicion = 100;
    Game.alarm = true;
    Game.alarmTimer = CONFIG.alarmCalmTime;
    Game.alarmsThisLevel = 1;
    Game.ghost = false;
    runFixedSteps(45);
    return;
  }
  // Default: 'cover' — mid-game in level 2, the richest scene.
  loadLevel(1);
  Game.state = 'playing';
  // Wren sneaking behind a shelf row, one page already taken.
  Game.player.x = tileCenterX(9);
  Game.player.y = tileCenterY(7);
  Game.player.sneaking = true;
  Game.level.pages[0].taken = true;
  Game.pagesGot = 1;
  Game.score = CONFIG.pageScore;
  Game.levelTime = 64;
  // Two wardens mid-patrol, cones sweeping near the player.
  Game.wardens[0].x = tileCenterX(5);
  Game.wardens[0].y = tileCenterY(8);
  Game.wardens[0].facing = 0.2;
  Game.wardens[1].x = tileCenterX(10);
  Game.wardens[1].y = tileCenterY(10);
  Game.wardens[1].facing = -1.2;
  Game.wardens[1].suspicion = 42;
  Game.suspicion = 42;
  runFixedSteps(75);
}

// Advance the world a fixed number of 1/60s steps, then freeze it.
function runFixedSteps(count) {
  for (let i = 0; i < count; i++) {
    Game.time += 1 / 60;
    updateGame(1 / 60);
    if (Game.state !== 'playing') break;
  }
  Game.frozen = true;
}

// ---- Built-in self test (?selftest=1) ----
// Drives the real game functions through the key paths (collect a page,
// locked exit, alarm and calm-down, being caught, finishing each level)
// and writes PASS/FAIL lines into the page for headless checking.
function runSelfTest() {
  const results = [];
  const check = function (name, ok) {
    results.push((ok ? 'PASS' : 'FAIL') + ' ' + name);
  };
  const step = function (n) {
    for (let i = 0; i < n; i++) updateGame(1 / 60);
  };

  // Level 1 loads with a valid grid and a walkable start.
  loadLevel(0);
  check('level1 grid 18x32', Game.level.grid.length === 18 && Game.level.grid.every(function (r) { return r.length === 32; }));
  check('player start walkable', !tileBlocksMovement(Game.level, LEVELS[0].playerStart[0], LEVELS[0].playerStart[1]));
  check('all levels valid grids', LEVELS.every(function (l) { return l.grid.length === 18 && l.grid.every(function (r) { return r.length === 32; }); }));

  // The exit stays locked until the page is collected.
  Game.state = 'playing';
  Game.player.x = tileCenterX(30);
  Game.player.y = tileCenterY(8);
  step(5);
  check('exit locked before page', Game.state === 'playing' && Game.pagesGot === 0);

  // Walking onto the page collects it.
  Game.player.x = tileCenterX(28);
  Game.player.y = tileCenterY(8);
  step(5);
  check('page collected', Game.pagesGot === 1);

  // Now the exit opens and finishes the level.
  Game.player.x = tileCenterX(30);
  Game.player.y = tileCenterY(8);
  step(5);
  check('level1 completes at open exit', Game.state === 'levelclear');

  // A coin throw is legal on a nearby floor tile and costs one coin.
  loadLevel(0);
  Game.state = 'playing';
  const coinsBefore = Game.coinsLeft;
  const threw = throwDistractionCoin(Game.level, Game.player, 5, 9);
  check('coin throw works', threw && Game.coinsLeft === coinsBefore - 1);

  // Detection rises inside a cone, and the alarm fades when unseen.
  loadLevel(0);
  Game.state = 'playing';
  const warden = Game.wardens[0];
  warden.x = tileCenterX(18);
  warden.y = tileCenterY(10);
  warden.facing = Math.PI / 2; // looking down the corridor
  Game.player.x = tileCenterX(18);
  Game.player.y = tileCenterY(13);
  Game.player.sneaking = false;
  step(120);
  check('suspicion rises in cone', Game.suspicion > 0);
  // Hide far away in shadow and wait out the alarm.
  Game.state = 'playing';
  Game.player.x = tileCenterX(3);
  Game.player.y = tileCenterY(14);
  Game.player.sneaking = true;
  for (const w of Game.wardens) {
    w.x = tileCenterX(25);
    w.y = tileCenterY(2);
    w.state = 'patrol';
    w.suspicion = 0;
  }
  Game.alarm = false;
  step(360);
  check('suspicion decays when unseen', Game.suspicion < 10);

  // A chasing warden that touches the player catches them.
  loadLevel(0);
  Game.state = 'playing';
  Game.wardens[0].state = 'chase';
  Game.wardens[0].suspicion = 100;
  Game.wardens[0].x = Game.player.x;
  Game.wardens[0].y = Game.player.y;
  Game.alarm = true;
  Game.alarmTimer = 5;
  step(2);
  check('caught on touch during alarm', Game.state === 'caught');

  // Every level can be finished by collecting its pages and reaching exit.
  let allFinish = true;
  for (let i = 0; i < LEVELS.length; i++) {
    loadLevel(i);
    Game.state = 'playing';
    for (const page of Game.level.pages) {
      Game.player.x = tileCenterX(page.x);
      Game.player.y = tileCenterY(page.y);
      step(3);
    }
    Game.player.x = tileCenterX(Game.level.exit[0]);
    Game.player.y = tileCenterY(Game.level.exit[1]);
    step(3);
    if (Game.state !== 'levelclear') allFinish = false;
  }
  check('all 3 levels finishable', allFinish);

  const pre = document.createElement('pre');
  pre.id = 'selftest';
  pre.textContent = results.join('\n');
  document.body.appendChild(pre);
  document.title = results.every(function (r) { return r.indexOf('PASS') === 0; }) ? 'SELFTEST PASS' : 'SELFTEST FAIL';
}

// ---- Boot ----

function boot() {
  Game.canvas = document.getElementById('game');
  Game.ctx = Game.canvas.getContext('2d');
  renderCtx = Game.ctx;
  setupInput(Game.canvas);

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '7', 10);
  if (params.get('selftest') === '1') {
    setupTitleBackdrop();
    runSelfTest();
  } else if (shot) {
    stageScene(shot, seed);
  } else {
    setupTitleBackdrop();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!Game.frozen) {
      Game.time += dt;
      updateGame(dt);
    }
    renderFrame(Game.ctx, Game.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', boot);
