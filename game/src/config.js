// The Gloaming Archive — every tuning number lives here, in one place,
// so the feel of the game (speeds, sight, suspicion) can be balanced
// without hunting through the other files.
const CONFIG = {
  tile: 40, // pixels per tile
  cols: 32,
  rows: 18,
  viewWidth: 1280,
  viewHeight: 720,

  // Movement speeds, in tiles per second.
  walkSpeed: 3.2,
  sneakSpeed: 1.7,
  patrolSpeed: 1.6,
  suspectSpeed: 2.2,
  chaseSpeed: 3.0,

  // Vision cone.
  coneRange: 6.5, // tiles
  coneHalfAngle: 32, // degrees
  closeRange: 1.2, // tiles — spotting is near-instant this close

  // Sound and distraction.
  hearRadius: 2.0, // tiles — loud footsteps are heard this far
  coinRange: 7.0, // tiles — farthest a coin can be thrown
  coinHearRadius: 8.0, // tiles — wardens this far away hear the coin land
  coinsPerLevel: 3,

  // Suspicion and alarm.
  suspicionDecay: 25, // points per second while unseen
  alarmCalmTime: 5, // seconds unseen before the alarm fades
  suspectThreshold: 35, // suspicion above this makes a warden investigate
  nearMissThreshold: 70, // crossing this counts as a near miss

  // Light and shadow.
  lanternRadius: 1.8, // tiles
  lightDetectMult: 1.8, // standing in lantern light: spotted faster
  shadowDetectMult: 0.45, // standing in shadow: spotted slower
  sneakDetectMult: 0.6, // sneaking: spotted slower

  // Scoring.
  pageScore: 150,
  inkScore: 50,
  ghostBonus: 300, // finishing a level with no full alarm
  coinBonus: 25, // per unspent coin
  timeBonusPerSecond: 5,

  // Player collision radius, in pixels.
  playerRadius: 13,
};
