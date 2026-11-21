// The Gloaming Archive — all canvas drawing: floor, light and shadow,
// vision cones, shelves and tables, ferns, wardens, the thief, the exit,
// the HUD, and every screen (title, intro, pause, caught, clear, end).

let renderCtx = null;
let hudCache = {};

// Colours for a warden's cone and marker by its state.
function coneStyleForState(state) {
  if (state === 'chase') {
    return { fill: 'rgba(214, 48, 49, 0.30)', edge: 'rgba(255, 90, 80, 0.85)', mark: '!' };
  }
  if (state === 'suspect') {
    return { fill: 'rgba(232, 126, 32, 0.28)', edge: 'rgba(255, 170, 60, 0.85)', mark: '?' };
  }
  return { fill: 'rgba(255, 196, 90, 0.22)', edge: 'rgba(255, 210, 110, 0.65)', mark: '' };
}

// Draw the wooden floor with plank lines and a soft vignette.
function drawFloor(ctx, level) {
  ctx.fillStyle = '#241b12';
  ctx.fillRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  for (let ty = 0; ty < CONFIG.rows; ty++) {
    for (let tx = 0; tx < CONFIG.cols; tx++) {
      if (level.grid[ty][tx] !== '.') continue;
      const shade = (tx + ty) % 2 === 0 ? '#2a2015' : '#261d13';
      ctx.fillStyle = shade;
      ctx.fillRect(tx * CONFIG.tile, ty * CONFIG.tile, CONFIG.tile, CONFIG.tile);
    }
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  for (let ty = 0; ty <= CONFIG.rows; ty++) {
    ctx.beginPath();
    ctx.moveTo(0, ty * CONFIG.tile);
    ctx.lineTo(CONFIG.viewWidth, ty * CONFIG.tile);
    ctx.stroke();
  }
  for (let tx = 0; tx <= CONFIG.cols; tx += 4) {
    ctx.beginPath();
    ctx.moveTo(tx * CONFIG.tile, 0);
    ctx.lineTo(tx * CONFIG.tile, CONFIG.viewHeight);
    ctx.stroke();
  }
}

// Soft dark-blue shadow zones: the safe ground.
function drawShadowZones(ctx, level) {
  for (const s of level.shadows) {
    const x = s.x * CONFIG.tile;
    const y = s.y * CONFIG.tile;
    const w = s.w * CONFIG.tile;
    const h = s.h * CONFIG.tile;
    const grad = ctx.createRadialGradient(
      x + w / 2, y + h / 2, 10,
      x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
    );
    grad.addColorStop(0, 'rgba(38, 64, 110, 0.55)');
    grad.addColorStop(1, 'rgba(24, 40, 76, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }
}

// Warm pools of lantern light on the floor.
function drawLanternPools(ctx, level, time) {
  for (const lantern of level.lanterns) {
    const lx = tileCenterX(lantern[0]);
    const ly = tileCenterY(lantern[1]);
    const flicker = 1 + Math.sin(time * 3 + lantern[0] * 1.7 + lantern[1]) * 0.06;
    const r = CONFIG.lanternRadius * CONFIG.tile * flicker;
    const grad = ctx.createRadialGradient(lx, ly, 6, lx, ly, r);
    grad.addColorStop(0, 'rgba(255, 196, 110, 0.42)');
    grad.addColorStop(0.6, 'rgba(255, 170, 80, 0.18)');
    grad.addColorStop(1, 'rgba(255, 170, 80, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Fern clumps: layered green arcs the player can hide in while sneaking.
function drawFerns(ctx, level) {
  for (const f of level.ferns) {
    const cx = tileCenterX(f[0]);
    const cy = tileCenterY(f[1]);
    ctx.fillStyle = '#2f6b3a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3f8a4c';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a864';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A glowing parchment page on the floor.
function drawPage(ctx, page, time) {
  const cx = tileCenterX(page.x);
  const cy = tileCenterY(page.y);
  const pulse = 0.5 + Math.sin(time * 3 + page.x) * 0.2;
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
  grad.addColorStop(0, 'rgba(255, 240, 190, ' + (0.5 + pulse * 0.3) + ')');
  grad.addColorStop(1, 'rgba(255, 240, 190, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.25);
  ctx.fillStyle = '#f3e6c2';
  ctx.strokeStyle = '#8a6f3f';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-8, -11, 16, 22);
  ctx.strokeRect(-8, -11, 16, 22);
  ctx.strokeStyle = '#5a4630';
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(5, -5);
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.moveTo(-5, 5);
  ctx.lineTo(2, 5);
  ctx.stroke();
  ctx.restore();
}

// A small ink pot bonus pickup.
function drawInk(ctx, ink, time) {
  const cx = tileCenterX(ink.x);
  const cy = tileCenterY(ink.y);
  const pulse = 0.5 + Math.sin(time * 2.5 + ink.x * 2) * 0.2;
  ctx.fillStyle = 'rgba(120, 180, 255, ' + (0.25 + pulse * 0.2) + ')';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2f4a';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7fb2ff';
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Draw a label centred on cx, clamped so it never runs off the canvas edge.
// (font + textAlign 'center' must already be set on ctx.)
function drawClampedLabel(ctx, text, cx, y) {
  const w = ctx.measureText(text).width;
  const x = Math.max(w / 2 + 4, Math.min(CONFIG.viewWidth - w / 2 - 4, cx));
  ctx.fillText(text, x, y);
}

// The green exit door: locked (padlock + pages missing) or open (glowing).
function drawExit(ctx, level, time) {
  const ex = tileCenterX(level.exit[0]);
  const ey = tileCenterY(level.exit[1]);
  const open = exitIsOpen(level);
  const pulse = open ? 0.6 + Math.sin(time * 4) * 0.25 : 0.35;
  const grad = ctx.createRadialGradient(ex, ey, 4, ex, ey, 34);
  grad.addColorStop(0, open ? 'rgba(80, 255, 140, ' + pulse + ')' : 'rgba(120, 140, 120, 0.3)');
  grad.addColorStop(1, 'rgba(80, 255, 140, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ex, ey, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? '#1f7a3d' : '#3a4a3a';
  ctx.strokeStyle = open ? '#7dffab' : '#6a7a6a';
  ctx.lineWidth = 2;
  ctx.fillRect(ex - 14, ey - 18, 28, 36);
  ctx.strokeRect(ex - 14, ey - 18, 28, 36);
  ctx.strokeStyle = open ? '#a9ffbe' : '#556655';
  ctx.beginPath();
  ctx.moveTo(ex, ey - 18);
  ctx.lineTo(ex, ey + 18);
  ctx.stroke();
  if (!open) {
    ctx.fillStyle = '#d8c27a';
    ctx.fillRect(ex - 5, ey - 2, 10, 9);
    ctx.beginPath();
    ctx.arc(ex, ey - 3, 5, Math.PI, 0);
    ctx.strokeStyle = '#d8c27a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// The exit label, drawn after the walls/shelves so the border wall next to
// the exit (column 31) cannot paint over it. The clamp keeps it in-canvas.
function drawExitLabel(ctx, level) {
  const ex = tileCenterX(level.exit[0]);
  const ey = tileCenterY(level.exit[1]);
  const open = exitIsOpen(level);
  ctx.textAlign = 'center';
  if (!open) {
    const missing = level.pages.length - Game.pagesGot;
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 13px sans-serif';
    drawClampedLabel(ctx, missing + ' page' + (missing > 1 ? 's' : '') + ' left', ex, ey - 26);
  } else {
    ctx.fillStyle = '#a9ffbe';
    ctx.font = 'bold 15px sans-serif';
    drawClampedLabel(ctx, 'EXIT', ex, ey - 26);
  }
}

// Tall shelves: dark wood blocks with coloured book spines.
function drawShelvesAndTables(ctx, level) {
  for (let ty = 0; ty < CONFIG.rows; ty++) {
    for (let tx = 0; tx < CONFIG.cols; tx++) {
      const c = level.grid[ty][tx];
      const x = tx * CONFIG.tile;
      const y = ty * CONFIG.tile;
      if (c === 'H') {
        ctx.fillStyle = '#171008';
        ctx.fillRect(x, y, CONFIG.tile, CONFIG.tile);
        ctx.fillStyle = '#3a2417';
        ctx.fillRect(x + 2, y + 2, CONFIG.tile - 4, CONFIG.tile - 4);
        const spineColours = ['#7a3b2e', '#2e5a7a', '#6b7a2e', '#8a6d2f', '#5a3a6e'];
        for (let s = 0; s < 5; s++) {
          ctx.fillStyle = spineColours[(tx + ty + s) % spineColours.length];
          ctx.fillRect(x + 4 + s * 7, y + 6, 5, 14);
          ctx.fillRect(x + 4 + s * 7, y + 22, 5, 12);
        }
      } else if (c === 'T') {
        ctx.fillStyle = '#4a3018';
        ctx.fillRect(x + 3, y + 3, CONFIG.tile - 6, CONFIG.tile - 6);
        ctx.fillStyle = '#6b4a26';
        ctx.fillRect(x + 5, y + 5, CONFIG.tile - 10, CONFIG.tile - 10);
        ctx.fillStyle = '#e8d9a8';
        ctx.fillRect(x + 12, y + 14, 16, 12);
      } else if (c === '#') {
        ctx.fillStyle = '#0f0b07';
        ctx.fillRect(x, y, CONFIG.tile, CONFIG.tile);
        ctx.fillStyle = '#241a10';
        ctx.fillRect(x + 2, y + 2, CONFIG.tile - 4, CONFIG.tile - 4);
      }
    }
  }
}

// A warden: dark robe, glowing lantern, and a ? or ! marker above.
function drawWarden(ctx, warden) {
  const style = coneStyleForState(warden.state);
  ctx.fillStyle = '#1a1626';
  ctx.strokeStyle = '#3a3252';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(warden.x, warden.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Robe folds.
  ctx.strokeStyle = '#4a4066';
  ctx.beginPath();
  ctx.moveTo(warden.x - 8, warden.y + 4);
  ctx.lineTo(warden.x + 8, warden.y + 4);
  ctx.moveTo(warden.x - 6, warden.y + 9);
  ctx.lineTo(warden.x + 6, warden.y + 9);
  ctx.stroke();
  // Hood and face shadow.
  ctx.fillStyle = '#0d0a14';
  ctx.beginPath();
  ctx.arc(warden.x, warden.y - 3, 8, 0, Math.PI * 2);
  ctx.fill();
  // Lantern glow in front.
  const lx = warden.x + Math.cos(warden.facing) * 16;
  const ly = warden.y + Math.sin(warden.facing) * 16;
  const grad = ctx.createRadialGradient(lx, ly, 1, lx, ly, 16);
  grad.addColorStop(0, 'rgba(255, 210, 120, 0.9)');
  grad.addColorStop(1, 'rgba(255, 210, 120, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(lx, ly, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd878';
  ctx.fillRect(lx - 3, ly - 4, 6, 8);
  // State marker.
  if (style.mark) {
    ctx.fillStyle = warden.state === 'chase' ? '#ff5a50' : '#ffaa3c';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(style.mark, warden.x, warden.y - 22);
    ctx.fillText(style.mark, warden.x, warden.y - 22);
  }
}

// Wren, the thief: a small cream-hooded figure with a teal cloak edge.
function drawPlayer(ctx, player, time) {
  const bob = player.moving ? Math.sin(time * 12) * 1.5 : 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  // A soft green ring shows when the ferns are hiding the player.
  if (player.hiddenInFern) {
    ctx.strokeStyle = 'rgba(120, 220, 130, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.strokeStyle = '#2f8f83';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Hood point and face.
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.moveTo(-9, -6);
  ctx.lineTo(0, -17);
  ctx.lineTo(9, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1c2430';
  ctx.beginPath();
  ctx.arc(0, -2, 6, 0, Math.PI * 2);
  ctx.fill();
  // Teal cloak edge.
  ctx.strokeStyle = '#2f8f83';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 13, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

// A thrown coin, glinting where it landed.
function drawCoins(ctx, time) {
  for (const coin of Game.coins) {
    const alpha = Math.max(0, 1 - coin.t / 2.5);
    ctx.fillStyle = 'rgba(255, 220, 120, ' + alpha + ')';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 6 + Math.sin(time * 6) * 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 80, 0, ' + alpha + ')';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('¢', coin.x, coin.y + 3);
  }
}

// The vision cones, drawn under the wardens and over the floor.
function drawCones(ctx, level) {
  for (const warden of Game.wardens) {
    const style = coneStyleForState(warden.state);
    const poly = buildVisionConePolygon(level, warden);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// Update the DOM HUD bar; only touches the DOM when a value changed.
function updateHUD() {
  const hud = document.getElementById('hud');
  if (!hud || !Game.level) return;
  const set = function (id, value) {
    if (hudCache[id] !== value) {
      hudCache[id] = value;
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
  };
  const eye = document.getElementById('hud-eye-fill');
  const pct = Math.round(Game.suspicion);
  if (hudCache.eye !== pct) {
    hudCache.eye = pct;
    if (eye) {
      eye.style.width = pct + '%';
      eye.style.background = pct >= 100 ? '#d63031' : pct >= 70 ? '#e67e22' : '#f5c65a';
    }
  }
  set('hud-level', LEVELS[Game.levelIndex].name);
  set('hud-pages', Game.pagesGot + ' / ' + Game.level.pages.length + ' pages');
  set('hud-coins', 'Coins: ' + Game.coinsLeft);
  set('hud-time', formatTime(Game.levelTime));
  set('hud-goal', LEVELS[Game.levelIndex].goal);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// Dark overlay panel for the screens.
function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 8, 14, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawCenteredText(ctx, text, y, font, colour) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = colour;
  ctx.fillText(text, CONFIG.viewWidth / 2, y);
}

function drawTitleScreen(ctx) {
  drawPanel(ctx, 290, 120, 700, 480);
  drawCenteredText(ctx, 'THE GLOAMING ARCHIVE', 200, 'bold 52px Georgia, serif', '#f3e6c2');
  drawCenteredText(ctx, 'A stealth game in a candlelit archive', 240, 'italic 20px Georgia, serif', '#c9a86a');
  drawCenteredText(ctx, 'Wren slips in by night to steal the pages of the', 300, '19px Georgia, serif', '#d8cdb2');
  drawCenteredText(ctx, 'Starless Atlas — and slip out again, unseen.', 328, '19px Georgia, serif', '#d8cdb2');
  drawCenteredText(ctx, 'WASD / Arrows — move        Shift — sneak (silent)', 390, '17px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Click a floor tile — throw a coin (3 per level)', 420, '17px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Esc — pause        M — mute        R — restart level', 450, '17px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Hide in shadows and ferns. Fill the eye meter and', 492, '16px sans-serif', '#9fb2d8');
  drawCenteredText(ctx, 'every warden will hunt you — break sight for 5 seconds', 516, '16px sans-serif', '#9fb2d8');
  drawCenteredText(ctx, 'and the alarm fades.', 540, '16px sans-serif', '#9fb2d8');
  drawCenteredText(ctx, '— press any key or click to begin —', 580, 'bold 18px sans-serif', '#ffd878');
}

function drawIntroScreen(ctx) {
  const level = LEVELS[Game.levelIndex];
  drawPanel(ctx, 340, 250, 600, 220);
  drawCenteredText(ctx, 'Level ' + (Game.levelIndex + 1) + ' — ' + level.name, 310, 'bold 34px Georgia, serif', '#f3e6c2');
  drawCenteredText(ctx, level.goal, 360, '19px Georgia, serif', '#d8cdb2');
  drawCenteredText(ctx, level.pages.length + ' page' + (level.pages.length > 1 ? 's' : '') + ' to find  •  ' + Game.wardens.length + ' wardens on patrol', 400, '17px sans-serif', '#c9a86a');
  drawCenteredText(ctx, '— press any key or click to slip in —', 445, '16px sans-serif', '#ffd878');
}

function drawPausedScreen(ctx) {
  drawPanel(ctx, 440, 280, 400, 160);
  drawCenteredText(ctx, 'PAUSED', 340, 'bold 36px Georgia, serif', '#f3e6c2');
  drawCenteredText(ctx, 'Esc — resume        R — restart level', 385, '17px sans-serif', '#d8cdb2');
  drawCenteredText(ctx, 'M — mute', 412, '17px sans-serif', '#d8cdb2');
}

function drawCaughtScreen(ctx) {
  drawPanel(ctx, 340, 240, 600, 240);
  drawCenteredText(ctx, 'CAUGHT', 310, 'bold 48px Georgia, serif', '#ff6a5e');
  drawCenteredText(ctx, 'A warden laid a hand on Wren in the lamplight.', 360, '19px Georgia, serif', '#d8cdb2');
  drawCenteredText(ctx, 'The level begins again — the patrols have not forgotten.', 390, '17px sans-serif', '#c9a86a');
  drawCenteredText(ctx, '— press any key or click to try again —', 445, '17px sans-serif', '#ffd878');
}

function drawLevelClearScreen(ctx) {
  const level = LEVELS[Game.levelIndex];
  const timeBonus = Math.max(0, Math.round((level.parTime - Game.levelTime) * CONFIG.timeBonusPerSecond));
  drawPanel(ctx, 340, 190, 600, 340);
  drawCenteredText(ctx, 'LEVEL CLEAR', 255, 'bold 44px Georgia, serif', '#7dffab');
  drawCenteredText(ctx, level.name, 295, 'italic 22px Georgia, serif', '#c9a86a');
  drawCenteredText(ctx, 'Time  ' + formatTime(Game.levelTime) + '   •   Pages  ' + Game.pagesGot + '/' + level.pages.length, 345, '19px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Near misses  ' + Game.nearMisses + '   •   Alarms  ' + Game.alarmsThisLevel, 380, '19px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Time bonus  +' + timeBonus + '   •   Ghost bonus  +' + (Game.ghost ? CONFIG.ghostBonus : 0), 415, '19px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Level score  ' + Game.levelScore + '      Rank  ' + Game.levelRank, 455, 'bold 21px sans-serif', '#ffd878');
  drawCenteredText(ctx, Game.levelIndex + 1 < LEVELS.length ? '— press any key for the next room —' : '— press any key for the ending —', 505, '17px sans-serif', '#ffd878');
}

function drawGameOverScreen(ctx) {
  drawPanel(ctx, 290, 150, 700, 420);
  drawCenteredText(ctx, 'THE ATLAS IS WHOLE', 225, 'bold 46px Georgia, serif', '#f3e6c2');
  drawCenteredText(ctx, 'Wren slips out into the night with every page.', 275, '20px Georgia, serif', '#d8cdb2');
  drawCenteredText(ctx, 'Total score  ' + Game.totalScore, 330, 'bold 24px sans-serif', '#ffd878');
  drawCenteredText(ctx, 'Times caught in full alarm  ' + Game.totalAlarms, 370, '19px sans-serif', '#e8e0cc');
  drawCenteredText(ctx, 'Near misses  ' + Game.totalNearMisses, 400, '19px sans-serif', '#e8e0cc');
  const rank = Game.totalAlarms === 0 ? 'GHOST' : Game.totalAlarms <= 2 ? 'SHADOW' : 'SEEN';
  drawCenteredText(ctx, 'Final rank  ' + rank, 450, 'bold 30px Georgia, serif', rank === 'GHOST' ? '#7dffab' : '#ffd878');
  drawCenteredText(ctx, rank === 'GHOST' ? 'No warden ever raised the alarm. A perfect shadow.' : rank === 'SHADOW' ? 'Seen once or twice — but never held.' : 'Seen often, yet the pages are yours.', 495, '17px Georgia, serif', '#c9a86a');
  drawCenteredText(ctx, '— press any key to return to the title —', 540, '16px sans-serif', '#ffd878');
}

// Rank for a finished level: S needs ghost + fast, then A/B/C.
function rankForLevel() {
  const level = LEVELS[Game.levelIndex];
  if (Game.ghost && Game.levelTime < level.parTime) return 'S';
  if (Game.ghost) return 'A';
  if (Game.alarmsThisLevel <= 1) return 'B';
  return 'C';
}

// Draw the whole world (no screen overlays).
function drawWorld(ctx, time) {
  const level = Game.level;
  drawFloor(ctx, level);
  drawShadowZones(ctx, level);
  drawLanternPools(ctx, level, time);
  drawFerns(ctx, level);
  for (const page of level.pages) {
    if (!page.taken) drawPage(ctx, page, time);
  }
  for (const ink of level.ink) {
    if (!ink.taken) drawInk(ctx, ink, time);
  }
  drawExit(ctx, level, time);
  drawCones(ctx, level);
  drawShelvesAndTables(ctx, level);
  drawExitLabel(ctx, level);
  drawCoins(ctx, time);
  for (const warden of Game.wardens) drawWarden(ctx, warden);
  if (Game.player) drawPlayer(ctx, Game.player, time);
}

// Small in-canvas suspicion meter (eye icon + thin bar), top-left corner.
// The DOM HUD sits below the canvas, so screenshots would otherwise hide
// the detection system. Only shown while actually playing.
function drawSuspicionMeter(ctx) {
  const pct = Math.max(0, Math.min(100, Game.suspicion || 0));
  const colour = pct >= 100 ? '#d63031' : pct >= 70 ? '#e67e22' : '#f5c65a';
  ctx.save();
  ctx.fillStyle = 'rgba(8, 8, 14, 0.55)';
  ctx.fillRect(8, 8, 168, 26);
  ctx.strokeStyle = 'rgba(201, 168, 106, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(8.5, 8.5, 168, 26);
  // Eye icon.
  ctx.strokeStyle = '#e8e0cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(24, 21, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(24, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  // Bar track + fill, same thresholds as the DOM HUD.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(40, 16, 120, 10);
  ctx.fillStyle = colour;
  ctx.fillRect(40, 16, 120 * pct / 100, 10);
  ctx.restore();
}

// One rendered frame: world plus the overlay for the current state.
function renderFrame(ctx, time) {
  ctx.clearRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  if (Game.level) drawWorld(ctx, time);
  if (Game.state === 'playing') drawSuspicionMeter(ctx);
  if (Game.state === 'title') drawTitleScreen(ctx);
  else if (Game.state === 'intro') drawIntroScreen(ctx);
  else if (Game.state === 'paused') drawPausedScreen(ctx);
  else if (Game.state === 'caught') drawCaughtScreen(ctx);
  else if (Game.state === 'levelclear') drawLevelClearScreen(ctx);
  else if (Game.state === 'gameover') drawGameOverScreen(ctx);
  updateHUD();
}
