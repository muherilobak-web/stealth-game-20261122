// The Gloaming Archive — warden AI: waypoint patrols, suspicion,
// investigation, chase, and calming back down to patrol.

// Build the warden list for a level from its patrol routes.
function createWardens(levelDef) {
  return levelDef.patrols.map(function (route, i) {
    const start = route[0];
    const next = route[1 % route.length];
    const warden = {
      id: i,
      x: tileCenterX(start[0]),
      y: tileCenterY(start[1]),
      waypoints: route,
      wpIndex: 1 % route.length,
      facing: Math.atan2(
        tileCenterY(next[1]) - tileCenterY(start[1]),
        tileCenterX(next[0]) - tileCenterX(start[0]),
      ),
      state: 'patrol', // patrol | suspect | chase
      suspicion: 0, // 0..100; 100 means full alarm
      lastSeen: null, // {x, y} where the player was last spotted
      investigate: null, // {x, y} to walk to and look around
      waitT: 0, // pause at a waypoint, looking around
      lookT: 0, // time spent looking around after arriving
      lookPhase: 0, // sweep angle while looking around
      stepT: 0, // footstep timer
      nearMissCounted: false,
    };
    return warden;
  });
}

// How fast suspicion rises while this warden can see the player.
// Closer is faster; lantern light is faster; shadow and sneaking slower.
// Very close range is spotted almost instantly, even in shadow.
function computeSuspicionRate(level, warden, player) {
  const distTiles = Math.hypot(player.x - warden.x, player.y - warden.y) / CONFIG.tile;
  if (distTiles < CONFIG.closeRange) return 220;
  let rate = (1 - distTiles / CONFIG.coneRange) * 95 + 8;
  if (pointInLanternLight(level, player.x, player.y)) rate *= CONFIG.lightDetectMult;
  if (pointInShadow(level, player.x, player.y)) rate *= CONFIG.shadowDetectMult;
  if (player.sneaking) rate *= CONFIG.sneakDetectMult;
  if (!player.sneaking) rate *= 1.15;
  return rate;
}

// Send a warden to look at a point: walk there, then look around.
function sendWardenToInvestigate(warden, x, y, suspicion) {
  warden.investigate = { x: x, y: y };
  warden.suspicion = Math.max(warden.suspicion, suspicion);
  warden.lookT = 0; // a fresh investigation starts with a fresh look
  if (warden.state === 'patrol') warden.state = 'suspect';
}

// Move a warden toward a pixel target at a speed in tiles per second.
// Returns true when the target is reached.
function moveWardenToward(warden, tx, ty, speedTiles, dt) {
  const dx = tx - warden.x;
  const dy = ty - warden.y;
  const dist = Math.hypot(dx, dy);
  const step = speedTiles * CONFIG.tile * dt;
  if (dist <= step || dist < 1) {
    warden.x = tx;
    warden.y = ty;
    return true;
  }
  warden.x += (dx / dist) * step;
  warden.y += (dy / dist) * step;
  warden.facing = Math.atan2(dy, dx);
  return false;
}

// Play a warden footstep whose volume and left/right balance follow the
// warden's distance and direction from the player.
function updateWardenFootsteps(warden, player, dt, moving) {
  if (!moving) return;
  warden.stepT -= dt;
  if (warden.stepT > 0) return;
  warden.stepT = 0.55;
  const distTiles = Math.hypot(player.x - warden.x, player.y - warden.y) / CONFIG.tile;
  const volume = Math.max(0, 1 - distTiles / 12);
  if (volume <= 0.02) return;
  const pan = Math.max(-1, Math.min(1, (warden.x - player.x) / (6 * CONFIG.tile)));
  AudioSys.guardStep(pan, volume);
}

// One frame of warden behaviour for the whole level.
function updateWardens(level, player, dt) {
  let anySeesPlayer = false;
  for (const warden of Game.wardens) {
    const seesPlayer = playerInsideVisionCone(level, warden, player);
    if (seesPlayer) anySeesPlayer = true;

    if (seesPlayer) {
      warden.lastSeen = { x: player.x, y: player.y };
      warden.suspicion += computeSuspicionRate(level, warden, player) * dt;
      if (warden.suspicion >= CONFIG.nearMissThreshold && !warden.nearMissCounted) {
        warden.nearMissCounted = true;
        Game.nearMisses += 1;
      }
      if (warden.suspicion >= 100) {
        warden.suspicion = 100;
        if (warden.state !== 'chase') {
          warden.state = 'chase';
          Game.alarmsThisLevel += 1;
          Game.ghost = false;
          AudioSys.alarmSting();
        }
      } else if (warden.suspicion >= CONFIG.suspectThreshold && warden.state === 'patrol') {
        warden.state = 'suspect';
        warden.investigate = { x: player.x, y: player.y };
      }
    } else {
      warden.suspicion = Math.max(0, warden.suspicion - CONFIG.suspicionDecay * dt);
      if (warden.suspicion < CONFIG.nearMissThreshold) warden.nearMissCounted = false;
    }

    let moving = false;
    if (warden.state === 'patrol') {
      if (warden.waitT > 0) {
        warden.waitT -= dt;
        warden.lookPhase += dt * 1.6;
        warden.facing += Math.sin(warden.lookPhase) * dt * 1.1;
      } else {
        const target = warden.waypoints[warden.wpIndex];
        const reached = moveWardenToward(
          warden,
          tileCenterX(target[0]),
          tileCenterY(target[1]),
          CONFIG.patrolSpeed,
          dt,
        );
        moving = !reached;
        if (reached) {
          warden.wpIndex = (warden.wpIndex + 1) % warden.waypoints.length;
          warden.waitT = 1.4;
          warden.lookPhase = 0;
        }
      }
    } else if (warden.state === 'suspect') {
      const target = warden.investigate || warden.lastSeen;
      if (target) {
        if (warden.lookT > 0) {
          warden.lookT -= dt;
          warden.lookPhase += dt * 1.8;
          warden.facing += Math.sin(warden.lookPhase) * dt * 1.4;
          if (warden.lookT <= 0) {
            warden.state = 'patrol';
            warden.investigate = null;
          }
        } else {
          const reached = moveWardenToward(
            warden,
            target.x,
            target.y,
            CONFIG.suspectSpeed,
            dt,
          );
          moving = !reached;
          if (reached) {
            warden.lookT = 2.5;
            warden.lookPhase = 0;
          }
        }
      } else {
        warden.state = 'patrol';
      }
    } else if (warden.state === 'chase') {
      const target = warden.lastSeen;
      if (target) {
        if (warden.lookT > 0) {
          warden.lookT -= dt;
          warden.lookPhase += dt * 2.2;
          warden.facing += Math.sin(warden.lookPhase) * dt * 1.6;
          if (warden.lookT <= 0 && !Game.alarm) {
            warden.state = 'suspect';
            warden.suspicion = 60;
            warden.investigate = target;
          }
        } else {
          const reached = moveWardenToward(
            warden,
            target.x,
            target.y,
            CONFIG.chaseSpeed,
            dt,
          );
          moving = !reached;
          if (reached) {
            warden.lookT = 1.5;
            warden.lookPhase = 0;
          }
        }
      }
    }

    updateWardenFootsteps(warden, player, dt, moving);

    // Caught: a chasing warden touches the player while the alarm is up.
    if (Game.alarm && warden.state === 'chase') {
      const touch = Math.hypot(player.x - warden.x, player.y - warden.y);
      if (touch < 0.55 * CONFIG.tile) {
        onPlayerCaught();
        return;
      }
    }
  }

  // The alarm holds while any warden is chasing and someone still sees
  // the player; once unseen for a while, it fades back to suspicion.
  const anyChasing = Game.wardens.some(function (w) {
    return w.state === 'chase';
  });
  Game.alarm = anyChasing;
  if (Game.alarm) {
    if (anySeesPlayer) {
      Game.alarmTimer = CONFIG.alarmCalmTime;
    } else {
      Game.alarmTimer -= dt;
      if (Game.alarmTimer <= 0) {
        for (const warden of Game.wardens) {
          if (warden.state === 'chase') {
            warden.state = 'suspect';
            warden.suspicion = 60;
            warden.investigate = warden.lastSeen;
            warden.lookT = 0;
          }
        }
        Game.alarm = false;
      }
    }
  }

  // Global suspicion meter is the most suspicious warden.
  Game.suspicion = 0;
  for (const warden of Game.wardens) {
    Game.suspicion = Math.max(Game.suspicion, warden.suspicion);
  }
}
