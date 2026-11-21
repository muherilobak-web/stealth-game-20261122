// The Gloaming Archive — the thief Wren: movement, sneaking, footsteps,
// hiding in ferns, pickups, and the coin distraction throw.

// Build the player at a level's start tile.
function createPlayer(levelDef) {
  return {
    x: tileCenterX(levelDef.playerStart[0]),
    y: tileCenterY(levelDef.playerStart[1]),
    radius: CONFIG.playerRadius,
    sneaking: false,
    moving: false,
    still: true,
    hiddenInFern: false,
    stepT: 0,
    facing: 0,
  };
}

// True when a circle at (x, y) with the player's radius would overlap a
// tile that blocks movement.
function circleHitsSolid(level, x, y, radius) {
  const minTx = Math.floor((x - radius) / CONFIG.tile);
  const maxTx = Math.floor((x + radius) / CONFIG.tile);
  const minTy = Math.floor((y - radius) / CONFIG.tile);
  const maxTy = Math.floor((y + radius) / CONFIG.tile);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!tileBlocksMovement(level, tx, ty)) continue;
      const tileLeft = tx * CONFIG.tile;
      const tileTop = ty * CONFIG.tile;
      const closestX = Math.max(tileLeft, Math.min(x, tileLeft + CONFIG.tile));
      const closestY = Math.max(tileTop, Math.min(y, tileTop + CONFIG.tile));
      if (Math.hypot(x - closestX, y - closestY) < radius) return true;
    }
  }
  return false;
}

// One frame of player movement from the current keyboard state.
function updatePlayer(level, player, dt) {
  const keys = InputState.keys;
  let dx = 0;
  let dy = 0;
  if (keys['arrowleft'] || keys['a']) dx -= 1;
  if (keys['arrowright'] || keys['d']) dx += 1;
  if (keys['arrowup'] || keys['w']) dy -= 1;
  if (keys['arrowdown'] || keys['s']) dy += 1;

  player.sneaking = !!keys['shift'];
  player.moving = dx !== 0 || dy !== 0;
  player.still = !player.moving;

  if (player.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.facing = Math.atan2(dy, dx);
    const speed = (player.sneaking ? CONFIG.sneakSpeed : CONFIG.walkSpeed) * CONFIG.tile;
    const stepX = dx * speed * dt;
    const stepY = dy * speed * dt;
    // Move one axis at a time so the player slides along walls.
    if (!circleHitsSolid(level, player.x + stepX, player.y, player.radius)) {
      player.x += stepX;
    }
    if (!circleHitsSolid(level, player.x, player.y + stepY, player.radius)) {
      player.y += stepY;
    }
    // Loud footsteps while walking; sneaking is silent. Wardens close
    // enough to hear a step turn to look at where it came from.
    if (!player.sneaking) {
      player.stepT -= dt;
      if (player.stepT <= 0) {
        player.stepT = 0.34;
        AudioSys.playerStep();
        for (const warden of Game.wardens) {
          const distTiles =
            Math.hypot(player.x - warden.x, player.y - warden.y) / CONFIG.tile;
          if (distTiles <= CONFIG.hearRadius && warden.state !== 'chase') {
            sendWardenToInvestigate(warden, player.x, player.y, 40);
          }
        }
      }
    }
  }

  // Keep the player inside the arena even if a step ever overshoots.
  player.x = Math.max(CONFIG.tile, Math.min(CONFIG.viewWidth - CONFIG.tile, player.x));
  player.y = Math.max(CONFIG.tile, Math.min(CONFIG.viewHeight - CONFIG.tile, player.y));

  // Sneaking and still inside a fern: invisible to every warden.
  player.hiddenInFern =
    player.sneaking && player.still && pointInFern(level, player.x, player.y);

  collectPickups(level, player);
  checkExitReached(level, player);
}

// Walk over a relic page or an ink pot to pick it up.
function collectPickups(level, player) {
  for (const page of level.pages) {
    if (page.taken) continue;
    const px = tileCenterX(page.x);
    const py = tileCenterY(page.y);
    if (Math.hypot(player.x - px, player.y - py) < 0.6 * CONFIG.tile) {
      page.taken = true;
      Game.pagesGot += 1;
      Game.score += CONFIG.pageScore;
      AudioSys.pagePickup();
    }
  }
  for (const ink of level.ink) {
    if (ink.taken) continue;
    const px = tileCenterX(ink.x);
    const py = tileCenterY(ink.y);
    if (Math.hypot(player.x - px, player.y - py) < 0.6 * CONFIG.tile) {
      ink.taken = true;
      Game.score += CONFIG.inkScore;
      AudioSys.pagePickup();
    }
  }
}

// The green exit only opens once every page of the level is held.
function exitIsOpen(level) {
  return Game.pagesGot >= level.pages.length;
}

// Stepping onto an open exit finishes the level.
function checkExitReached(level, player) {
  if (!exitIsOpen(level)) return;
  const ex = tileCenterX(level.exit[0]);
  const ey = tileCenterY(level.exit[1]);
  if (Math.hypot(player.x - ex, player.y - ey) < 0.7 * CONFIG.tile) {
    onLevelComplete();
  }
}

// Throw a distraction coin at a floor tile: the nearest warden that can
// hear it walks over to look. Returns false when the throw is not legal.
function throwDistractionCoin(level, player, tx, ty) {
  if (Game.coinsLeft <= 0) return false;
  const distTiles =
    Math.hypot(tileCenterX(tx) - player.x, tileCenterY(ty) - player.y) / CONFIG.tile;
  if (distTiles > CONFIG.coinRange) return false;
  if (tileBlocksMovement(level, tx, ty)) return false;
  Game.coinsLeft -= 1;
  Game.coins.push({
    x: tileCenterX(tx),
    y: tileCenterY(ty),
    t: 0,
  });
  AudioSys.coinThrow();
  let nearest = null;
  let nearestDist = Infinity;
  for (const warden of Game.wardens) {
    const d = Math.hypot(warden.x - tileCenterX(tx), warden.y - tileCenterY(ty));
    if (d < nearestDist) {
      nearestDist = d;
      nearest = warden;
    }
  }
  if (nearest && nearestDist <= CONFIG.coinHearRadius * CONFIG.tile) {
    sendWardenToInvestigate(nearest, tileCenterX(tx), tileCenterY(ty), 50);
  }
  return true;
}
