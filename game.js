const canvas = document.querySelector('#game')
const ctx = canvas.getContext('2d')

const scoreEl = document.querySelector('#score')
const creditsEl = document.querySelector('#credits')
const waveEl = document.querySelector('#wave')
const livesEl = document.querySelector('#lives')
const shieldEl = document.querySelector('#shield')
const weaponEl = document.querySelector('#weapon')
const comboEl = document.querySelector('#combo')
const startOverlay = document.querySelector('#startOverlay')
const waveOverlay = document.querySelector('#waveOverlay')
const gameOverOverlay = document.querySelector('#gameOverOverlay')
const waveTitle = document.querySelector('#waveTitle')
const waveText = document.querySelector('#waveText')
const resultTitle = document.querySelector('#resultTitle')
const resultText = document.querySelector('#resultText')
const startButton = document.querySelector('#startButton')
const restartButton = document.querySelector('#restartButton')
const nextWaveButton = document.querySelector('#nextWaveButton')
const pauseButton = document.querySelector('#pauseButton')
const specialButton = document.querySelector('#specialButton')
const oneShotButtons = {
  nuke: document.querySelector('[data-weapon="nuke"]'),
  pulse: document.querySelector('[data-weapon="pulse"]'),
  flame: document.querySelector('[data-weapon="flame"]'),
  laser: document.querySelector('[data-weapon="laser"]'),
  freeze: document.querySelector('[data-weapon="freeze"]'),
}

const world = { width: 960, height: 620 }
const input = { left: false, right: false, fire: false }
const upgradeOrder = ['weapon', 'engine', 'hull', 'shield', 'drone']

const upgradeDefs = {
  weapon: { label: '武器', max: 50, base: 70, step: 36 },
  engine: { label: '引擎', max: 50, base: 60, step: 32 },
  hull: { label: '船體', max: 50, base: 85, step: 40 },
  shield: { label: '護盾', max: 50, base: 80, step: 38 },
  drone: { label: '僚機', max: 50, base: 105, step: 44 },
}

const upgradeEls = {
  weapon: { level: document.querySelector('#weaponLevel'), button: document.querySelector('[data-upgrade="weapon"]') },
  engine: { level: document.querySelector('#engineLevel'), button: document.querySelector('[data-upgrade="engine"]') },
  hull: { level: document.querySelector('#hullLevel'), button: document.querySelector('[data-upgrade="hull"]') },
  shield: { level: document.querySelector('#shieldLevel'), button: document.querySelector('[data-upgrade="shield"]') },
  drone: { level: document.querySelector('#droneLevel'), button: document.querySelector('[data-upgrade="drone"]') },
}

const state = {
  running: false,
  paused: false,
  over: false,
  betweenWaves: false,
  score: 0,
  credits: 0,
  wave: 1,
  lives: 3,
  maxLives: 3,
  shield: 1,
  maxShield: 1,
  lastTime: 0,
  enemyDirection: 1,
  enemyStepDown: 0,
  enemyShotTimer: 0,
  diveTimer: 0,
  powerupTimer: 0,
  droneTimer: 0,
  specialCooldown: 0,
  waveBonus: 0,
  currentSquad: 1,
  squadsTotal: 1,
  flameTimer: 0,
  laserTimer: 0,
  freezeTimer: 0,
  screenShake: 0,
  empCharges: 0,
  combo: 0,
  comboTimer: 0,
  maxCombo: 0,
  stageMod: 'calm',
  meteorTimer: 0,
  screenFlash: 0,
  inventory: {
    nuke: 0,
    pulse: 0,
    flame: 0,
    laser: 0,
    freeze: 0,
  },
}

const upgrades = {
  weapon: 1,
  engine: 1,
  hull: 1,
  shield: 1,
  drone: 0,
}

const player = {
  x: world.width / 2,
  y: world.height - 58,
  width: 54,
  height: 42,
  speed: 430,
  cooldown: 0,
  invincible: 0,
}

const bullets = []
const enemyBullets = []
const enemies = []
const particles = []
const floatTexts = []
const effects = []
const meteors = []
const powerups = []
const stars = []
const progressKey = 'space-bee-shooter-progress-v1'
const stageMods = {
  calm: { label: '標準戰場', color: '#7bd6e8' },
  meteor: { label: '隕石危機', color: '#ff8b67' },
  treasure: { label: '寶箱潮', color: '#f4d35e' },
  ion: { label: '離子風暴', color: '#b987ff' },
  solar: { label: '太陽風', color: '#e85d75' },
}

const audioState = {
  ctx: null,
  master: null,
  last: new Map(),
  unlocked: false,
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function aimVector(fromX, fromY, toX, toY, speed) {
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.hypot(dx, dy) || 1
  return { vx: (dx / length) * speed, vy: (dy / length) * speed }
}

function initAudio() {
  if (!audioState.ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return false
    const ctx = new AudioContext()
    const compressor = ctx.createDynamicsCompressor()
    const master = ctx.createGain()
    compressor.threshold.value = -18
    compressor.knee.value = 16
    compressor.ratio.value = 6
    compressor.attack.value = 0.004
    compressor.release.value = 0.18
    master.gain.value = 0.32
    compressor.connect(master)
    master.connect(ctx.destination)
    audioState.ctx = ctx
    audioState.master = compressor
  }

  if (audioState.ctx.state === 'suspended') audioState.ctx.resume().catch(() => {})
  audioState.unlocked = true
  return true
}

function canPlaySfx(id, gap = 0.035) {
  if (!audioState.ctx || !audioState.unlocked) return false
  const now = performance.now()
  const previous = audioState.last.get(id) || 0
  if (now - previous < gap * 1000) return false
  audioState.last.set(id, now)
  return true
}

function tone(freq, duration, options = {}) {
  const ctx = audioState.ctx
  if (!ctx) return
  const start = ctx.currentTime + (options.delay || 0)
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  const attack = options.attack ?? 0.006
  const release = options.release ?? 0.045
  const volume = options.gain ?? 0.08
  const end = start + duration

  oscillator.type = options.type || 'square'
  oscillator.frequency.setValueAtTime(Math.max(24, freq), start)
  if (options.slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, freq + options.slide), end)
  if (options.detune) oscillator.detune.setValueAtTime(options.detune, start)

  filter.type = options.filterType || 'lowpass'
  filter.frequency.setValueAtTime(options.filter || 4200, start)
  filter.Q.setValueAtTime(options.q || 1, start)

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, end + release)

  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(audioState.master)
  oscillator.start(start)
  oscillator.stop(end + release + 0.02)
}

function noise(duration, options = {}) {
  const ctx = audioState.ctx
  if (!ctx) return
  const start = ctx.currentTime + (options.delay || 0)
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) data[index] = rand(-1, 1)

  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = options.filterType || 'bandpass'
  filter.frequency.setValueAtTime(options.filter || 1200, start)
  filter.Q.setValueAtTime(options.q || 4, start)
  gain.gain.setValueAtTime(options.gain ?? 0.06, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.buffer = buffer
  source.connect(filter)
  filter.connect(gain)
  gain.connect(audioState.master)
  source.start(start)
  source.stop(start + duration + 0.02)
}

function arpeggio(notes, step = 0.035, options = {}) {
  notes.forEach((freq, index) => tone(freq, options.duration || 0.07, { ...options, delay: (options.delay || 0) + index * step }))
}

function enemyDeathSound(type) {
  playSfx(isBossType(type) ? 'bossDeath' : 'enemyDeath', { type })
}

function playSfx(id, detail = {}) {
  const gaps = {
    fire: 0.045,
    enemyFire: 0.09,
    bulletHit: 0.025,
    move: 0.14,
    enemyDeath: 0,
    bossDeath: 0,
    meteorHit: 0.08,
  }
  if (!canPlaySfx(id, gaps[id] ?? 0.035)) return

  if (id === 'ui') tone(880, 0.045, { type: 'square', gain: 0.035, filter: 2600, slide: 220 })
  if (id === 'start') arpeggio([220, 440, 660, 880], 0.045, { type: 'sawtooth', gain: 0.065, filter: 3200, duration: 0.09 })
  if (id === 'nextWave') arpeggio([330, 494, 740], 0.05, { type: 'triangle', gain: 0.055, filter: 3800, duration: 0.11 })
  if (id === 'waveClear') arpeggio([392, 523, 784, 1046], 0.07, { type: 'square', gain: 0.075, filter: 4200, duration: 0.12 })
  if (id === 'pause') tone(detail.paused ? 220 : 440, 0.08, { type: 'triangle', gain: 0.05, slide: detail.paused ? -80 : 160 })
  if (id === 'move') tone(150, 0.07, { type: 'sawtooth', gain: 0.035, filter: 900, slide: 42 })
  if (id === 'fire') {
    tone(760 + upgrades.weapon * 8, 0.045, { type: 'square', gain: 0.035, filter: 3600, slide: 480 })
    tone(190, 0.035, { type: 'triangle', gain: 0.02, filter: 900, delay: 0.012 })
  }
  if (id === 'enemyFire') tone(210 + state.wave * 4, 0.06, { type: 'sawtooth', gain: 0.028, filter: 1400, slide: -70 })
  if (id === 'bulletHit') tone(320, 0.035, { type: 'triangle', gain: 0.024, filter: 1800, slide: -130 })
  if (id === 'enemyDeath') {
    const base = { scout: 360, bee: 440, guard: 280, sniper: 520, bomber: 220, tank: 170 }[detail.type] || 300
    tone(base, 0.09, { type: 'square', gain: 0.05, filter: 1800, slide: -base * 0.42 })
    noise(0.08, { gain: 0.026, filter: base * 4, q: 5 })
  }
  if (id === 'bossSpawn') {
    tone(86, 0.4, { type: 'sawtooth', gain: 0.06, filter: 700, slide: 32 })
    arpeggio([172, 129, 96], 0.09, { type: 'square', gain: 0.045, filter: 1200, duration: 0.12 })
  }
  if (id === 'bossDeath') {
    tone(110, 0.55, { type: 'sawtooth', gain: 0.095, filter: 800, slide: -64 })
    noise(0.42, { gain: 0.09, filter: 620, q: 1.8 })
    arpeggio([880, 660, 440, 220], 0.06, { type: 'square', gain: 0.06, filter: 2600, duration: 0.11 })
  }
  if (id === 'pickup') {
    const base = { life: 620, shield: 520, credits: 740, emp: 410, nuke: 180, pulse: 500, flame: 260, laser: 900, freeze: 680 }[detail.type] || 540
    arpeggio([base, base * 1.25], 0.04, { type: 'triangle', gain: 0.052, filter: 3600, duration: 0.09 })
  }
  if (id === 'upgrade') arpeggio([330, 495, 660, 990], 0.045, { type: 'sawtooth', gain: 0.065, filter: 4500, duration: 0.095 })
  if (id === 'shieldHit') {
    tone(540, 0.12, { type: 'triangle', gain: 0.065, filter: 2600, slide: -210 })
    noise(0.09, { gain: 0.03, filter: 2400, q: 8 })
  }
  if (id === 'lifeHit') {
    tone(92, 0.22, { type: 'sawtooth', gain: 0.075, filter: 600, slide: -36 })
    noise(0.15, { gain: 0.05, filter: 360, q: 2 })
  }
  if (id === 'gameOver') arpeggio([220, 185, 147, 110], 0.12, { type: 'sawtooth', gain: 0.07, filter: 1200, duration: 0.18 })
  if (id === 'emp') {
    tone(120, 0.25, { type: 'sawtooth', gain: 0.08, filter: 900, slide: 520 })
    noise(0.22, { gain: 0.055, filter: 1800, q: 5 })
  }
  if (id === 'nuke') {
    tone(58, 0.62, { type: 'sawtooth', gain: 0.12, filter: 520, slide: -28 })
    noise(0.45, { gain: 0.12, filter: 280, q: 1.2, delay: 0.04 })
  }
  if (id === 'pulse') {
    tone(180, 0.2, { type: 'square', gain: 0.075, filter: 1200, slide: 780 })
    noise(0.18, { gain: 0.052, filter: 2200, q: 7 })
  }
  if (id === 'flame') noise(0.3, { gain: 0.08, filter: 740, q: 2 })
  if (id === 'laser') tone(1280, 0.22, { type: 'sawtooth', gain: 0.07, filter: 5200, slide: 360 })
  if (id === 'freeze') arpeggio([980, 740, 1108], 0.055, { type: 'triangle', gain: 0.058, filter: 5000, duration: 0.14 })
  if (id === 'meteor') {
    tone(130, 0.16, { type: 'sawtooth', gain: 0.045, filter: 720, slide: -42 })
    noise(0.12, { gain: 0.045, filter: 520, q: 2 })
  }
  if (id === 'meteorHit') {
    tone(80, 0.18, { type: 'sawtooth', gain: 0.08, filter: 560, slide: -34 })
    noise(0.16, { gain: 0.075, filter: 420, q: 1.4 })
  }
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(progressKey) || '{}')
  } catch {
    return {}
  }
}

function saveProgress() {
  const progress = {
    credits: state.credits,
    empCharges: state.empCharges,
    inventory: { ...state.inventory },
    upgrades: { ...upgrades },
  }
  try {
    localStorage.setItem(progressKey, JSON.stringify(progress))
  } catch {
    // Storage can be blocked in hardened/private browser sessions.
  }
}

function upgradeCost(id) {
  const def = upgradeDefs[id]
  return Math.round(def.base + Math.pow(upgrades[id], 1.18) * def.step)
}

function applyUpgradeStats() {
  player.speed = clamp(390 + upgrades.engine * 16, 390, 980)
  state.maxLives = 4 + Math.floor(upgrades.hull * 0.55)
  state.maxShield = 2 + Math.floor(upgrades.shield * 0.58)
  state.lives = clamp(state.lives, 0, state.maxLives)
  state.shield = clamp(state.shield, 0, state.maxShield)
}

function resetGame() {
  state.running = true
  state.paused = false
  state.over = false
  state.betweenWaves = false
  state.score = 0
  const saved = loadProgress()
  state.credits = Math.max(500, Number(saved.credits) || 0)
  const debugWave = Number(new URLSearchParams(window.location.search).get('wave'))
  state.wave = Number.isFinite(debugWave) && debugWave > 0 ? Math.floor(debugWave) : 1
  state.lastTime = 0
  state.enemyDirection = 1
  state.enemyStepDown = 0
  state.enemyShotTimer = 1.45
  state.diveTimer = 3.6
  state.powerupTimer = 5
  state.droneTimer = 0
  state.specialCooldown = 0
  state.waveBonus = 0
  state.currentSquad = 1
  state.squadsTotal = 1
  state.flameTimer = 0
  state.laserTimer = 0
  state.freezeTimer = 0
  state.screenShake = 0
  state.combo = 0
  state.comboTimer = 0
  state.maxCombo = 0
  state.stageMod = stageModForWave(state.wave)
  state.meteorTimer = 1.6
  state.screenFlash = 0
  state.empCharges = Math.max(2, Number(saved.empCharges) || 0)
  state.inventory.nuke = Math.max(0, Number(saved.inventory?.nuke) || 0)
  state.inventory.pulse = Math.max(1, Number(saved.inventory?.pulse) || 0)
  state.inventory.flame = Math.max(0, Number(saved.inventory?.flame) || 0)
  state.inventory.laser = Math.max(0, Number(saved.inventory?.laser) || 0)
  state.inventory.freeze = Math.max(0, Number(saved.inventory?.freeze) || 0)

  upgrades.weapon = clamp(Number(saved.upgrades?.weapon) || 1, 1, upgradeDefs.weapon.max)
  upgrades.engine = clamp(Number(saved.upgrades?.engine) || 1, 1, upgradeDefs.engine.max)
  upgrades.hull = clamp(Number(saved.upgrades?.hull) || 1, 1, upgradeDefs.hull.max)
  upgrades.shield = clamp(Number(saved.upgrades?.shield) || 1, 1, upgradeDefs.shield.max)
  upgrades.drone = clamp(Number(saved.upgrades?.drone) || 0, 0, upgradeDefs.drone.max)
  applyUpgradeStats()
  state.lives = state.maxLives
  state.shield = state.maxShield

  player.x = world.width / 2
  player.y = world.height - 58
  player.cooldown = 0
  player.invincible = 1.4

  bullets.length = 0
  enemyBullets.length = 0
  enemies.length = 0
  particles.length = 0
  floatTexts.length = 0
  effects.length = 0
  meteors.length = 0
  powerups.length = 0
  pauseButton.textContent = '暫停'
  specialButton.textContent = 'EMP'
  spawnStars()
  spawnWave()
  startOverlay.classList.remove('active')
  waveOverlay.classList.remove('active')
  gameOverOverlay.classList.remove('active')
  updateHud()
  saveProgress()
}

function spawnStars() {
  stars.length = 0
  for (let index = 0; index < 140; index += 1) {
    stars.push({
      x: rand(0, world.width),
      y: rand(0, world.height),
      speed: rand(18, 108),
      size: rand(1, 2.8),
      alpha: rand(0.3, 0.95),
    })
  }
}

function bossTypeForWave(wave) {
  if (wave === 60) return 'finalBoss'
  if (wave % 15 === 0) return 'majorBoss'
  if (wave % 5 === 0) return 'miniBoss'
  return ''
}

function isBossType(type) {
  return ['miniBoss', 'majorBoss', 'finalBoss', 'boss'].includes(type)
}

function bossName(type) {
  const names = {
    miniBoss: '小魔王：蜂群隊長',
    majorBoss: '大魔王：虛空魟艦',
    finalBoss: '最終魔王：日冕女王',
    boss: 'BOSS',
  }
  return names[type] ?? 'BOSS'
}

function stageModForWave(wave) {
  if (wave % 10 === 0) return 'treasure'
  if (wave % 7 === 0) return 'meteor'
  if (wave % 6 === 0) return 'ion'
  if (wave % 4 === 0) return 'solar'
  return 'calm'
}

function enemyStats(type) {
  const waveScale = Math.floor(Math.max(0, state.wave - 1) / 4)
  const table = {
    scout: { hp: 1 + waveScale, width: 38, height: 30, score: 85, credit: 28, pattern: 'straight' },
    bee: { hp: 1 + waveScale, width: 44, height: 34, score: 115, credit: 34, pattern: 'aimed' },
    guard: { hp: 2 + waveScale, width: 48, height: 36, score: 155, credit: 46, pattern: 'spread' },
    sniper: { hp: 1 + waveScale, width: 40, height: 32, score: 175, credit: 54, pattern: 'snipe' },
    bomber: { hp: 2 + waveScale, width: 54, height: 40, score: 220, credit: 66, pattern: 'burst' },
    tank: { hp: 4 + waveScale * 2, width: 60, height: 44, score: 300, credit: 88, pattern: 'heavy' },
    miniBoss: { hp: 34 + state.wave * 7, width: 134, height: 74, score: 1500, credit: 420, pattern: 'miniBoss' },
    majorBoss: { hp: 78 + state.wave * 11, width: 176, height: 92, score: 3200, credit: 900, pattern: 'majorBoss' },
    finalBoss: { hp: 520 + state.wave * 18, width: 218, height: 128, score: 12000, credit: 3600, pattern: 'finalBoss' },
    boss: { hp: 34 + state.wave * 7, width: 142, height: 78, score: 1500, credit: 420, pattern: 'miniBoss' },
  }
  return table[type]
}

function createEnemy(type, x, y, row = 0, col = 0) {
  const stats = enemyStats(type)
  const routes = ['drift', 'zigzag', 'swoop', 'orbit', 'ladder', 'split', 'rush']
  const fireModes = ['straight', 'aimed', 'spread', 'snipe', 'burst', 'heavy']
  const route = isBossType(type) ? 'boss' : routes[(state.wave + state.currentSquad + row + col) % routes.length]
  const fireMode = isBossType(type) ? stats.pattern : state.wave < 3 ? stats.pattern : fireModes[(state.wave + state.currentSquad + row * 2 + col) % fireModes.length]
  return {
    x,
    y,
    baseX: x,
    baseY: y,
    width: stats.width,
    height: stats.height,
    type,
    hp: stats.hp,
    maxHp: stats.hp,
    score: stats.score,
    credit: stats.credit,
    pattern: stats.pattern,
    fireMode,
    route,
    phase: rand(0, Math.PI * 2),
    hitFlash: 0,
    row,
    diving: false,
    diveT: 0,
    fireBias: rand(0.85, 1.2),
  }
}

function spawnWave() {
  enemies.length = 0
  enemyBullets.length = 0
  bullets.length = 0
  powerups.length = 0
  meteors.length = 0
  state.stageMod = stageModForWave(state.wave)
  state.meteorTimer = 1.2
  if (state.stageMod === 'meteor') spawnMeteor()
  state.currentSquad = 1
  state.squadsTotal = state.wave % 5 === 0 ? 2 : clamp(2 + Math.floor(state.wave / 3), 2, 4)
  spawnSquad()
}

function spawnSquad() {
  enemies.length = 0
  enemyBullets.length = 0
  state.enemyDirection = 1
  state.enemyStepDown = 0
  state.enemyShotTimer = clamp(1.35 - state.wave * 0.025, 0.62, 1.35)
  state.diveTimer = clamp(3.4 - state.wave * 0.055, 1.45, 3.4)
  state.powerupTimer = rand(5, 8)
  state.shield = state.maxShield
  player.invincible = 1.1

  const bossType = bossTypeForWave(state.wave)
  if (bossType) {
    enemies.push(createEnemy(bossType, world.width / 2, 112 + (state.currentSquad - 1) * 18, 0, 0))
    playSfx('bossSpawn')
    const escortTypes =
      bossType === 'finalBoss'
        ? ['tank', 'sniper', 'bomber', 'guard', 'bomber', 'sniper', 'tank']
        : bossType === 'majorBoss'
          ? ['sniper', 'guard', 'bomber', 'tank', 'bomber', 'guard', 'sniper']
          : state.currentSquad === 1
        ? ['bee', 'guard', 'bee', 'guard']
        : state.wave >= 10
          ? ['sniper', 'guard', 'bomber', 'guard', 'sniper']
          : ['bee', 'guard', 'sniper', 'guard', 'bee']
    escortTypes.forEach((type, index) => {
      enemies.push(createEnemy(type, 210 + index * 110, 232, 1, index))
    })
    return
  }

  const rows = clamp(4 + Math.floor((state.wave + state.currentSquad) / 3), 4, 6)
  const cols = clamp(8 + Math.floor((state.wave + state.currentSquad) / 4), 8, 12)
  const gapX = clamp(68 - state.currentSquad * 2, 60, 68)
  const gapY = 44
  const startX = (world.width - (cols - 1) * gapX) / 2
  const startY = 62

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let type = row === 0 ? 'bee' : row < 3 ? 'scout' : 'guard'
      if (state.wave >= 3 && state.currentSquad >= 2 && row === 0 && col % 3 === 0) type = 'sniper'
      if (state.wave >= 4 && state.currentSquad >= 2 && row === rows - 1 && col % 2 === 0) type = 'bomber'
      if (state.wave >= 7 && state.currentSquad >= 3 && row === rows - 1 && col % 4 === 0) type = 'tank'
      enemies.push(createEnemy(type, startX + col * gapX, startY + row * gapY, row, col))
    }
  }
}

function updateHud() {
  scoreEl.textContent = state.score.toLocaleString()
  creditsEl.textContent = state.credits.toLocaleString()
  waveEl.textContent = state.wave.toString()
  livesEl.textContent = `${state.lives}/${state.maxLives}`
  shieldEl.textContent = `${state.shield}/${state.maxShield}`
  weaponEl.textContent = `Lv.${upgrades.weapon}`
  comboEl.textContent = state.combo > 0 ? `${state.combo}x` : '0'
  specialButton.textContent = state.specialCooldown > 0 ? `EMP ${Math.ceil(state.specialCooldown)}` : `EMP ${state.empCharges}`
  specialButton.disabled = state.empCharges <= 0 || state.specialCooldown > 0 || !state.running || state.over || state.betweenWaves
  syncUpgradeCards()
  syncArsenal()
}

function syncUpgradeCards() {
  for (const id of upgradeOrder) {
    const def = upgradeDefs[id]
    const cost = upgradeCost(id)
    const level = upgrades[id]
    const maxed = level >= def.max
    upgradeEls[id].level.textContent = `Lv.${level}`
    upgradeEls[id].button.textContent = maxed ? '已滿級' : `升級 ${cost}`
    upgradeEls[id].button.disabled = maxed || state.credits < cost || !state.running || state.over
  }
}

function syncArsenal() {
  const labels = { nuke: '核彈', pulse: '脈衝', flame: '火焰', laser: '雷射', freeze: '凍結' }
  for (const [id, button] of Object.entries(oneShotButtons)) {
    button.textContent = `${labels[id]} ${state.inventory[id]}`
    button.disabled = state.inventory[id] <= 0 || !state.running || state.over || state.betweenWaves
  }
}

function buyUpgrade(id) {
  if (!state.running || state.over) return
  const def = upgradeDefs[id]
  if (!def || upgrades[id] >= def.max) return
  const cost = upgradeCost(id)
  if (state.credits < cost) return
  state.credits -= cost
  upgrades[id] += 1

  const previousMaxLives = state.maxLives
  const previousMaxShield = state.maxShield
  applyUpgradeStats()
  if (state.maxLives > previousMaxLives) state.lives += state.maxLives - previousMaxLives
  if (state.maxShield > previousMaxShield) state.shield += state.maxShield - previousMaxShield
  spawnExplosion(player.x, player.y - 10, '#35c4df', 18)
  playSfx('upgrade', { id })
  updateHud()
  saveProgress()
}

function bulletPattern() {
  const level = upgrades.weapon
  const bonus = Math.floor((level - 1) / 7)
  if (level === 1) return [{ x: 0, dx: 0, damage: 1 + bonus, size: 8 }]
  if (level === 2) return [{ x: -12, dx: 0, damage: 1 + bonus, size: 8 }, { x: 12, dx: 0, damage: 1 + bonus, size: 8 }]
  if (level === 3) return [{ x: -18, dx: -70, damage: 1 + bonus, size: 8 }, { x: 0, dx: 0, damage: 1 + bonus, size: 9 }, { x: 18, dx: 70, damage: 1 + bonus, size: 8 }]
  if (level === 4) return [{ x: -24, dx: -115, damage: 1 + bonus, size: 8 }, { x: -8, dx: -25, damage: 1 + bonus, size: 8 }, { x: 8, dx: 25, damage: 1 + bonus, size: 8 }, { x: 24, dx: 115, damage: 1 + bonus, size: 8 }]
  return [
    { x: -28, dx: -145, damage: 1 + bonus, size: 8 },
    { x: -12, dx: -48, damage: 1 + bonus, size: 8 },
    { x: 0, dx: 0, damage: (level >= 6 ? 3 : 2) + bonus, size: level >= 6 ? 13 : 11 },
    { x: 12, dx: 48, damage: 1 + bonus, size: 8 },
    { x: 28, dx: 145, damage: 1 + bonus, size: 8 },
  ]
}

function fireBullet() {
  if (player.cooldown > 0 || !state.running || state.paused || state.betweenWaves) return

  const cooldown = clamp(0.28 - upgrades.weapon * 0.025, 0.11, 0.28)
  for (const shot of bulletPattern()) {
    bullets.push({
      x: player.x + shot.x - shot.size / 2,
      y: player.y - 30,
      width: shot.size,
      height: shot.size === 13 ? 28 : 22,
      vx: shot.dx,
      vy: -680 - upgrades.weapon * 18,
      damage: shot.damage,
      source: 'player',
      color: shot.damage > 1 ? '#f4d35e' : '#e7fbff',
    })
  }

  addEffect('muzzle', player.x, player.y - 30, '#e7fbff', 18 + upgrades.weapon)
  playSfx('fire')
  player.cooldown = cooldown
}

function fireDrone() {
  if (upgrades.drone <= 0 || !state.running || state.paused || state.betweenWaves) return
  const offset = 38
  const droneCount = clamp(1 + Math.floor(upgrades.drone / 8), 1, 8)
  const droneDamage = 1 + Math.floor(upgrades.drone / 12)
  for (let index = 0; index < droneCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const lane = Math.ceil((index + 1) / 2)
    bullets.push({
      x: player.x + side * offset * lane - 4,
      y: player.y - 10,
      width: 7,
      height: 18,
      vx: side * 45,
      vy: -560,
      damage: droneDamage,
      source: 'drone',
      color: '#7fe58b',
    })
  }
}

function spawnEnemyBullet(x, y, vx, vy, size = 10, color = '#e85d75') {
  enemyBullets.push({ x: x - size / 2, y, width: size, height: size + 8, vx, vy, color })
}

function enemyFire(enemy) {
  const speed = 250 + state.wave * 15
  const pattern = enemy.fireMode ?? enemy.pattern
  addEffect('muzzle', enemy.x, enemy.y + 18, enemyColor(enemy.type), 14)
  playSfx('enemyFire')
  if (pattern === 'straight') {
    spawnEnemyBullet(enemy.x, enemy.y + 18, rand(-30, 30), speed)
  } else if (pattern === 'aimed') {
    const aim = aimVector(enemy.x, enemy.y, player.x, player.y, speed + 40)
    spawnEnemyBullet(enemy.x, enemy.y + 18, aim.vx, aim.vy)
  } else if (pattern === 'spread') {
    for (const angle of [-0.38, 0, 0.38]) spawnEnemyBullet(enemy.x, enemy.y + 18, Math.sin(angle) * speed, Math.cos(angle) * speed)
  } else if (pattern === 'snipe') {
    const aim = aimVector(enemy.x, enemy.y, player.x, player.y, speed + 120)
    spawnEnemyBullet(enemy.x, enemy.y + 18, aim.vx, aim.vy, 8, '#f4d35e')
  } else if (pattern === 'burst') {
    for (const angle of [-0.62, -0.28, 0.28, 0.62]) spawnEnemyBullet(enemy.x, enemy.y + 18, Math.sin(angle) * speed, Math.cos(angle) * speed, 11, '#ff8b67')
  } else if (pattern === 'heavy') {
    for (const angle of [-0.22, 0.22]) spawnEnemyBullet(enemy.x, enemy.y + 20, Math.sin(angle) * (speed + 25), Math.cos(angle) * (speed + 25), 15, '#b987ff')
  } else if (pattern === 'miniBoss') {
    for (const angle of [-0.52, -0.26, 0, 0.26, 0.52]) spawnEnemyBullet(enemy.x, enemy.y + 34, Math.sin(angle) * (speed + 30), Math.cos(angle) * (speed + 30), 12, '#f4d35e')
    const aim = aimVector(enemy.x, enemy.y, player.x, player.y, speed + 95)
    spawnEnemyBullet(enemy.x, enemy.y + 34, aim.vx, aim.vy, 12, '#ff8b67')
  } else if (pattern === 'majorBoss') {
    const ring = 10 + Math.floor(state.wave / 10)
    for (let index = 0; index < ring; index += 1) {
      const angle = -1.05 + (index / Math.max(1, ring - 1)) * 2.1
      spawnEnemyBullet(enemy.x, enemy.y + 42, Math.sin(angle) * (speed + 35), Math.cos(angle) * (speed + 35), 13, '#b987ff')
    }
    for (const offset of [-72, 72]) {
      const aim = aimVector(enemy.x + offset, enemy.y, player.x, player.y, speed + 70)
      spawnEnemyBullet(enemy.x + offset, enemy.y + 42, aim.vx, aim.vy, 15, '#9ad9ff')
    }
  } else if (pattern === 'finalBoss') {
    const ring = 18
    const spin = performance.now() / 420
    for (let index = 0; index < ring; index += 1) {
      const angle = spin + (index / ring) * Math.PI * 2
      spawnEnemyBullet(enemy.x, enemy.y + 54, Math.cos(angle) * (speed + 45), Math.sin(angle) * (speed + 45), 12, index % 2 === 0 ? '#f4d35e' : '#e85d75')
    }
    for (const offset of [-92, 0, 92]) {
      const aim = aimVector(enemy.x + offset, enemy.y, player.x, player.y, speed + 125)
      spawnEnemyBullet(enemy.x + offset, enemy.y + 56, aim.vx, aim.vy, 16, '#ffffff')
    }
  }
}

function startDive(enemy) {
  if (!enemy || enemy.diving || isBossType(enemy.type) || enemy.type === 'tank') return
  enemy.diving = true
  enemy.diveT = 0
}

function spawnExplosion(x, y, color, count = 14) {
  for (let index = 0; index < count; index += 1) {
    particles.push({
      x,
      y,
      vx: rand(-190, 190),
      vy: rand(-190, 190),
      size: rand(2, 5.4),
      life: rand(0.34, 0.84),
      maxLife: 0.84,
      color,
    })
  }
}

function floatText(x, y, text, color = '#f4d35e') {
  floatTexts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 })
}

function addEffect(type, x, y, color = '#f4d35e', radius = 24) {
  effects.push({ type, x, y, color, radius, life: 0.75, maxLife: 0.75 })
}

function flashScreen(amount = 0.28) {
  state.screenFlash = clamp(state.screenFlash + amount, 0, 0.72)
}

function registerKill() {
  state.combo += 1
  state.comboTimer = 3.2
  state.maxCombo = Math.max(state.maxCombo, state.combo)
  return 1 + Math.min(state.combo, 80) * 0.018
}

function spawnPowerup(type = '') {
  const roll = Math.random()
  const chosen =
    type ||
    (roll > 0.9
      ? 'nuke'
      : roll > 0.8
        ? 'pulse'
        : roll > 0.68
          ? 'flame'
          : roll > 0.56
            ? 'laser'
            : roll > 0.44
              ? 'freeze'
              : roll > 0.3
                ? 'life'
                : roll > 0.16
                  ? 'shield'
                  : roll > 0.06
                    ? 'credits'
                    : 'emp')
  powerups.push({ x: rand(80, world.width - 80), y: -28, width: 32, height: 32, vy: 105, type: chosen })
}

function maybeDropTreasure(enemy) {
  const modBonus = state.stageMod === 'treasure' ? 0.18 : 0
  const dropChance = isBossType(enemy.type) ? 1 : clamp(0.18 + state.wave * 0.012 + state.currentSquad * 0.025 + modBonus, 0.18, 0.62)
  if (Math.random() > dropChance) return
  const roll = Math.random()
  const type =
    isBossType(enemy.type)
      ? 'nuke'
      : roll > 0.92
        ? 'nuke'
        : roll > 0.8
          ? 'pulse'
          : roll > 0.67
            ? 'flame'
            : roll > 0.54
              ? 'laser'
              : roll > 0.42
                ? 'freeze'
                : roll > 0.26
                  ? 'credits'
                  : roll > 0.12
                    ? 'shield'
                    : 'life'
  powerups.push({ x: enemy.x - 16, y: enemy.y - 12, width: 32, height: 32, vy: 92, type })
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt
    if (star.y > world.height + 4) {
      star.x = rand(0, world.width)
      star.y = -4
      star.speed = rand(18, 108)
    }
  }
}

function updatePlayer(dt) {
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const stageSpeed = state.stageMod === 'solar' ? 1.18 : 1
  player.x = clamp(player.x + move * player.speed * stageSpeed * dt, 36, world.width - 36)
  player.cooldown = Math.max(0, player.cooldown - dt)
  player.invincible = Math.max(0, player.invincible - dt)
  state.specialCooldown = Math.max(0, state.specialCooldown - dt)
  state.droneTimer = Math.max(0, state.droneTimer - dt)
  state.comboTimer = Math.max(0, state.comboTimer - dt)
  if (state.comboTimer === 0) state.combo = 0

  if (input.fire) fireBullet()
  if (state.droneTimer === 0) {
    fireDrone()
    state.droneTimer = clamp(0.78 - upgrades.drone * 0.018, 0.26, 0.78)
  }
}

function updateOneShotWeapons(dt) {
  state.flameTimer = Math.max(0, state.flameTimer - dt)
  state.laserTimer = Math.max(0, state.laserTimer - dt)
  state.freezeTimer = Math.max(0, state.freezeTimer - dt)
  state.screenShake = Math.max(0, state.screenShake - dt)

  if (state.flameTimer > 0) {
    for (const enemy of enemies) {
      const inCone = Math.abs(enemy.x - player.x) < 150 && enemy.y > player.y - 330 && enemy.y < player.y + 20
      if (inCone) enemy.hp -= (4 + upgrades.weapon * 0.18) * dt
    }
  }

  if (state.laserTimer > 0) {
    for (const enemy of enemies) {
      if (Math.abs(enemy.x - player.x) < 42) enemy.hp -= (9 + upgrades.weapon * 0.3) * dt
    }
  }

  if (state.flameTimer > 0 || state.laserTimer > 0) cleanupDefeatedEnemies(0.82)
}

function updateBullets(dt) {
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    const bullet = bullets[index]
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
    if (bullet.y < -50 || bullet.x < -60 || bullet.x > world.width + 60) bullets.splice(index, 1)
  }

  for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
    const bullet = enemyBullets[index]
    const slow = state.freezeTimer > 0 ? 0.32 : 1
    if (state.stageMod === 'ion') bullet.vx += Math.sin(performance.now() / 170 + bullet.y) * 18 * dt
    bullet.x += bullet.vx * dt * slow
    bullet.y += bullet.vy * dt * slow
    if (bullet.y > world.height + 70 || bullet.x < -70 || bullet.x > world.width + 70) enemyBullets.splice(index, 1)
  }
}

function updateEnemies(dt) {
  const speed = 32 + state.wave * 6
  let edgeHit = false

  for (const enemy of enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt)
    if (isBossType(enemy.type)) {
      const bossSpeed = enemy.type === 'finalBoss' ? 34 : enemy.type === 'majorBoss' ? 46 : 58
      enemy.baseX += (bossSpeed + state.wave * 1.2) * state.enemyDirection * dt
      enemy.x = enemy.baseX
      enemy.y = enemy.baseY + Math.sin(performance.now() / (enemy.type === 'finalBoss' ? 430 : 520) + enemy.phase) * (enemy.type === 'miniBoss' ? 18 : 12)
      if (enemy.x < enemy.width / 2 + 18 || enemy.x > world.width - enemy.width / 2 - 18) edgeHit = true
      continue
    }

    if (!enemy.diving) {
      enemy.baseX += speed * state.enemyDirection * dt
      const t = performance.now() / 1000 + enemy.phase
      let routeX = Math.sin(t * 2.1) * (8 + enemy.row)
      let routeY = Math.cos(t * 1.4) * 5
      if (enemy.route === 'zigzag') routeX = Math.sin(t * 4.2) * 22
      if (enemy.route === 'swoop') routeY = Math.sin(t * 2.8) * 18
      if (enemy.route === 'orbit') {
        routeX = Math.sin(t * 2.2) * 24
        routeY = Math.cos(t * 1.8) * 14
      }
      if (enemy.route === 'ladder') {
        routeX = (Math.floor(t * 2.5) % 2 === 0 ? -1 : 1) * (12 + enemy.row * 2)
        routeY = Math.sin(t * 3.2) * 8
      }
      if (enemy.route === 'split') routeX = Math.sin(t * 2.5) * (enemy.row % 2 === 0 ? 30 : -30)
      if (enemy.route === 'rush') routeY = Math.max(0, Math.sin(t * 1.6)) * 24
      enemy.x = enemy.baseX + routeX
      enemy.y = enemy.baseY + routeY + state.enemyStepDown
      if (enemy.x < 28 || enemy.x > world.width - 28) edgeHit = true
    } else {
      enemy.diveT += dt
      enemy.x += Math.sin(enemy.diveT * 5.5 + enemy.phase) * (135 + state.wave * 4) * dt
      enemy.y += (230 + state.wave * 24) * dt
      if (enemy.y > world.height + 54) {
        enemy.diving = false
        enemy.diveT = 0
        enemy.y = enemy.baseY + state.enemyStepDown
      }
    }
  }

  if (edgeHit) {
    state.enemyDirection *= -1
    state.enemyStepDown += 15
  }

  state.enemyShotTimer -= dt
  if (state.enemyShotTimer <= 0 && enemies.length > 0) {
    const shooter = enemies[Math.floor(rand(0, enemies.length))]
    enemyFire(shooter)
    state.enemyShotTimer = clamp((1.28 - state.wave * 0.026) * shooter.fireBias, 0.58, 1.28)
  }

  state.diveTimer -= dt
  if (state.diveTimer <= 0 && enemies.length > 0) {
    const candidates = enemies.filter((enemy) => !enemy.diving && ['scout', 'bee', 'sniper', 'bomber'].includes(enemy.type))
    startDive(candidates[Math.floor(rand(0, candidates.length))])
    state.diveTimer = clamp(3.25 - state.wave * 0.055, 1.35, 3.25)
  }

  if (enemies.some((enemy) => enemy.y > player.y - 24)) damagePlayer()
}

function updatePowerups(dt) {
  state.powerupTimer -= dt
  if (state.powerupTimer <= 0) {
    spawnPowerup()
    state.powerupTimer = rand(8, 13)
  }

  for (let index = powerups.length - 1; index >= 0; index -= 1) {
    const powerup = powerups[index]
    powerup.y += powerup.vy * dt
    if (powerup.y > world.height + 40) {
      powerups.splice(index, 1)
      continue
    }

    if (rectsOverlap(powerup, { x: player.x - 26, y: player.y - 20, width: 52, height: 42 })) {
      if (powerup.type === 'life') state.lives = clamp(state.lives + 1, 0, state.maxLives)
      if (powerup.type === 'shield') state.shield = clamp(state.shield + 1, 0, state.maxShield)
      if (powerup.type === 'credits') state.credits += 220 + state.wave * 28
      if (powerup.type === 'emp') {
        state.specialCooldown = 0
        state.empCharges += 1
      }
      if (['nuke', 'pulse', 'flame', 'laser', 'freeze'].includes(powerup.type)) state.inventory[powerup.type] += 1
      spawnExplosion(powerup.x + 15, powerup.y + 15, powerupColor(powerup.type), 18)
      floatText(powerup.x + 15, powerup.y, treasureLabel(powerup.type), powerupColor(powerup.type))
      playSfx('pickup', { type: powerup.type })
      powerups.splice(index, 1)
      updateHud()
      saveProgress()
    }
  }
}

function spawnMeteor() {
  playSfx('meteor')
  meteors.push({
    x: rand(40, world.width - 40),
    y: -40,
    vx: rand(-70, 70),
    vy: rand(230, 330),
    radius: rand(12, 24),
    life: 5,
  })
}

function updateMeteors(dt) {
  if (state.stageMod === 'meteor') {
    state.meteorTimer -= dt
    if (state.meteorTimer <= 0) {
      spawnMeteor()
      state.meteorTimer = rand(0.55, 1.25)
    }
  }

  const playerBox = { x: player.x - 26, y: player.y - 20, width: 52, height: 42 }
  let meteorKilledEnemy = false
  for (let index = meteors.length - 1; index >= 0; index -= 1) {
    const meteor = meteors[index]
    meteor.x += meteor.vx * dt
    meteor.y += meteor.vy * dt
    meteor.life -= dt
    const meteorBox = { x: meteor.x - meteor.radius, y: meteor.y - meteor.radius, width: meteor.radius * 2, height: meteor.radius * 2 }
    for (const enemy of enemies) {
      const enemyBox = { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height }
      if (rectsOverlap(meteorBox, enemyBox)) {
        enemy.hp -= isBossType(enemy.type) ? 8 : 999
        enemy.hitFlash = 0.18
        meteorKilledEnemy = true
        meteor.life = 0
        state.screenShake = Math.max(state.screenShake, 0.2)
        flashScreen(0.1)
        playSfx('meteorHit')
        spawnExplosion(meteor.x, meteor.y, '#ff8b67', 18)
        break
      }
    }
    if (rectsOverlap(meteorBox, playerBox)) {
      damagePlayer()
      playSfx('meteorHit')
      spawnExplosion(meteor.x, meteor.y, '#ff8b67', 16)
      meteor.life = 0
    }
    if (meteor.y > world.height + 60 || meteor.life <= 0) meteors.splice(index, 1)
  }
  if (meteorKilledEnemy) cleanupDefeatedEnemies(0.78)
}

function updateParticles(dt) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index]
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.96
    particle.vy *= 0.96
    particle.life -= dt
    if (particle.life <= 0) particles.splice(index, 1)
  }
}

function updateFloatTexts(dt) {
  for (let index = floatTexts.length - 1; index >= 0; index -= 1) {
    const item = floatTexts[index]
    item.y -= 34 * dt
    item.life -= dt
    if (item.life <= 0) floatTexts.splice(index, 1)
  }
}

function updateEffects(dt) {
  state.screenFlash = Math.max(0, state.screenFlash - dt * 1.8)
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index]
    effect.life -= dt
    effect.radius += (effect.type === 'shockwave' ? 220 : 60) * dt
    if (effect.life <= 0) effects.splice(index, 1)
  }
}

function resolveCollisions() {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = bullets[bulletIndex]
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = enemies[enemyIndex]
      const box = { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height }
      if (!rectsOverlap(bullet, box)) continue

      bullets.splice(bulletIndex, 1)
      enemy.hp -= bullet.damage
      enemy.hitFlash = 0.12
      playSfx('bulletHit')
      spawnExplosion(bullet.x + bullet.width / 2, bullet.y, bullet.color, 7)

      if (enemy.hp <= 0) {
        const comboMultiplier = registerKill()
        const killScore = Math.round((enemy.score + state.wave * 10) * comboMultiplier)
        const killCredits = Math.round(enemy.credit * (1 + Math.min(state.combo, 60) * 0.01))
        state.score += killScore
        state.credits += killCredits
        floatText(enemy.x, enemy.y - 22, `+${killScore} / ${killCredits}晶`, enemyColor(enemy.type))
        spawnExplosion(enemy.x, enemy.y, enemyColor(enemy.type), isBossType(enemy.type) ? 48 : 18)
        enemyDeathSound(enemy.type)
        maybeDropTreasure(enemy)
        enemies.splice(enemyIndex, 1)
        updateHud()
        saveProgress()
      }
      break
    }
  }

  const playerBox = { x: player.x - 26, y: player.y - 20, width: 52, height: 42 }
  for (let bulletIndex = enemyBullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    if (rectsOverlap(enemyBullets[bulletIndex], playerBox)) {
      enemyBullets.splice(bulletIndex, 1)
      damagePlayer()
    }
  }

  for (const enemy of enemies) {
    const enemyBox = { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height }
    if (rectsOverlap(enemyBox, playerBox)) damagePlayer()
  }

  if (enemies.length === 0 && state.running && !state.betweenWaves) {
    if (state.currentSquad < state.squadsTotal) {
      state.currentSquad += 1
      state.score += 180 + state.wave * 20
      state.credits += 90 + state.wave * 18
      floatText(world.width / 2, 92, `敵群 ${state.currentSquad}/${state.squadsTotal}`, '#f4d35e')
      spawnSquad()
      updateHud()
      saveProgress()
    } else {
      completeWave()
    }
  }
}

function cleanupDefeatedEnemies(multiplier = 0.75) {
  let changed = false
  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index]
    if (enemy.hp > 0) continue
    const comboMultiplier = registerKill()
    state.score += Math.floor(enemy.score * multiplier * comboMultiplier)
    state.credits += Math.floor(enemy.credit * multiplier * (1 + Math.min(state.combo, 60) * 0.01))
    maybeDropTreasure(enemy)
    spawnExplosion(enemy.x, enemy.y, enemyColor(enemy.type), isBossType(enemy.type) ? 42 : 16)
    enemyDeathSound(enemy.type)
    enemies.splice(index, 1)
    changed = true
  }
  if (changed) saveProgress()
}

function completeWave() {
  state.betweenWaves = true
  state.waveBonus = 420 + state.wave * 120 + state.squadsTotal * 90
  state.score += 800 + state.wave * 80
  state.credits += state.waveBonus
  if (state.wave % 2 === 0) state.empCharges += 1
  player.invincible = 1.2
  playSfx('waveClear')
  waveTitle.textContent = state.wave % 5 === 0 ? 'Boss 擊破' : `第 ${state.wave} 波清除`
  waveText.textContent = `完成 ${state.squadsTotal} 個敵群，獲得 ${state.waveBonus} 晶片。現在應該至少能升級一到兩項，再進入第 ${state.wave + 1} 波。`
  waveOverlay.classList.add('active')
  updateHud()
  saveProgress()
}

function startNextWave() {
  if (!state.running || state.over || !state.betweenWaves) return
  state.wave += 1
  state.betweenWaves = false
  waveOverlay.classList.remove('active')
  playSfx('nextWave')
  spawnWave()
  updateHud()
}

function damagePlayer() {
  if (player.invincible > 0 || state.over || state.betweenWaves) return
  if (state.shield > 0) {
    state.shield -= 1
    player.invincible = 0.75
    state.screenShake = Math.max(state.screenShake, 0.25)
    flashScreen(0.12)
    playSfx('shieldHit')
    spawnExplosion(player.x, player.y, '#35c4df', 18)
    updateHud()
    return
  }

  state.lives -= 1
  player.invincible = 1.45
  state.screenShake = Math.max(state.screenShake, 0.48)
  flashScreen(0.24)
  playSfx('lifeHit')
  spawnExplosion(player.x, player.y, '#e85d75', 30)
  updateHud()
  if (state.lives <= 0) endGame()
}

function useSpecial() {
  if (!state.running || state.paused || state.over || state.betweenWaves || state.specialCooldown > 0 || state.empCharges <= 0) return
  playSfx('emp')
  state.empCharges -= 1
  enemyBullets.length = 0
  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index]
    enemy.hp -= 3 + upgrades.weapon
    enemy.hitFlash = 0.18
    spawnExplosion(enemy.x, enemy.y, '#b987ff', 8)
    if (enemy.hp <= 0) {
      state.score += Math.floor(enemy.score * 0.7)
      state.credits += Math.floor(enemy.credit * 0.7)
      enemyDeathSound(enemy.type)
      enemies.splice(index, 1)
    }
  }
  state.specialCooldown = clamp(14 - upgrades.shield - upgrades.drone, 7, 14)
  addEffect('shockwave', player.x, player.y - 40, '#b987ff', 34)
  flashScreen(0.16)
  spawnExplosion(player.x, player.y - 40, '#b987ff', 54)
  updateHud()
  saveProgress()
}

function useOneShot(type) {
  if (!state.running || state.paused || state.over || state.betweenWaves || state.inventory[type] <= 0) return
  state.inventory[type] -= 1

  if (type === 'nuke') {
    playSfx('nuke')
    enemyBullets.length = 0
    addEffect('shockwave', world.width / 2, world.height / 2, '#f4d35e', 70)
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      const enemy = enemies[index]
      enemy.hp -= isBossType(enemy.type) ? 55 + upgrades.weapon * 2 : 999
      enemy.hitFlash = 0.2
      spawnExplosion(enemy.x, enemy.y, '#f4d35e', 22)
      if (enemy.hp <= 0) {
        state.score += Math.floor(enemy.score * 0.85)
        state.credits += Math.floor(enemy.credit * 0.85)
        maybeDropTreasure(enemy)
        enemyDeathSound(enemy.type)
        enemies.splice(index, 1)
      }
    }
    state.screenShake = 0.55
    flashScreen(0.3)
    floatText(world.width / 2, world.height / 2, '核彈清場', '#f4d35e')
  }

  if (type === 'pulse') {
    playSfx('pulse')
    enemyBullets.length = 0
    addEffect('shockwave', player.x, player.y - 40, '#b987ff', 42)
    for (const enemy of enemies) {
      enemy.hp -= 9 + Math.floor(upgrades.weapon / 4)
      enemy.hitFlash = 0.16
      spawnExplosion(enemy.x, enemy.y, '#b987ff', 10)
    }
    cleanupDefeatedEnemies(0.8)
    state.shield = clamp(state.shield + 1, 0, state.maxShield)
    state.screenShake = 0.28
    flashScreen(0.16)
    floatText(player.x, player.y - 70, '脈衝爆發', '#b987ff')
  }

  if (type === 'flame') {
    playSfx('flame')
    state.flameTimer = 5.5 + upgrades.weapon * 0.05
    floatText(player.x, player.y - 70, '火焰噴射', '#ff8b67')
  }

  if (type === 'laser') {
    playSfx('laser')
    state.laserTimer = 4.4 + upgrades.weapon * 0.035
    floatText(player.x, player.y - 70, '雷射貫穿', '#7bd6e8')
  }

  if (type === 'freeze') {
    playSfx('freeze')
    state.freezeTimer = 5.2 + upgrades.shield * 0.04
    enemyBullets.length = Math.floor(enemyBullets.length / 3)
    floatText(player.x, player.y - 70, '時間凍結', '#9ad9ff')
  }

  cleanupDefeatedEnemies(0.85)
  updateHud()
  saveProgress()
}

function endGame() {
  state.running = false
  state.over = true
  playSfx('gameOver')
  resultTitle.textContent = state.wave >= 8 ? '漂亮撤離' : '任務結束'
  resultText.textContent = `分數 ${state.score.toLocaleString()}，抵達第 ${state.wave} 波，剩餘晶片 ${state.credits.toLocaleString()}`
  gameOverOverlay.classList.add('active')
}

function togglePause() {
  if (!state.running || state.over || state.betweenWaves) return
  state.paused = !state.paused
  playSfx('pause', { paused: state.paused })
  pauseButton.textContent = state.paused ? '繼續' : '暫停'
}

function update(dt) {
  if (!state.running || state.paused || state.betweenWaves) {
    updateStars(dt)
    updateParticles(dt)
    updateFloatTexts(dt)
    updateEffects(dt)
    return
  }

  updateStars(dt)
  updatePlayer(dt)
  updateOneShotWeapons(dt)
  updateBullets(dt)
  updateEnemies(state.freezeTimer > 0 ? dt * 0.38 : dt)
  updatePowerups(dt)
  updateMeteors(dt)
  updateParticles(dt)
  updateFloatTexts(dt)
  updateEffects(dt)
  resolveCollisions()
  updateHud()
}

function roundedRect(x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  const r = Math.min(radius, width / 2, height / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
}

function enemyColor(type) {
  const colors = {
    scout: '#7bd6e8',
    bee: '#f4d35e',
    guard: '#35c4df',
    sniper: '#ff8b67',
    bomber: '#e85d75',
    tank: '#b987ff',
    miniBoss: '#f4d35e',
    majorBoss: '#b987ff',
    finalBoss: '#ffffff',
    boss: '#f4d35e',
  }
  return colors[type] ?? '#7bd6e8'
}

function powerupColor(type) {
  const colors = {
    life: '#7fe58b',
    shield: '#35c4df',
    credits: '#f4d35e',
    emp: '#b987ff',
    nuke: '#f4d35e',
    pulse: '#b987ff',
    flame: '#ff8b67',
    laser: '#7bd6e8',
    freeze: '#9ad9ff',
  }
  return colors[type] ?? '#35c4df'
}

function treasureLabel(type) {
  const labels = {
    life: '生命',
    shield: '護盾',
    credits: '晶片',
    emp: 'EMP',
    nuke: '核彈',
    pulse: '脈衝',
    flame: '火焰',
    laser: '雷射',
    freeze: '凍結',
  }
  return labels[type] ?? '寶箱'
}

function drawBackground() {
  ctx.fillStyle = '#050b12'
  ctx.fillRect(0, 0, world.width, world.height)
  const time = performance.now() / 1000
  for (const star of stars) {
    ctx.globalAlpha = star.alpha
    ctx.fillStyle = '#dff8ff'
    ctx.fillRect(star.x, star.y, star.size, star.size)
    if (star.speed > 84) {
      ctx.globalAlpha = star.alpha * 0.28
      ctx.fillRect(star.x, star.y - 8, star.size, 10)
    }
  }
  ctx.globalAlpha = 1
  const gradient = ctx.createLinearGradient(0, 0, 0, world.height)
  gradient.addColorStop(0, 'rgba(53, 196, 223, 0.08)')
  gradient.addColorStop(0.62, 'rgba(232, 93, 117, 0.04)')
  gradient.addColorStop(1, 'rgba(244, 211, 94, 0.08)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, world.width, world.height)

  const nebula = ctx.createRadialGradient(world.width * 0.72, world.height * 0.24, 20, world.width * 0.72, world.height * 0.24, 360)
  nebula.addColorStop(0, 'rgba(53, 196, 223, 0.18)')
  nebula.addColorStop(0.38, 'rgba(185, 135, 255, 0.1)')
  nebula.addColorStop(1, 'rgba(185, 135, 255, 0)')
  ctx.fillStyle = nebula
  ctx.fillRect(0, 0, world.width, world.height)

  const modColor = stageMods[state.stageMod]?.color ?? '#7bd6e8'
  const eventGlow = ctx.createRadialGradient(world.width * 0.18, world.height * 0.82, 10, world.width * 0.18, world.height * 0.82, 420)
  eventGlow.addColorStop(0, `${modColor}2c`)
  eventGlow.addColorStop(1, `${modColor}00`)
  ctx.fillStyle = eventGlow
  ctx.fillRect(0, 0, world.width, world.height)

  if (state.stageMod === 'ion') {
    ctx.strokeStyle = 'rgba(185, 135, 255, 0.16)'
    ctx.lineWidth = 2
    for (let x = -80; x < world.width + 80; x += 120) {
      ctx.beginPath()
      ctx.moveTo(x + Math.sin(time * 2 + x) * 24, 0)
      ctx.bezierCurveTo(x + 72, 170, x - 42, 390, x + 90, world.height)
      ctx.stroke()
    }
  }

  if (state.stageMod === 'solar') {
    ctx.fillStyle = 'rgba(244, 211, 94, 0.08)'
    for (let y = 28; y < world.height; y += 76) ctx.fillRect((time * 90 + y) % world.width - 120, y, 240, 2)
  }

  ctx.strokeStyle = 'rgba(123, 214, 232, 0.08)'
  ctx.lineWidth = 1
  for (let y = 70; y < world.height; y += 70) {
    ctx.beginPath()
    ctx.moveTo(0, y + Math.sin(y) * 8)
    ctx.bezierCurveTo(240, y - 22, 620, y + 22, world.width, y - 10)
    ctx.stroke()
  }
}

function drawPlayer() {
  ctx.save()
  ctx.translate(player.x, player.y)
  const tilt = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 0.12
  ctx.rotate(tilt)
  if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) ctx.globalAlpha = 0.42

  const thrust = 20 + Math.sin(performance.now() / 42) * 7
  const thrustGradient = ctx.createLinearGradient(0, 20, 0, 56)
  thrustGradient.addColorStop(0, 'rgba(244, 211, 94, 0.92)')
  thrustGradient.addColorStop(1, 'rgba(232, 93, 117, 0)')
  ctx.fillStyle = thrustGradient
  ctx.beginPath()
  ctx.moveTo(-10, 22)
  ctx.lineTo(0, 28 + thrust)
  ctx.lineTo(10, 22)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#35c4df'
  ctx.beginPath()
  ctx.moveTo(0, -31)
  ctx.lineTo(30, 22)
  ctx.lineTo(10, 13)
  ctx.lineTo(0, 25)
  ctx.lineTo(-10, 13)
  ctx.lineTo(-30, 22)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#f4d35e'
  ctx.beginPath()
  const cockpitWidth = 10 + Math.min(upgrades.hull * 0.22, 9)
  ctx.ellipse(0, -7, cockpitWidth, 14, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#e85d75'
  ctx.fillRect(-8, 22, 16, 13)

  if (state.shield > 0) {
    ctx.strokeStyle = 'rgba(53, 196, 223, 0.72)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(0, 0, 38, 35, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  drawDrones()
  ctx.restore()
}

function drawDrones() {
  if (upgrades.drone <= 0) return
  const time = performance.now() / 420
  const droneCount = clamp(1 + Math.floor(upgrades.drone / 8), 1, 8)
  for (let index = 0; index < droneCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const lane = Math.ceil((index + 1) / 2)
    const x = side * 38 * lane + Math.sin(time + index) * 5
    const y = 8 + lane * 8 + Math.cos(time + index) * 4
    ctx.shadowBlur = 12
    ctx.shadowColor = '#7fe58b'
    ctx.fillStyle = '#7fe58b'
    ctx.beginPath()
    ctx.ellipse(x, y, 8, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

function drawEnemy(enemy) {
  ctx.save()
  ctx.translate(enemy.x, enemy.y)
  const color = enemyColor(enemy.type)
  ctx.fillStyle = color
  ctx.shadowBlur = enemy.hitFlash > 0 ? 24 : 0
  ctx.shadowColor = '#ffffff'

  if (isBossType(enemy.type)) {
    ctx.beginPath()
    if (enemy.type === 'miniBoss' || enemy.type === 'boss') {
      roundedRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height, 18)
    } else if (enemy.type === 'majorBoss') {
      ctx.moveTo(0, -enemy.height / 2)
      ctx.lineTo(enemy.width / 2, -6)
      ctx.lineTo(enemy.width / 3, enemy.height / 2)
      ctx.lineTo(0, enemy.height / 3)
      ctx.lineTo(-enemy.width / 3, enemy.height / 2)
      ctx.lineTo(-enemy.width / 2, -6)
      ctx.closePath()
    } else {
      const spikes = 12
      for (let index = 0; index < spikes; index += 1) {
        const angle = (index / spikes) * Math.PI * 2 - Math.PI / 2
        const radius = index % 2 === 0 ? enemy.width / 2 : enemy.width / 3
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius * 0.58
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }
    ctx.shadowBlur = enemy.type === 'finalBoss' ? 30 : 18
    ctx.shadowColor = color
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#071019'
    ctx.fillRect(-42, -8, 22, 14)
    ctx.fillRect(20, -8, 22, 14)
    ctx.fillStyle = enemy.type === 'finalBoss' ? '#e85d75' : '#f4d35e'
    ctx.fillRect(-enemy.width / 3, enemy.height / 3, (enemy.width / 3) * 2, 6)
  } else {
    ctx.beginPath()
    ctx.ellipse(0, 0, enemy.width / 2, enemy.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#071019'
    ctx.fillRect(-12, -5, 7, 7)
    ctx.fillRect(5, -5, 7, 7)
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-enemy.width / 2 + 6, -2)
    ctx.lineTo(-enemy.width / 2 - 10, -14)
    ctx.moveTo(enemy.width / 2 - 6, -2)
    ctx.lineTo(enemy.width / 2 + 10, -14)
    ctx.stroke()
  }

  if (enemy.hitFlash > 0) {
    ctx.globalAlpha = clamp(enemy.hitFlash / 0.18, 0, 1) * 0.72
    ctx.fillStyle = '#ffffff'
    if (isBossType(enemy.type)) {
      ctx.beginPath()
      roundedRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height, 18)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.ellipse(0, 0, enemy.width / 2, enemy.height / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  if (enemy.maxHp > 2) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(-enemy.width / 2, enemy.height / 2 + 7, enemy.width, 5)
    ctx.fillStyle = '#7fe58b'
    ctx.fillRect(-enemy.width / 2, enemy.height / 2 + 7, enemy.width * clamp(enemy.hp / enemy.maxHp, 0, 1), 5)
  }
  ctx.restore()
}

function drawBullets() {
  ctx.save()
  ctx.shadowBlur = 14
  for (const bullet of bullets) {
    ctx.fillStyle = bullet.color
    ctx.shadowColor = bullet.color
    ctx.globalAlpha = 0.36
    ctx.fillRect(bullet.x + bullet.width / 2 - 1, bullet.y + bullet.height, 2, 28)
    ctx.globalAlpha = 1
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
  }
  for (const bullet of enemyBullets) {
    ctx.fillStyle = bullet.color
    ctx.shadowColor = bullet.color
    ctx.beginPath()
    ctx.ellipse(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, bullet.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWeaponEffects() {
  if (state.flameTimer > 0) {
    const flicker = 16 + Math.sin(performance.now() / 58) * 10
    const flame = ctx.createLinearGradient(player.x, player.y, player.x, player.y - 330)
    flame.addColorStop(0, 'rgba(255, 139, 103, 0.75)')
    flame.addColorStop(0.45, 'rgba(244, 211, 94, 0.32)')
    flame.addColorStop(1, 'rgba(232, 93, 117, 0)')
    ctx.fillStyle = flame
    ctx.beginPath()
    ctx.moveTo(player.x - 18, player.y - 20)
    ctx.lineTo(player.x - 150 - flicker, player.y - 330)
    ctx.lineTo(player.x + 150 + flicker, player.y - 330)
    ctx.lineTo(player.x + 18, player.y - 20)
    ctx.closePath()
    ctx.fill()
  }

  if (state.laserTimer > 0) {
    ctx.save()
    ctx.globalAlpha = 0.68 + Math.sin(performance.now() / 80) * 0.12
    ctx.shadowBlur = 22
    ctx.shadowColor = '#7bd6e8'
    ctx.fillStyle = '#7bd6e8'
    ctx.fillRect(player.x - 8, 0, 16, player.y)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(player.x - 3, 0, 6, player.y)
    ctx.restore()
  }
}

function drawPowerups() {
  for (const powerup of powerups) {
    ctx.save()
    ctx.translate(powerup.x + powerup.width / 2, powerup.y + powerup.height / 2)
    ctx.rotate(Math.sin(performance.now() / 320 + powerup.y) * 0.12)
    ctx.shadowBlur = 16
    ctx.shadowColor = powerupColor(powerup.type)
    ctx.fillStyle = powerupColor(powerup.type)
    ctx.beginPath()
    roundedRect(-16, -16, 32, 32, 8)
    ctx.fill()
    ctx.fillStyle = '#041016'
    ctx.font = '900 16px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labels = { life: '+', shield: 'S', credits: '$', emp: 'E', nuke: 'N', pulse: 'P', flame: 'F', laser: 'L', freeze: 'Z' }
    ctx.fillText(labels[powerup.type], 0, 1)
    ctx.restore()
  }
}

function drawMeteors() {
  ctx.save()
  for (const meteor of meteors) {
    const gradient = ctx.createRadialGradient(meteor.x, meteor.y, 2, meteor.x, meteor.y, meteor.radius)
    gradient.addColorStop(0, '#f4d35e')
    gradient.addColorStop(0.55, '#ff8b67')
    gradient.addColorStop(1, 'rgba(232, 93, 117, 0.1)')
    ctx.fillStyle = gradient
    ctx.shadowBlur = 20
    ctx.shadowColor = '#ff8b67'
    ctx.beginPath()
    ctx.arc(meteor.x, meteor.y, meteor.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 139, 103, 0.38)'
    ctx.beginPath()
    ctx.moveTo(meteor.x, meteor.y)
    ctx.lineTo(meteor.x - meteor.vx * 0.16, meteor.y - meteor.vy * 0.16)
    ctx.stroke()
  }
  ctx.restore()
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1)
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawFloatTexts() {
  ctx.save()
  ctx.font = '900 16px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const item of floatTexts) {
    ctx.globalAlpha = clamp(item.life / item.maxLife, 0, 1)
    ctx.fillStyle = item.color
    ctx.fillText(item.text, item.x, item.y)
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawEffects() {
  ctx.save()
  for (const effect of effects) {
    const alpha = clamp(effect.life / effect.maxLife, 0, 1)
    ctx.globalAlpha = alpha
    ctx.strokeStyle = effect.color
    ctx.fillStyle = effect.color
    ctx.shadowBlur = effect.type === 'shockwave' ? 28 : 18
    ctx.shadowColor = effect.color
    if (effect.type === 'shockwave') {
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.radius * alpha, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawBossBar() {
  const boss = enemies.find((enemy) => isBossType(enemy.type))
  if (!boss) return
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.fillRect(220, 22, 520, 10)
  ctx.fillStyle = enemyColor(boss.type)
  ctx.fillRect(220, 22, 520 * clamp(boss.hp / boss.maxHp, 0, 1), 10)
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 13px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(`${bossName(boss.type)} / WAVE ${state.wave}`, world.width / 2, 18)
}

function drawWaveStatus() {
  if (!state.running || state.over) return
  const mod = stageMods[state.stageMod] ?? stageMods.calm
  const statusText = `Wave ${state.wave}  ${mod.label}  敵群 ${state.currentSquad}/${state.squadsTotal}  剩 ${enemies.length}`
  ctx.font = '900 13px system-ui'
  const panelWidth = clamp(ctx.measureText(statusText).width + 30, 326, 650)
  ctx.save()
  ctx.fillStyle = 'rgba(5, 11, 18, 0.62)'
  ctx.beginPath()
  roundedRect(20, 18, panelWidth, 34, 8)
  ctx.fill()
  ctx.fillStyle = mod.color
  ctx.font = '900 13px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`Wave ${state.wave}  ${mod.label}  敵群 ${state.currentSquad}/${state.squadsTotal}  剩 ${enemies.length}`, 34, 35)
  ctx.restore()
}

function drawPaused() {
  if (!state.paused) return
  ctx.fillStyle = 'rgba(4, 10, 16, 0.55)'
  ctx.fillRect(0, 0, world.width, world.height)
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 42px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('暫停', world.width / 2, world.height / 2)
}

function drawScreenFlash() {
  if (state.screenFlash <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp(state.screenFlash, 0, 0.62)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, world.width, world.height)
  ctx.restore()
}

function draw() {
  ctx.save()
  if (state.screenShake > 0) ctx.translate(rand(-7, 7) * state.screenShake, rand(-7, 7) * state.screenShake)
  drawBackground()
  drawMeteors()
  drawPowerups()
  drawBullets()
  drawWeaponEffects()
  drawEffects()
  for (const enemy of enemies) drawEnemy(enemy)
  drawPlayer()
  drawParticles()
  drawFloatTexts()
  drawWaveStatus()
  drawBossBar()
  drawPaused()
  ctx.restore()
  drawScreenFlash()
}

function frame(time) {
  const rawDt = state.lastTime ? (time - state.lastTime) / 1000 : 0
  const dt = clamp(rawDt, 0, 0.033)
  state.lastTime = time
  update(dt)
  draw()
  requestAnimationFrame(frame)
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1
  canvas.width = world.width * ratio
  canvas.height = world.height * ratio
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function setButtonInput(buttonId, key) {
  const button = document.querySelector(buttonId)
  const down = (event) => {
    event.preventDefault()
    initAudio()
    if (key !== 'fire') playSfx('move')
    input[key] = true
    button.classList.add('pressed')
    if (key === 'fire') fireBullet()
  }
  const up = () => {
    input[key] = false
    button.classList.remove('pressed')
  }
  button.addEventListener('pointerdown', down)
  button.addEventListener('pointerup', up)
  button.addEventListener('pointercancel', up)
  button.addEventListener('pointerleave', up)
}

window.addEventListener('keydown', (event) => {
  initAudio()
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    if (!input.left) playSfx('move')
    input.left = true
  }
  if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    if (!input.right) playSfx('move')
    input.right = true
  }
  if (event.code === 'Space') {
    input.fire = true
    fireBullet()
    event.preventDefault()
  }
  if (event.code === 'KeyX') useSpecial()
  if (event.code === 'KeyZ') useOneShot('nuke')
  if (event.code === 'KeyC') useOneShot('flame')
  if (event.code === 'KeyV') useOneShot('laser')
  if (event.code === 'KeyB') useOneShot('freeze')
  if (event.code === 'KeyQ') useOneShot('pulse')
  if (event.code === 'KeyP') togglePause()
  if (event.code === 'KeyR') {
    playSfx('start')
    resetGame()
  }
  if (/^Digit[1-5]$/.test(event.code)) buyUpgrade(upgradeOrder[Number(event.code.slice(-1)) - 1])
})

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = false
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = false
  if (event.code === 'Space') input.fire = false
})

window.addEventListener('resize', resizeCanvas)
startButton.addEventListener('click', () => {
  initAudio()
  playSfx('start')
  resetGame()
})
restartButton.addEventListener('click', () => {
  initAudio()
  playSfx('start')
  resetGame()
})
nextWaveButton.addEventListener('click', () => {
  initAudio()
  startNextWave()
})
pauseButton.addEventListener('click', () => {
  initAudio()
  togglePause()
})
specialButton.addEventListener('click', () => {
  initAudio()
  useSpecial()
})
for (const [id, button] of Object.entries(oneShotButtons)) {
  button.addEventListener('click', () => {
    initAudio()
    useOneShot(id)
  })
}
for (const id of upgradeOrder) {
  upgradeEls[id].button.addEventListener('click', () => {
    initAudio()
    buyUpgrade(id)
  })
}
setButtonInput('#leftButton', 'left')
setButtonInput('#rightButton', 'right')
setButtonInput('#fireButton', 'fire')

resizeCanvas()
spawnStars()
applyUpgradeStats()
updateHud()
if (new URLSearchParams(window.location.search).has('autostart')) resetGame()
requestAnimationFrame(frame)
