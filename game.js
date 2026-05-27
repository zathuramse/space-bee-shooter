const canvas = document.querySelector('#game')
const ctx = canvas.getContext('2d')

const scoreEl = document.querySelector('#score')
const creditsEl = document.querySelector('#credits')
const waveEl = document.querySelector('#wave')
const livesEl = document.querySelector('#lives')
const shieldEl = document.querySelector('#shield')
const weaponEl = document.querySelector('#weapon')
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

const world = { width: 960, height: 620 }
const input = { left: false, right: false, fire: false }
const upgradeOrder = ['weapon', 'engine', 'hull', 'shield', 'drone']

const upgradeDefs = {
  weapon: { label: '武器', max: 6, base: 130, step: 105 },
  engine: { label: '引擎', max: 6, base: 110, step: 95 },
  hull: { label: '船體', max: 5, base: 150, step: 130 },
  shield: { label: '護盾', max: 5, base: 140, step: 115 },
  drone: { label: '僚機', max: 4, base: 180, step: 150 },
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
const powerups = []
const stars = []

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

function upgradeCost(id) {
  const def = upgradeDefs[id]
  return def.base + upgrades[id] * def.step
}

function applyUpgradeStats() {
  player.speed = 380 + upgrades.engine * 62
  state.maxLives = 2 + upgrades.hull
  state.maxShield = upgrades.shield
  state.lives = clamp(state.lives, 0, state.maxLives)
  state.shield = clamp(state.shield, 0, state.maxShield)
}

function resetGame() {
  state.running = true
  state.paused = false
  state.over = false
  state.betweenWaves = false
  state.score = 0
  state.credits = 80
  state.wave = 1
  state.lastTime = 0
  state.enemyDirection = 1
  state.enemyStepDown = 0
  state.enemyShotTimer = 1.1
  state.diveTimer = 2.4
  state.powerupTimer = 6
  state.droneTimer = 0
  state.specialCooldown = 0
  state.waveBonus = 0

  upgrades.weapon = 1
  upgrades.engine = 1
  upgrades.hull = 1
  upgrades.shield = 1
  upgrades.drone = 0
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
  powerups.length = 0
  pauseButton.textContent = '暫停'
  specialButton.textContent = 'EMP'
  spawnStars()
  spawnWave()
  startOverlay.classList.remove('active')
  waveOverlay.classList.remove('active')
  gameOverOverlay.classList.remove('active')
  updateHud()
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

function enemyStats(type) {
  const waveScale = Math.floor(state.wave / 3)
  const table = {
    scout: { hp: 1 + waveScale, width: 38, height: 30, score: 70, credit: 14, pattern: 'straight' },
    bee: { hp: 1 + waveScale, width: 44, height: 34, score: 95, credit: 18, pattern: 'aimed' },
    guard: { hp: 2 + waveScale, width: 48, height: 36, score: 130, credit: 24, pattern: 'spread' },
    sniper: { hp: 1 + waveScale, width: 40, height: 32, score: 150, credit: 28, pattern: 'snipe' },
    bomber: { hp: 3 + waveScale, width: 54, height: 40, score: 190, credit: 34, pattern: 'burst' },
    tank: { hp: 5 + waveScale * 2, width: 60, height: 44, score: 260, credit: 48, pattern: 'heavy' },
    boss: { hp: 32 + state.wave * 7, width: 142, height: 78, score: 1200, credit: 260, pattern: 'boss' },
  }
  return table[type]
}

function createEnemy(type, x, y, row = 0) {
  const stats = enemyStats(type)
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
    phase: rand(0, Math.PI * 2),
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
  state.enemyDirection = 1
  state.enemyStepDown = 0
  state.enemyShotTimer = clamp(1.05 - state.wave * 0.035, 0.42, 1.05)
  state.diveTimer = clamp(2.4 - state.wave * 0.07, 1.05, 2.4)
  state.powerupTimer = rand(6, 9)
  state.shield = state.maxShield
  player.invincible = 1.1

  if (state.wave % 5 === 0) {
    enemies.push(createEnemy('boss', world.width / 2, 112))
    const escortTypes = state.wave >= 10 ? ['sniper', 'guard', 'bee', 'guard', 'sniper'] : ['bee', 'guard', 'bee']
    escortTypes.forEach((type, index) => {
      enemies.push(createEnemy(type, 260 + index * 110, 222, 1))
    })
    return
  }

  const rows = clamp(3 + Math.floor(state.wave / 2), 3, 6)
  const cols = clamp(7 + Math.floor(state.wave / 3), 7, 11)
  const gapX = 70
  const gapY = 48
  const startX = (world.width - (cols - 1) * gapX) / 2
  const startY = 72

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let type = row === 0 ? 'bee' : row < 3 ? 'scout' : 'guard'
      if (state.wave >= 3 && row === 0 && col % 3 === 0) type = 'sniper'
      if (state.wave >= 4 && row === rows - 1 && col % 2 === 0) type = 'bomber'
      if (state.wave >= 7 && row === rows - 1 && col % 4 === 0) type = 'tank'
      enemies.push(createEnemy(type, startX + col * gapX, startY + row * gapY, row))
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
  specialButton.textContent = state.specialCooldown > 0 ? Math.ceil(state.specialCooldown).toString() : 'EMP'
  syncUpgradeCards()
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

function buyUpgrade(id) {
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
  updateHud()
}

function bulletPattern() {
  const level = upgrades.weapon
  if (level === 1) return [{ x: 0, dx: 0, damage: 1, size: 8 }]
  if (level === 2) return [{ x: -12, dx: 0, damage: 1, size: 8 }, { x: 12, dx: 0, damage: 1, size: 8 }]
  if (level === 3) return [{ x: -18, dx: -70, damage: 1, size: 8 }, { x: 0, dx: 0, damage: 1, size: 9 }, { x: 18, dx: 70, damage: 1, size: 8 }]
  if (level === 4) return [{ x: -24, dx: -115, damage: 1, size: 8 }, { x: -8, dx: -25, damage: 1, size: 8 }, { x: 8, dx: 25, damage: 1, size: 8 }, { x: 24, dx: 115, damage: 1, size: 8 }]
  return [
    { x: -28, dx: -145, damage: 1, size: 8 },
    { x: -12, dx: -48, damage: 1, size: 8 },
    { x: 0, dx: 0, damage: level >= 6 ? 3 : 2, size: level >= 6 ? 13 : 11 },
    { x: 12, dx: 48, damage: 1, size: 8 },
    { x: 28, dx: 145, damage: 1, size: 8 },
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

  player.cooldown = cooldown
}

function fireDrone() {
  if (upgrades.drone <= 0 || !state.running || state.paused || state.betweenWaves) return
  const offset = 38
  const droneCount = clamp(upgrades.drone, 1, 4)
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
      damage: 1,
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
  if (enemy.pattern === 'straight') {
    spawnEnemyBullet(enemy.x, enemy.y + 18, rand(-30, 30), speed)
  } else if (enemy.pattern === 'aimed') {
    const aim = aimVector(enemy.x, enemy.y, player.x, player.y, speed + 40)
    spawnEnemyBullet(enemy.x, enemy.y + 18, aim.vx, aim.vy)
  } else if (enemy.pattern === 'spread') {
    for (const angle of [-0.38, 0, 0.38]) spawnEnemyBullet(enemy.x, enemy.y + 18, Math.sin(angle) * speed, Math.cos(angle) * speed)
  } else if (enemy.pattern === 'snipe') {
    const aim = aimVector(enemy.x, enemy.y, player.x, player.y, speed + 120)
    spawnEnemyBullet(enemy.x, enemy.y + 18, aim.vx, aim.vy, 8, '#f4d35e')
  } else if (enemy.pattern === 'burst') {
    for (const angle of [-0.62, -0.28, 0.28, 0.62]) spawnEnemyBullet(enemy.x, enemy.y + 18, Math.sin(angle) * speed, Math.cos(angle) * speed, 11, '#ff8b67')
  } else if (enemy.pattern === 'heavy') {
    for (const angle of [-0.22, 0.22]) spawnEnemyBullet(enemy.x, enemy.y + 20, Math.sin(angle) * (speed + 25), Math.cos(angle) * (speed + 25), 15, '#b987ff')
  } else if (enemy.pattern === 'boss') {
    const ring = 7 + Math.floor(state.wave / 5)
    for (let index = 0; index < ring; index += 1) {
      const angle = -0.82 + (index / Math.max(1, ring - 1)) * 1.64
      spawnEnemyBullet(enemy.x, enemy.y + 34, Math.sin(angle) * (speed + 20), Math.cos(angle) * (speed + 20), 12, '#b987ff')
    }
    const aim = aimVector(enemy.x, enemy.y, player.x, player.y, speed + 85)
    spawnEnemyBullet(enemy.x, enemy.y + 34, aim.vx, aim.vy, 13, '#f4d35e')
  }
}

function startDive(enemy) {
  if (!enemy || enemy.diving || enemy.type === 'boss' || enemy.type === 'tank') return
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

function spawnPowerup() {
  const roll = Math.random()
  const type = roll > 0.78 ? 'life' : roll > 0.55 ? 'shield' : roll > 0.32 ? 'credits' : 'emp'
  powerups.push({ x: rand(80, world.width - 80), y: -28, width: 30, height: 30, vy: 110, type })
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
  player.x = clamp(player.x + move * player.speed * dt, 36, world.width - 36)
  player.cooldown = Math.max(0, player.cooldown - dt)
  player.invincible = Math.max(0, player.invincible - dt)
  state.specialCooldown = Math.max(0, state.specialCooldown - dt)
  state.droneTimer = Math.max(0, state.droneTimer - dt)

  if (input.fire) fireBullet()
  if (state.droneTimer === 0) {
    fireDrone()
    state.droneTimer = clamp(0.78 - upgrades.drone * 0.08, 0.42, 0.78)
  }
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
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
    if (bullet.y > world.height + 70 || bullet.x < -70 || bullet.x > world.width + 70) enemyBullets.splice(index, 1)
  }
}

function updateEnemies(dt) {
  const speed = 32 + state.wave * 6
  let edgeHit = false

  for (const enemy of enemies) {
    if (enemy.type === 'boss') {
      enemy.baseX += (42 + state.wave * 2) * state.enemyDirection * dt
      enemy.x = enemy.baseX
      enemy.y = enemy.baseY + Math.sin(performance.now() / 520 + enemy.phase) * 14
      if (enemy.x < 118 || enemy.x > world.width - 118) edgeHit = true
      continue
    }

    if (!enemy.diving) {
      enemy.baseX += speed * state.enemyDirection * dt
      enemy.x = enemy.baseX + Math.sin(performance.now() / 320 + enemy.phase) * (8 + enemy.row)
      enemy.y = enemy.baseY + Math.cos(performance.now() / 470 + enemy.phase) * 5 + state.enemyStepDown
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
    state.enemyShotTimer = clamp((0.98 - state.wave * 0.034) * shooter.fireBias, 0.34, 1.05)
  }

  state.diveTimer -= dt
  if (state.diveTimer <= 0 && enemies.length > 0) {
    const candidates = enemies.filter((enemy) => !enemy.diving && ['scout', 'bee', 'sniper', 'bomber'].includes(enemy.type))
    startDive(candidates[Math.floor(rand(0, candidates.length))])
    state.diveTimer = clamp(2.45 - state.wave * 0.08, 0.92, 2.45)
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
      if (powerup.type === 'credits') state.credits += 120 + state.wave * 12
      if (powerup.type === 'emp') state.specialCooldown = 0
      spawnExplosion(powerup.x + 15, powerup.y + 15, powerupColor(powerup.type), 18)
      powerups.splice(index, 1)
      updateHud()
    }
  }
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

function resolveCollisions() {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = bullets[bulletIndex]
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = enemies[enemyIndex]
      const box = { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height }
      if (!rectsOverlap(bullet, box)) continue

      bullets.splice(bulletIndex, 1)
      enemy.hp -= bullet.damage
      spawnExplosion(bullet.x + bullet.width / 2, bullet.y, bullet.color, 7)

      if (enemy.hp <= 0) {
        state.score += enemy.score + state.wave * 10
        state.credits += enemy.credit
        spawnExplosion(enemy.x, enemy.y, enemyColor(enemy.type), enemy.type === 'boss' ? 48 : 18)
        enemies.splice(enemyIndex, 1)
        updateHud()
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

  if (enemies.length === 0 && state.running && !state.betweenWaves) completeWave()
}

function completeWave() {
  state.betweenWaves = true
  state.waveBonus = 180 + state.wave * 55
  state.score += 500 + state.wave * 35
  state.credits += state.waveBonus
  player.invincible = 1.2
  waveTitle.textContent = state.wave % 5 === 0 ? 'Boss 擊破' : `第 ${state.wave} 波清除`
  waveText.textContent = `獲得 ${state.waveBonus} 晶片。建議先升武器或引擎，再進入第 ${state.wave + 1} 波。`
  waveOverlay.classList.add('active')
  updateHud()
}

function startNextWave() {
  if (!state.running || state.over || !state.betweenWaves) return
  state.wave += 1
  state.betweenWaves = false
  waveOverlay.classList.remove('active')
  spawnWave()
  updateHud()
}

function damagePlayer() {
  if (player.invincible > 0 || state.over || state.betweenWaves) return
  if (state.shield > 0) {
    state.shield -= 1
    player.invincible = 0.75
    spawnExplosion(player.x, player.y, '#35c4df', 18)
    updateHud()
    return
  }

  state.lives -= 1
  player.invincible = 1.45
  spawnExplosion(player.x, player.y, '#e85d75', 30)
  updateHud()
  if (state.lives <= 0) endGame()
}

function useSpecial() {
  if (!state.running || state.paused || state.over || state.betweenWaves || state.specialCooldown > 0) return
  enemyBullets.length = 0
  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index]
    enemy.hp -= 3 + upgrades.weapon
    spawnExplosion(enemy.x, enemy.y, '#b987ff', 8)
    if (enemy.hp <= 0) {
      state.score += Math.floor(enemy.score * 0.7)
      state.credits += Math.floor(enemy.credit * 0.7)
      enemies.splice(index, 1)
    }
  }
  state.specialCooldown = clamp(14 - upgrades.shield - upgrades.drone, 7, 14)
  spawnExplosion(player.x, player.y - 40, '#b987ff', 54)
  updateHud()
}

function endGame() {
  state.running = false
  state.over = true
  resultTitle.textContent = state.wave >= 8 ? '漂亮撤離' : '任務結束'
  resultText.textContent = `分數 ${state.score.toLocaleString()}，抵達第 ${state.wave} 波，剩餘晶片 ${state.credits.toLocaleString()}`
  gameOverOverlay.classList.add('active')
}

function togglePause() {
  if (!state.running || state.over || state.betweenWaves) return
  state.paused = !state.paused
  pauseButton.textContent = state.paused ? '繼續' : '暫停'
}

function update(dt) {
  if (!state.running || state.paused || state.betweenWaves) {
    updateStars(dt)
    updateParticles(dt)
    return
  }

  updateStars(dt)
  updatePlayer(dt)
  updateBullets(dt)
  updateEnemies(dt)
  updatePowerups(dt)
  updateParticles(dt)
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
    boss: '#e85d75',
  }
  return colors[type] ?? '#7bd6e8'
}

function powerupColor(type) {
  const colors = { life: '#7fe58b', shield: '#35c4df', credits: '#f4d35e', emp: '#b987ff' }
  return colors[type] ?? '#35c4df'
}

function drawBackground() {
  ctx.fillStyle = '#050b12'
  ctx.fillRect(0, 0, world.width, world.height)
  for (const star of stars) {
    ctx.globalAlpha = star.alpha
    ctx.fillStyle = '#dff8ff'
    ctx.fillRect(star.x, star.y, star.size, star.size)
  }
  ctx.globalAlpha = 1
  const gradient = ctx.createLinearGradient(0, 0, 0, world.height)
  gradient.addColorStop(0, 'rgba(53, 196, 223, 0.08)')
  gradient.addColorStop(0.62, 'rgba(232, 93, 117, 0.04)')
  gradient.addColorStop(1, 'rgba(244, 211, 94, 0.08)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, world.width, world.height)
}

function drawPlayer() {
  ctx.save()
  ctx.translate(player.x, player.y)
  if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) ctx.globalAlpha = 0.42

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
  ctx.ellipse(0, -7, 10 + upgrades.hull, 14, 0, 0, Math.PI * 2)
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
  for (let index = 0; index < upgrades.drone; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const lane = Math.ceil((index + 1) / 2)
    const x = side * 38 * lane
    const y = 8 + lane * 8
    ctx.fillStyle = '#7fe58b'
    ctx.beginPath()
    ctx.ellipse(x, y, 8, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawEnemy(enemy) {
  ctx.save()
  ctx.translate(enemy.x, enemy.y)
  const color = enemyColor(enemy.type)
  ctx.fillStyle = color

  if (enemy.type === 'boss') {
    ctx.beginPath()
    roundedRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height, 18)
    ctx.fill()
    ctx.fillStyle = '#071019'
    ctx.fillRect(-42, -8, 22, 14)
    ctx.fillRect(20, -8, 22, 14)
    ctx.fillStyle = '#f4d35e'
    ctx.fillRect(-48, 22, 96, 6)
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

  if (enemy.maxHp > 2) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(-enemy.width / 2, enemy.height / 2 + 7, enemy.width, 5)
    ctx.fillStyle = '#7fe58b'
    ctx.fillRect(-enemy.width / 2, enemy.height / 2 + 7, enemy.width * clamp(enemy.hp / enemy.maxHp, 0, 1), 5)
  }
  ctx.restore()
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.fillStyle = bullet.color
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
  }
  for (const bullet of enemyBullets) {
    ctx.fillStyle = bullet.color
    ctx.beginPath()
    ctx.ellipse(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, bullet.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPowerups() {
  for (const powerup of powerups) {
    ctx.save()
    ctx.translate(powerup.x + 15, powerup.y + 15)
    ctx.fillStyle = powerupColor(powerup.type)
    ctx.beginPath()
    roundedRect(-15, -15, 30, 30, 7)
    ctx.fill()
    ctx.fillStyle = '#041016'
    ctx.font = '900 16px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labels = { life: '+', shield: 'S', credits: '$', emp: 'E' }
    ctx.fillText(labels[powerup.type], 0, 1)
    ctx.restore()
  }
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

function drawBossBar() {
  const boss = enemies.find((enemy) => enemy.type === 'boss')
  if (!boss) return
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.fillRect(220, 22, 520, 10)
  ctx.fillStyle = '#e85d75'
  ctx.fillRect(220, 22, 520 * clamp(boss.hp / boss.maxHp, 0, 1), 10)
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 13px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(`BOSS WAVE ${state.wave}`, world.width / 2, 18)
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

function draw() {
  drawBackground()
  drawPowerups()
  drawBullets()
  for (const enemy of enemies) drawEnemy(enemy)
  drawPlayer()
  drawParticles()
  drawBossBar()
  drawPaused()
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
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = true
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = true
  if (event.code === 'Space') {
    input.fire = true
    fireBullet()
    event.preventDefault()
  }
  if (event.code === 'KeyX') useSpecial()
  if (event.code === 'KeyP') togglePause()
  if (event.code === 'KeyR') resetGame()
  if (/^Digit[1-5]$/.test(event.code)) buyUpgrade(upgradeOrder[Number(event.code.slice(-1)) - 1])
})

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = false
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = false
  if (event.code === 'Space') input.fire = false
})

window.addEventListener('resize', resizeCanvas)
startButton.addEventListener('click', resetGame)
restartButton.addEventListener('click', resetGame)
nextWaveButton.addEventListener('click', startNextWave)
pauseButton.addEventListener('click', togglePause)
specialButton.addEventListener('click', useSpecial)
for (const id of upgradeOrder) upgradeEls[id].button.addEventListener('click', () => buyUpgrade(id))
setButtonInput('#leftButton', 'left')
setButtonInput('#rightButton', 'right')
setButtonInput('#fireButton', 'fire')

resizeCanvas()
spawnStars()
applyUpgradeStats()
updateHud()
if (new URLSearchParams(window.location.search).has('autostart')) resetGame()
requestAnimationFrame(frame)
