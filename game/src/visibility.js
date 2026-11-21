// The Gloaming Archive — line-of-sight geometry: tile lookups, raycasts
// against walls and tall shelves, and the warden vision-cone test.

// Character stored in the level grid at a tile, or '#' outside the arena.
function tileCharAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= CONFIG.cols || ty >= CONFIG.rows) return '#';
  return level.grid[ty][tx];
}

// True when the tile blocks movement (wall, tall shelf, low table).
function tileBlocksMovement(level, tx, ty) {
  const c = tileCharAt(level, tx, ty);
  return c === '#' || c === 'H' || c === 'T';
}

// True when the tile blocks sight (wall, tall shelf). Low tables do not.
function tileBlocksVision(level, tx, ty) {
  const c = tileCharAt(level, tx, ty);
  return c === '#' || c === 'H';
}

// Centre of a tile in pixels.
function tileCenterX(tx) {
  return (tx + 0.5) * CONFIG.tile;
}
function tileCenterY(ty) {
  return (ty + 0.5) * CONFIG.tile;
}

// True when the straight segment between two pixel points crosses no
// vision-blocking tile. Sampled in small steps so thin shelves are not
// skipped over.
function hasLineOfSight(level, x1, y1, x2, y2) {
  // Same tile: nothing can stand between the two points.
  if (
    Math.floor(x1 / CONFIG.tile) === Math.floor(x2 / CONFIG.tile) &&
    Math.floor(y1 / CONFIG.tile) === Math.floor(y2 / CONFIG.tile)
  ) {
    return true;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (tileBlocksVision(level, Math.floor(px / CONFIG.tile), Math.floor(py / CONFIG.tile))) {
      return false;
    }
  }
  return true;
}

// Smallest absolute difference between two angles, in radians.
function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// True when the player stands inside a warden's vision cone and the
// line of sight is clear. Hiding in ferns while sneaking and still
// makes the player invisible even inside a cone.
function playerInsideVisionCone(level, warden, player) {
  if (player.hiddenInFern) return false;
  const dx = player.x - warden.x;
  const dy = player.y - warden.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CONFIG.coneRange * CONFIG.tile) return false;
  const angleToPlayer = Math.atan2(dy, dx);
  const half = (CONFIG.coneHalfAngle * Math.PI) / 180;
  if (angleDifference(angleToPlayer, warden.facing) > half) return false;
  return hasLineOfSight(level, warden.x, warden.y, player.x, player.y);
}

// Build the visible cone polygon for drawing: cast rays across the
// cone, each ray marching forward until it hits a vision-blocking tile
// or reaches full range. Returns pixel points from the warden outwards.
function buildVisionConePolygon(level, warden) {
  const points = [{ x: warden.x, y: warden.y }];
  const rays = 26;
  const half = (CONFIG.coneHalfAngle * Math.PI) / 180;
  const maxRange = CONFIG.coneRange * CONFIG.tile;
  for (let i = 0; i <= rays; i++) {
    const angle = warden.facing - half + (2 * half * i) / rays;
    const stepX = Math.cos(angle);
    const stepY = Math.sin(angle);
    let reach = maxRange;
    for (let d = 8; d <= maxRange; d += 8) {
      const px = warden.x + stepX * d;
      const py = warden.y + stepY * d;
      if (tileBlocksVision(level, Math.floor(px / CONFIG.tile), Math.floor(py / CONFIG.tile))) {
        reach = d;
        break;
      }
    }
    points.push({ x: warden.x + stepX * reach, y: warden.y + stepY * reach });
  }
  return points;
}

// True when a pixel point lies inside any shadow zone of the level.
function pointInShadow(level, x, y) {
  const tx = Math.floor(x / CONFIG.tile);
  const ty = Math.floor(y / CONFIG.tile);
  for (const s of level.shadows) {
    if (tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h) return true;
  }
  return false;
}

// True when a pixel point lies inside a lantern light pool.
function pointInLanternLight(level, x, y) {
  const r = CONFIG.lanternRadius * CONFIG.tile;
  for (const lantern of level.lanterns) {
    const lx = tileCenterX(lantern[0]);
    const ly = tileCenterY(lantern[1]);
    if (Math.hypot(x - lx, y - ly) <= r) return true;
  }
  return false;
}

// True when a pixel point lies on a fern tile.
function pointInFern(level, x, y) {
  const tx = Math.floor(x / CONFIG.tile);
  const ty = Math.floor(y / CONFIG.tile);
  for (const f of level.ferns) {
    if (f[0] === tx && f[1] === ty) return true;
  }
  return false;
}
