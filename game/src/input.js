// The Gloaming Archive — keyboard and mouse input: movement keys,
// sneak, coin throws, pause, mute, restart, and screen advance.

// Live set of keys currently held down, keyed by lowercase key name.
const InputState = {
  keys: {},
  mouseTile: null,
};

// Movement keys, sneak, and the keys that advance screens.
function isAdvanceKey(key) {
  return (
    key === 'enter' ||
    key === ' ' ||
    key === 'arrowup' ||
    key === 'arrowdown' ||
    key === 'arrowleft' ||
    key === 'arrowright' ||
    key === 'w' ||
    key === 'a' ||
    key === 's' ||
    key === 'd'
  );
}

function setupInput(canvas) {
  window.addEventListener('keydown', function (e) {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(key) >= 0) {
      e.preventDefault();
    }
    if (e.repeat) return;
    InputState.keys[key] = true;
    AudioSys.ensure();

    if (key === 'm') {
      Game.muted = !Game.muted;
      AudioSys.setMuted(Game.muted);
      return;
    }
    if (key === 'r' && (Game.state === 'playing' || Game.state === 'paused' || Game.state === 'caught')) {
      loadLevel(Game.levelIndex);
      return;
    }
    if (key === 'escape') {
      if (Game.state === 'playing') {
        Game.state = 'paused';
      } else if (Game.state === 'paused') {
        Game.state = 'playing';
      }
      return;
    }
    if (isAdvanceKey(key)) {
      advanceScreen();
    }
  });

  window.addEventListener('keyup', function (e) {
    InputState.keys[e.key.toLowerCase()] = false;
  });

  window.addEventListener('blur', function () {
    InputState.keys = {};
  });

  // Hiding the tab pauses a live game so the patrols do not run on
  // while the player cannot see them.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && Game.state === 'playing') {
      Game.state = 'paused';
    }
  });

  canvas.addEventListener('mousedown', function (e) {
    AudioSys.ensure();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const tx = Math.floor(px / CONFIG.tile);
    const ty = Math.floor(py / CONFIG.tile);
    InputState.mouseTile = { x: tx, y: ty };

    if (Game.state === 'playing') {
      if (Game.level && Game.player) {
        throwDistractionCoin(Game.level, Game.player, tx, ty);
      }
    } else {
      advanceScreen();
    }
  });
}

// Move forward from whatever screen is showing: title starts the game,
// intro begins the level, caught restarts it, level-clear goes on.
function advanceScreen() {
  if (Game.state === 'title') {
    loadLevel(0);
  } else if (Game.state === 'intro') {
    Game.state = 'playing';
  } else if (Game.state === 'caught') {
    loadLevel(Game.levelIndex);
  } else if (Game.state === 'levelclear') {
    if (Game.levelIndex + 1 < LEVELS.length) {
      loadLevel(Game.levelIndex + 1);
    } else {
      Game.state = 'gameover';
    }
  } else if (Game.state === 'gameover') {
    Game.state = 'title';
    Game.totalScore = 0;
    Game.totalAlarms = 0;
    Game.totalNearMisses = 0;
    setupTitleBackdrop();
  }
}
