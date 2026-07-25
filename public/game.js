const byId = id => document.getElementById(id);
const canvas = byId("gameCanvas");
const ctx = canvas.getContext("2d");
const ui = {
  startScreen: byId("startScreen"),
  messageScreen: byId("messageScreen"),
  deathArt: byId("deathArt"),
  messageEyebrow: byId("messageEyebrow"),
  messageTitle: byId("messageTitle"),
  messageText: byId("messageText"),
  messageButton: byId("messageButton"),
  score: byId("score"),
  lives: byId("lives"),
  levelNumber: byId("levelNumber"),
  levelName: byId("levelName"),
  ammo: byId("ammo"),
  soundButton: byId("soundButton"),
  homeButton: byId("homeButton"),
  mobileControls: document.querySelector(".mobile-controls"),
  duckButton: byId("duckButton")
};
const levelSteps = document.querySelectorAll(".level-step");
const levelTracks = document.querySelectorAll(".track");

const W = canvas.width;
const H = canvas.height;
const GROUND = 425;
const MAX_LIVES = 10;
// Longer stages give each world time to introduce more enemy groups.
const LEVEL_LENGTH = 16000;
const levels = [
  { name: "ZOMBIE ZONE", sky: ["#9fe7ef", "#f6f2a5"], ground: "#75c95e", far: "#70c7b2", enemy: "zombie", speed: 5.9 },
  { name: "NINJA NIGHT", sky: ["#4a3c92", "#ef8cc7"], ground: "#42336f", far: "#7655a5", enemy: "ninja", speed: 6.7 },
  { name: "DRAGON CASTLE", sky: ["#ffb35b", "#ffdf84"], ground: "#765143", far: "#9a6382", enemy: "dragon", speed: 7.5 },
  { name: "BISON BLITZ", sky: ["#72c9ed", "#ffe291"], ground: "#c79b47", far: "#d4af61", enemy: "bison", speed: 7.9 },
  { name: "DINO DANGER", sky: ["#f58b62", "#f8d57a"], ground: "#55713c", far: "#476a48", enemy: "trex", speed: 8.3 },
  { name: "STORM STRIKE", sky: ["#30355f", "#7585a5"], ground: "#46516a", far: "#59627e", enemy: "storm", speed: 8.6, length: 24000 }
];
const levelIntros = [
  "",
  "Silent ninjas ahead. Stay sharp!",
  "Zombie dragons and knights! You've got this!",
  "Stampeding bison ahead—jump, duck, and hold on to your shell!",
  "The T. rexes are loose—and they're hungry! Watch those chomping jaws!",
  "Lightning from above and tornadoes below—blast the bolts and leap the twisters!"
];

let audioCtx;
let soundOn = true;
let state = "menu";
let lastTime = 0;
let distance = 0;
let level = 0;
let selectedStartLevel = 0;
let score = 0;
let lives = MAX_LIVES;
let ammo = 0;
let spawnTimer = 100;
let ammoTimer = 230;
let fruitTimer = 620;
let shake = 0;
let flash = 0;
let player;
let enemies = [];
let shots = [];
let ammoBoxes = [];
let fruits = [];
let particles = [];

function currentLevelLength() {
  return levels[level].length || LEVEL_LENGTH;
}

function resetPlayer() {
  player = { x: 145, y: GROUND - 72, w: 58, h: 72, vy: 0, grounded: true, ducking: false, cooldown: 0, invincible: 0, bob: 0 };
}

function resetGame(startLevel = 0) {
  level = startLevel;
  score = 0;
  lives = MAX_LIVES;
  ammo = 0;
  distance = 0;
  enemies = [];
  shots = [];
  ammoBoxes = [];
  fruits = [];
  particles = [];
  spawnTimer = 130;
  ammoTimer = 210;
  fruitTimer = 520;
  resetPlayer();
  updateHud();
  updateTracker();
}

function startGame(startLevel = selectedStartLevel) {
  selectedStartLevel = startLevel;
  initAudio();
  resetGame(startLevel);
  state = "playing";
  ui.startScreen.classList.add("hidden");
  ui.messageScreen.classList.add("hidden");
  ui.mobileControls.classList.remove("hidden");
}

function goHome() {
  selectedStartLevel = 0;
  resetGame(0);
  state = "menu";
  ui.messageScreen.classList.add("hidden");
  ui.deathArt.classList.add("hidden");
  ui.startScreen.classList.remove("hidden");
  ui.mobileControls.classList.add("hidden");
}

function jump() {
  if (state !== "playing") return;
  initAudio();
  if (player.grounded) {
    player.ducking = false;
    player.vy = -15.5; player.grounded = false; beep(300, .07, "sine", .08); beep(470, .08, "sine", .05, .05);
  }
}

function blast() {
  if (state !== "playing" || player.cooldown > 0) return;
  initAudio(); player.cooldown = 22;
  if (ammo <= 0) {
    beep(95, .08, "square", .035);
    return;
  }
  ammo--;
  shots.push({ x: player.x + 56, y: player.y + 37, w: 25, h: 7, speed: 14 });
  for (let i = 0; i < 5; i++) particles.push(makeParticle(player.x + 62, player.y + 40, "#ffd84d", 3));
  beep(610, .05, "square", .045); beep(180, .09, "sawtooth", .035, .02);
  updateHud();
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, duration, type = "sine", volume = .04, delay = 0) {
  if (!soundOn || !audioCtx) return;
  const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + delay + duration);
  osc.connect(gain).connect(audioCtx.destination); osc.start(audioCtx.currentTime + delay); osc.stop(audioCtx.currentTime + delay + duration);
}

function spawnEnemy() {
  const levelEnemy = levels[level].enemy;
  const addEnemy = (extraX = 0) => {
    const type = levelEnemy === "storm" ? (Math.random() < .48 ? "lightning" : "tornado") : levelEnemy;
    const isDragon = type === "dragon";
    const isBison = type === "bison";
    const isTrex = type === "trex";
    const isLightning = type === "lightning";
    const isTornado = type === "tornado";
    const h = isLightning ? 320 : isTornado ? 118 : isDragon ? 91 : isTrex ? 107 : isBison ? 72 : type === "ninja" ? 66 : 64;
    const flying = isDragon;
    const baseY = flying ? GROUND - 112 - Math.random() * 22 : GROUND - h;
    enemies.push({
      type, variant: Math.floor(Math.random() * 3), x: W + 35 + extraX,
      y: baseY, baseY, w: isLightning ? 62 : isTornado ? 76 : isDragon ? 112 : isTrex ? 158 : isBison ? 96 : 55,
      h, phase: Math.random() * 6, hit: false, flying,
      chargeSpeed: isBison ? 2.2 + Math.random() * 1.4 : isTrex ? 1.1 + Math.random() * .8 : isTornado ? 1.5 + Math.random() : 0
    });
  };
  addEnemy();
  const progress = distance / currentLevelLength();
  // Busy but fair groups: pairs are common, with the occasional spaced-out trio.
  const groupGap = (levelEnemy === "storm" ? 225 : levelEnemy === "trex" ? 205 : 155) + Math.random() * 35;
  if (Math.random() < .4 + level * .07 + progress * .12) addEnemy(groupGap);
  if (Math.random() < .08 + level * .04 + progress * .07) addEnemy(groupGap * 2);
  spawnTimer = Math.max(52, 106 - level * 9 - progress * 17) + Math.random() * 42;
}

function spawnAmmoBox() {
  // Boxes float high enough that Eggbert has to leave the ground to collect them.
  ammoBoxes.push({ x: W + 50, y: GROUND - 126 - Math.random() * 28, w: 44, h: 44, phase: Math.random() * 6 });
  ammoTimer = 390 + Math.random() * 170;
}

function spawnFruit() {
  fruits.push({
    x: W + 55, y: GROUND - 112 - Math.random() * 50, w: 38, h: 42,
    type: Math.floor(Math.random() * 3), phase: Math.random() * 6
  });
  // Health is helpful but stays rarer than ammunition.
  fruitTimer = 720 + Math.random() * 390;
}

function makeParticle(x, y, color, power = 5) {
  return { x, y, vx: (Math.random() - .5) * power * 2, vy: (Math.random() - .7) * power, life: 25 + Math.random() * 18, color, size: 2 + Math.random() * 5 };
}

function hitPlayer(enemy) {
  if (player.invincible > 0 || enemy.hit) return;
  enemy.hit = true; lives--; shake = 11; player.invincible = 100; player.vy = -9; player.grounded = false;
  for (let i = 0; i < 15; i++) particles.push(makeParticle(player.x + 30, player.y + 35, i % 2 ? "#fff" : "#ff5b87", 7));
  beep(130, .2, "sawtooth", .07); updateHud();
  if (lives <= 0) endGame(false);
}

function stompEnemy(enemy) {
  enemy.hit = true;
  player.vy = -10.5;
  player.grounded = false;
  score += enemy.type === "lightning" ? 450 : enemy.type === "trex" ? 400 : enemy.type === "dragon" ? 300 : 150;
  const color = enemy.type === "lightning" ? "#fff25b" : enemy.type === "tornado" ? "#a9d9e8" : enemy.type === "zombie" ? "#78d65c" : enemy.type === "ninja" ? "#b568e2" : enemy.type === "bison" ? "#9a653e" : enemy.type === "trex" ? "#4f9255" : "#ff704d";
  for (let i = 0; i < 18; i++) particles.push(makeParticle(enemy.x + enemy.w / 2, enemy.y + 8, i % 3 ? color : "#ffd84d", 7));
  beep(180, .07, "square", .055);
  beep(360, .1, "sine", .045, .04);
  updateHud();
}

function setMessage({ eyebrow, title, text, button, icon, showDeathArt = false }) {
  ui.messageEyebrow.textContent = eyebrow;
  ui.messageTitle.textContent = title;
  ui.messageText.textContent = text;
  ui.messageButton.textContent = `${button} `;

  const iconEl = document.createElement("span");
  iconEl.textContent = icon;
  ui.messageButton.append(iconEl);
  ui.deathArt.classList.toggle("hidden", !showDeathArt);
}

function endGame(won) {
  state = won ? "won" : "gameover";
  ui.mobileControls.classList.add("hidden");
  player.dead = !won;
  const paddedScore = String(score).padStart(5, "0");

  setMessage({
    eyebrow: won ? "THE COOP IS SAVED!" : "DOUBLE YOLK DISASTER!",
    title: won ? "Egg-cellent!" : "YOU GOT YOLKED",
    text: won
      ? `You scored ${paddedScore} points and became a coop legend!`
      : `You scored ${paddedScore} points. The coop still believes in you!`,
    button: won ? "PLAY AGAIN" : "TRY AGAIN",
    icon: "↻",
    showDeathArt: !won
  });

  setTimeout(() => ui.messageScreen.classList.remove("hidden"), 350);
  if (won) { beep(523, .12, "sine", .06); beep(659, .12, "sine", .06, .13); beep(784, .25, "sine", .06, .26); }
}

function nextLevel() {
  // Do not advance beyond the last valid level: rendering continues behind the
  // victory screen, and an out-of-range index would stop the animation loop.
  if (level >= levels.length - 1) { endGame(true); return; }
  level++;
  state = "transition";
  ui.mobileControls.classList.add("hidden");
  enemies = [];
  shots = [];
  ammoBoxes = [];
  fruits = [];
  distance = 0;
  spawnTimer = 120;
  ammoTimer = 180;
  fruitTimer = 430;
  updateHud();
  updateTracker();

  setMessage({
    eyebrow: `LEVEL ${level + 1}`,
    title: levels[level].name,
    text: levelIntros[level],
    button: "LET'S GO!",
    icon: "▶"
  });
  ui.messageScreen.classList.remove("hidden");
}

function continueLevel() {
  resetPlayer();
  state = "playing";
  ui.messageScreen.classList.add("hidden");
  ui.mobileControls.classList.remove("hidden");
}

function updateHud() {
  ui.score.textContent = String(score).padStart(5, "0");
  ui.ammo.textContent = ammo;
  ui.lives.textContent = "♥ ".repeat(lives).trim() + " ♡ ".repeat(MAX_LIVES - lives).trim();
  ui.lives.setAttribute("aria-label", `${lives} lives`);
  ui.levelNumber.textContent = `LEVEL ${level + 1}`;
  ui.levelName.textContent = levels[level].name;
}

function updateTracker() {
  levelSteps.forEach((step, i) => {
    step.classList.toggle("active", i === level);
    step.classList.toggle("done", i < level);
  });
  levelTracks.forEach((track, i) => track.classList.toggle("done", i < level));
}

function rectsOverlap(a, b, pad = 0) {
  return a.x + pad < b.x + b.w - pad && a.x + a.w - pad > b.x + pad && a.y + pad < b.y + b.h - pad && a.y + a.h - pad > b.y + pad;
}

function playerHitbox() {
  if (player.ducking && player.grounded) return { x: player.x + 2, y: player.y + 30, w: player.w - 4, h: player.h - 30 };
  return player;
}

function update(dt) {
  if (state !== "playing") return;
  const scale = Math.min(dt / 16.67, 1.7);
  const speed = levels[level].speed + Math.min(1.35, distance / currentLevelLength() * 1.35);
  distance += speed * scale; score += Math.floor(speed * scale * .25); player.bob += .14 * scale;
  player.cooldown = Math.max(0, player.cooldown - scale); player.invincible = Math.max(0, player.invincible - scale);
  player.vy += .82 * scale; player.y += player.vy * scale;
  if (player.y >= GROUND - player.h) { player.y = GROUND - player.h; player.vy = 0; player.grounded = true; }
  spawnTimer -= scale;
  if (spawnTimer <= 0) spawnEnemy();
  ammoTimer -= scale;
  if (ammoTimer <= 0) spawnAmmoBox();
  fruitTimer -= scale;
  if (fruitTimer <= 0) spawnFruit();
  enemies.forEach(e => {
    e.x -= (speed + e.chargeSpeed) * scale;
    e.phase += .09 * scale;
    if (e.type === "zombie") {
      // Zombies make goofy, springy hops with a brief beat on the ground.
      e.y = e.baseY - Math.max(0, Math.sin(e.phase)) * 48;
    } else if (e.type === "ninja") {
      // Ninjas leap higher and faster than zombies.
      e.y = e.baseY - Math.max(0, Math.sin(e.phase * 1.22)) * 68;
    } else if (e.flying) {
      // Dragons follow a steady flight wave without drifting off screen.
      e.y = e.baseY + Math.sin(e.phase) * 24;
    } else if (e.type === "bison") {
      // Charging bison pound the ground as they rush toward Eggbert.
      e.y = e.baseY - Math.abs(Math.sin(e.phase * 2.4)) * 5;
    } else if (e.type === "trex") {
      // T. rexes sprint with heavy, alternating strides.
      e.y = e.baseY - Math.abs(Math.sin(e.phase * 2.7)) * 4;
      const jawOpen = Math.sin(e.phase * 4.4) > 0;
      if (e.jawOpen && !jawOpen && e.x > 190 && e.x < 650) {
        beep(82, .055, "square", .025);
        beep(58, .07, "sawtooth", .02, .025);
      }
      e.jawOpen = jawOpen;
    } else if (e.type === "tornado") {
      e.y = e.baseY - Math.abs(Math.sin(e.phase * 2.8)) * 6;
    } else if (e.type === "lightning") {
      e.y = e.baseY + Math.sin(e.phase * 5) * 3;
    }
  });
  ammoBoxes.forEach(box => { box.x -= speed * scale; box.phase += .08 * scale; });
  fruits.forEach(fruit => { fruit.x -= speed * scale; fruit.phase += .075 * scale; });
  shots.forEach(s => s.x += s.speed * scale);
  particles.forEach(p => { p.x += p.vx * scale; p.y += p.vy * scale; p.vy += .25 * scale; p.life -= scale; });

  shots.forEach(s => enemies.forEach(e => {
    if (!e.hit && rectsOverlap(s, e, 4)) {
      e.hit = true; s.x = W + 100; score += e.type === "lightning" ? 350 : e.type === "tornado" ? 275 : e.type === "dragon" ? 250 : e.type === "trex" ? 300 : e.type === "bison" ? 200 : 100; flash = 3;
      const color = e.type === "lightning" ? "#fff25b" : e.type === "tornado" ? "#a9d9e8" : e.type === "zombie" ? "#78d65c" : e.type === "ninja" ? "#b568e2" : e.type === "bison" ? "#9a653e" : e.type === "trex" ? "#4f9255" : "#ff704d";
      for (let i = 0; i < 16; i++) particles.push(makeParticle(e.x + e.w / 2, e.y + e.h / 2, color, 7));
      beep(250, .07, "square", .045); updateHud();
    }
  }));
  enemies.forEach(e => {
    const heroBox = playerHitbox();
    if (e.hit || !rectsOverlap(heroBox, e, 7)) return;
    const playerBottom = heroBox.y + heroBox.h;
    const landingOnHead = player.vy > 1.5 && playerBottom <= e.y + Math.min(30, e.h * .45);
    if (landingOnHead) stompEnemy(e);
    else hitPlayer(e);
  });
  ammoBoxes.forEach(box => {
    const hitbox = { ...box, y: box.y + Math.sin(box.phase) * 5 };
    if (!box.collected && rectsOverlap(playerHitbox(), hitbox, 3)) {
      box.collected = true; ammo += 5; score += 50;
      for (let i = 0; i < 14; i++) particles.push(makeParticle(box.x + 22, box.y + 22, i % 2 ? "#ffd84d" : "#6c42d8", 6));
      beep(520, .07, "sine", .055); beep(760, .12, "sine", .05, .07); updateHud();
    }
  });
  fruits.forEach(fruit => {
    const hitbox = { ...fruit, y: fruit.y + Math.sin(fruit.phase) * 6 };
    if (!fruit.collected && rectsOverlap(playerHitbox(), hitbox, 3)) {
      fruit.collected = true;
      if (lives < MAX_LIVES) lives++;
      else score += 125;
      for (let i = 0; i < 16; i++) particles.push(makeParticle(fruit.x + 19, fruit.y + 20, i % 2 ? "#ff5b87" : "#ffd84d", 6));
      beep(440, .07, "sine", .05); beep(660, .08, "sine", .05, .06); beep(880, .12, "sine", .04, .12); updateHud();
    }
  });
  enemies = enemies.filter(e => e.x + e.w > -30 && !e.hit);
  ammoBoxes = ammoBoxes.filter(box => box.x + box.w > -30 && !box.collected);
  fruits = fruits.filter(fruit => fruit.x + fruit.w > -30 && !fruit.collected);
  shots = shots.filter(s => s.x < W + 40);
  particles = particles.filter(p => p.life > 0);
  shake *= .82; flash = Math.max(0, flash - 1); updateHud();
  if (distance >= currentLevelLength()) nextLevel();
}

function roundedRect(x, y, w, h, r, fill, stroke = null, line = 3) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function drawBackground() {
  const l = levels[level];
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND); grad.addColorStop(0, l.sky[0]); grad.addColorStop(1, l.sky[1]); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  const offset = -(distance * .14 % 280);
  if (level === 0) {
    ctx.fillStyle = "rgba(255,255,255,.72)";
    let cloudIndex = 0;
    for (let x = offset - 100; x < W + 200; x += 280) {
      drawCloud(x, 82 + (cloudIndex % 3) * 22);
      cloudIndex++;
    }
    ctx.fillStyle = l.far; ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = -120 + offset; x < W + 250; x += 170) ctx.quadraticCurveTo(x + 80, 275, x + 170, GROUND);
    ctx.fill();
  } else if (level === 1) {
    ctx.fillStyle = "#ffe8a6"; ctx.beginPath(); ctx.arc(770, 105, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(37,25,83,.45)";
    for (let x = offset - 80; x < W + 180; x += 210) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + 95, 210); ctx.lineTo(x + 205, GROUND); ctx.fill(); }
    ctx.fillStyle = "#251953"; for (let x = offset; x < W + 100; x += 190) { ctx.fillRect(x, 335, 45, 90); ctx.fillRect(x - 18, 326, 81, 12); }
  } else if (level === 2) {
    ctx.fillStyle = "rgba(111,54,74,.45)";
    for (let x = offset - 100; x < W + 250; x += 250) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + 110, 170); ctx.lineTo(x + 240, GROUND); ctx.fill(); }
    ctx.fillStyle = "#684453";
    for (let x = offset; x < W + 150; x += 330) { ctx.fillRect(x, 270, 180, 155); ctx.fillRect(x - 20, 245, 55, 180); ctx.fillRect(x + 145, 245, 55, 180); }
  } else if (level === 3) {
    // Wide prairie for the bison stampede finale.
    ctx.fillStyle = "rgba(255,255,255,.76)";
    for (let x = offset - 120; x < W + 220; x += 300) drawCloud(x, 75 + ((x / 300) % 2) * 30);
    ctx.fillStyle = "#ddbd66"; ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = -100 + offset; x < W + 220; x += 220) ctx.quadraticCurveTo(x + 110, 310, x + 220, GROUND);
    ctx.fill();
    ctx.fillStyle = "#6c713b";
    for (let x = offset * 1.7; x < W + 100; x += 260) {
      ctx.fillRect(x, 330, 12, 95); ctx.beginPath(); ctx.arc(x + 6, 325, 30, 0, 7); ctx.fill();
    }
  } else if (level === 4) {
    // Steamy prehistoric jungle, distant volcanoes, cycads and giant ferns.
    ctx.fillStyle = "rgba(86,58,67,.42)";
    for (let x = offset - 100; x < W + 260; x += 300) {
      ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + 125, 155); ctx.lineTo(x + 165, 155); ctx.lineTo(x + 290, GROUND); ctx.fill();
      ctx.fillStyle = "rgba(255,223,150,.55)"; ctx.beginPath(); ctx.ellipse(x + 145, 140, 24, 55, 0, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(86,58,67,.42)";
    }
    ctx.fillStyle = "#345a42";
    for (let x = offset * 1.8 - 80; x < W + 100; x += 190) {
      ctx.fillRect(x, 318, 13, 107);
      for (let a = -2; a <= 2; a++) { ctx.beginPath(); ctx.ellipse(x + 6 + a * 13, 310 + Math.abs(a) * 7, 30, 9, a * .28, 0, 7); ctx.fill(); }
    }
  } else {
    // Layered thunderheads, driving rain and distant flashes.
    ctx.fillStyle = "rgba(25,28,61,.55)";
    for (let x = offset - 160; x < W + 260; x += 250) {
      ctx.beginPath(); ctx.arc(x, 105, 55, 0, 7); ctx.arc(x + 55, 72, 72, 0, 7); ctx.arc(x + 125, 108, 58, 0, 7); ctx.fill();
    }
    // Short, softly falling droplets move much slower than the foreground.
    ctx.strokeStyle = "rgba(205,229,245,.5)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 22; i++) {
      const x = (i * 139 + (i % 4) * 43 - distance * .18) % (W + 90) - 20;
      const y = (i * 71 + distance * .72) % 270 + 125;
      const dropLength = 7 + (i % 4) * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + dropLength); ctx.stroke();
    }
    ctx.fillStyle = "rgba(38,46,76,.65)"; ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = -80 + offset; x < W + 180; x += 180) ctx.quadraticCurveTo(x + 90, 285, x + 180, GROUND);
    ctx.fill();
  }
  ctx.fillStyle = l.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = level === 0 ? "#4d9d4f" : level === 1 ? "#30244f" : level === 2 ? "#51382f" : level === 3 ? "#8d6d32" : level === 4 ? "#344d31" : "#29344e"; ctx.fillRect(0, GROUND, W, 12);
  ctx.globalAlpha = .2; ctx.fillStyle = "#fff";
  const stripe = -(distance * 1.2 % 90); for (let x = stripe; x < W; x += 90) ctx.fillRect(x, GROUND + 42, 45, 6); ctx.globalAlpha = 1;
}

function drawCloud(x, y) {
  ctx.beginPath(); ctx.arc(x, y, 28, 0, 7); ctx.arc(x + 34, y - 14, 38, 0, 7); ctx.arc(x + 78, y, 29, 0, 7); ctx.fill();
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) return;
  if (player.dead) {
    drawCrackedPlayer();
    return;
  }
  const x = player.x, y = player.y + (player.grounded ? Math.sin(player.bob) * 2 : 0);
  ctx.save();
  ctx.translate(x + player.w / 2, y + (player.ducking && player.grounded ? 52 : player.h / 2));
  if (player.ducking && player.grounded) ctx.scale(1.08, .62);
  ctx.rotate(Math.max(-.15, Math.min(.13, player.vy * .012)));
  ctx.fillStyle = "rgba(38,25,83,.2)"; ctx.beginPath(); ctx.ellipse(0, 40, 34, 8, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 1, 28, 36, 0, 0, Math.PI * 2); ctx.fillStyle = "#fffdf2"; ctx.fill(); ctx.strokeStyle = "#261953"; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = "#f0e1c2"; ctx.beginPath(); ctx.ellipse(7, 13, 14, 15, -.4, 0, 7); ctx.fill();
  ctx.fillStyle = "#261953"; ctx.beginPath(); ctx.arc(-9, -7, 3.8, 0, 7); ctx.arc(9, -7, 3.8, 0, 7); ctx.fill();
  ctx.strokeStyle = "#261953"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 1, 8, .25, Math.PI - .25); ctx.stroke();
  ctx.fillStyle = "#6c42d8"; ctx.beginPath(); ctx.ellipse(-5, -34, 23, 8, -.1, 0, 7); ctx.fill(); ctx.strokeStyle = "#261953"; ctx.lineWidth = 3; ctx.stroke();
  roundedRect(20, 3, 40, 15, 6, "#6c42d8", "#261953", 3); roundedRect(49, 6, 18, 8, 3, "#ffd84d", "#261953", 2);
  ctx.restore();
}

function drawCrackedPlayer() {
  const x = player.x + player.w / 2;
  const y = GROUND - 18;
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = "#261953"; ctx.lineWidth = 4;
  ctx.fillStyle = "#ffbf2f"; ctx.beginPath(); ctx.ellipse(0, 1, 29, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fffdf2";
  ctx.beginPath(); ctx.moveTo(-31, 0); ctx.lineTo(-22, -22); ctx.lineTo(-12, -12); ctx.lineTo(-4, -28); ctx.lineTo(1, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(31, 0); ctx.lineTo(22, -23); ctx.lineTo(13, -12); ctx.lineTo(4, -28); ctx.lineTo(-1, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y + (e.type === "ninja" ? Math.sin(e.phase) * 2 : 0)); ctx.strokeStyle = "#261953"; ctx.lineWidth = 4;
  if (e.type === "trex") ctx.scale(1.16, 1.16);
  if (e.type === "zombie") {
    const zombieSkin = ["#82d966", "#62c7a1", "#a4d65e"][e.variant];
    const zombieShirt = ["#6c42d8", "#e45c78", "#4383c4"][e.variant];
    roundedRect(7, 8, 43, 54, 15, zombieSkin, "#261953", 4);
    ctx.fillStyle = zombieShirt; ctx.fillRect(8, 41, 41, 21); ctx.strokeRect(8, 41, 41, 21);
    ctx.fillStyle = "#261953"; ctx.beginPath(); ctx.arc(20, 25, 4, 0, 7); ctx.arc(39, 25, 4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(20, 37); ctx.lineTo(37, 37); ctx.stroke();
  } else if (e.type === "ninja") {
    ctx.fillStyle = "#251953"; ctx.beginPath(); ctx.arc(28, 25, 24, 0, 7); ctx.fill(); ctx.stroke();
    roundedRect(5, 20, 47, 17, 5, ["#8554c8", "#d44f78", "#347f9e"][e.variant]); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(20, 28, 3, 0, 7); ctx.arc(37, 28, 3, 0, 7); ctx.fill();
    roundedRect(10, 43, 38, 23, 9, "#30234f", "#261953", 3); ctx.strokeStyle = "#ffd84d"; ctx.beginPath(); ctx.moveTo(3, 57); ctx.lineTo(52, 41); ctx.stroke();
  } else if (e.type === "dragon") {
    // A full dragon silhouette: tail, wings, spines, claws, horns and snout.
    const flap = Math.sin(e.phase * 2) * 10;
    const dragonColor = ["#d94f45", "#6eaf56", "#a85bb1"][e.variant];
    const wingColor = ["#f07861", "#8bcf6c", "#cb7bd2"][e.variant];
    const bellyColor = ["#f5a66f", "#d8d66f", "#efa0c8"][e.variant];

    // Far wing and long pointed tail.
    ctx.fillStyle = wingColor; ctx.beginPath(); ctx.moveTo(47, 43); ctx.quadraticCurveTo(31, 3 - flap, 3, 6 - flap); ctx.lineTo(20, 30); ctx.lineTo(2, 34 - flap / 2); ctx.quadraticCurveTo(30, 51, 56, 58); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dragonColor; ctx.beginPath(); ctx.moveTo(31, 51); ctx.quadraticCurveTo(2, 47, -10, 70); ctx.quadraticCurveTo(8, 62, 20, 72); ctx.lineTo(17, 60); ctx.lineTo(36, 61); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Body and neck.
    ctx.beginPath(); ctx.ellipse(56, 57, 40, 25, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(69, 46); ctx.quadraticCurveTo(66, 13, 88, 16); ctx.lineTo(99, 42); ctx.lineTo(88, 58); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = bellyColor; ctx.beginPath(); ctx.ellipse(61, 65, 24, 10, 0, 0, 7); ctx.fill();

    // Near wing with three webbed points.
    ctx.fillStyle = wingColor; ctx.beginPath(); ctx.moveTo(57, 49); ctx.quadraticCurveTo(51, 5 - flap, 22, 0 - flap); ctx.lineTo(35, 24); ctx.lineTo(16, 20 - flap / 2); ctx.lineTo(35, 41); ctx.lineTo(24, 45); ctx.quadraticCurveTo(45, 57, 65, 61); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(38,25,83,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(57, 49); ctx.lineTo(35, 24); ctx.moveTo(57, 49); ctx.lineTo(35, 41); ctx.stroke();

    // Head, square snout, nostril and toothy grin.
    ctx.strokeStyle = "#261953"; ctx.lineWidth = 4; ctx.fillStyle = dragonColor;
    ctx.beginPath(); ctx.ellipse(94, 30, 18, 17, -.12, 0, 7); ctx.fill(); ctx.stroke();
    roundedRect(92, 30, 25, 17, 7, dragonColor, "#261953", 3);
    ctx.fillStyle = "#261953"; ctx.beginPath(); ctx.arc(109, 36, 2, 0, 7); ctx.fill();
    ctx.fillStyle = "white"; ctx.beginPath(); ctx.moveTo(99, 45); ctx.lineTo(104, 52); ctx.lineTo(108, 44); ctx.fill();
    ctx.fillStyle = "#ffd84d"; ctx.beginPath(); ctx.arc(96, 25, 4, 0, 7); ctx.fill(); ctx.fillStyle = "#261953"; ctx.beginPath(); ctx.arc(97, 25, 1.5, 0, 7); ctx.fill();

    // Two horns and a row of back spikes.
    ctx.fillStyle = "#fff0bb";
    ctx.beginPath(); ctx.moveTo(83, 18); ctx.lineTo(80, 2); ctx.lineTo(91, 17); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(94, 15); ctx.lineTo(99, 1); ctx.lineTo(103, 20); ctx.fill(); ctx.stroke();
    for (let sx = 35; sx <= 69; sx += 11) { ctx.beginPath(); ctx.moveTo(sx, 37); ctx.lineTo(sx + 5, 25); ctx.lineTo(sx + 10, 40); ctx.fill(); ctx.stroke(); }

    // Dangling legs and sharp claws.
    ctx.fillStyle = dragonColor;
    [[40, 70], [75, 70]].forEach(([lx, ly]) => {
      roundedRect(lx, ly, 14, 17, 6, dragonColor, "#261953", 3);
      ctx.strokeStyle = "#fff0bb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx + 3, 86); ctx.lineTo(lx, 91); ctx.moveTo(lx + 9, 86); ctx.lineTo(lx + 8, 92); ctx.stroke();
    });

    // Zombie knight riding in a steel helmet.
    ctx.fillStyle = "#9da4b6"; ctx.beginPath(); ctx.arc(52, 16, 14, Math.PI, 0); ctx.lineTo(66, 37); ctx.lineTo(38, 37); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#80d269"; ctx.fillRect(41, 19, 22, 14); ctx.strokeRect(41, 19, 22, 14);
    ctx.fillStyle = "#9da4b6"; ctx.fillRect(38, 17, 28, 8); ctx.strokeRect(38, 17, 28, 8);
    ctx.fillStyle = "#261953"; ctx.fillRect(49, 12, 6, 6);
  } else if (e.type === "bison") {
    // A low-headed charging bison with a big hump and pounding legs.
    const legSwing = Math.sin(e.phase * 3.2) * 7;
    const fur = ["#74482f", "#885b38", "#5e4539"][e.variant];
    const darkFur = ["#432d25", "#513425", "#332b2a"][e.variant];

    // Dust kicked up behind the charge.
    ctx.fillStyle = "rgba(232,207,145,.65)";
    ctx.beginPath(); ctx.arc(91, 65, 10, 0, 7); ctx.arc(105, 59, 7, 0, 7); ctx.arc(112, 68, 12, 0, 7); ctx.fill();

    // Legs move in opposite pairs.
    ctx.fillStyle = darkFur;
    roundedRect(30 + legSwing, 52, 13, 20, 5, darkFur, "#261953", 3);
    roundedRect(68 - legSwing, 52, 13, 20, 5, darkFur, "#261953", 3);
    ctx.fillStyle = "#261953"; ctx.fillRect(28 + legSwing, 68, 17, 5); ctx.fillRect(66 - legSwing, 68, 17, 5);

    // Barrel body and signature shoulder hump.
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(58, 40, 37, 25, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = darkFur; ctx.beginPath(); ctx.arc(34, 31, 25, Math.PI, 0); ctx.lineTo(58, 48); ctx.lineTo(17, 49); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Lowered head faces Eggbert as the bison charges left.
    ctx.beginPath(); ctx.ellipse(17, 47, 18, 20, -.18, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#b88a63"; ctx.beginPath(); ctx.ellipse(9, 55, 12, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#261953"; ctx.beginPath(); ctx.arc(3, 54, 2, 0, 7); ctx.arc(13, 54, 2, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd84d"; ctx.beginPath(); ctx.arc(11, 42, 3, 0, 7); ctx.fill();

    // Curved cream horns make the silhouette instantly readable.
    ctx.fillStyle = "#fff0bb";
    ctx.beginPath(); ctx.moveTo(12, 35); ctx.quadraticCurveTo(-7, 17, -12, 34); ctx.quadraticCurveTo(-2, 27, 17, 42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, 34); ctx.quadraticCurveTo(13, 12, 7, 28); ctx.quadraticCurveTo(16, 23, 30, 42); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Shaggy beard and tail.
    ctx.fillStyle = darkFur; ctx.beginPath(); ctx.moveTo(19, 62); ctx.lineTo(27, 81); ctx.lineTo(8, 67); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#261953"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(90, 37); ctx.quadraticCurveTo(103, 29, 98, 18); ctx.stroke();
    ctx.fillStyle = darkFur; ctx.beginPath(); ctx.arc(98, 17, 6, 0, 7); ctx.fill();
  } else if (e.type === "trex") {
    // Detailed T. rex: huge chomping skull, counterbalancing tail and powerful legs.
    const stride = Math.sin(e.phase * 3) * 8;
    const chomp = (Math.sin(e.phase * 4.4) + 1) * 8;
    const dino = ["#4f9255", "#b26a3d", "#5577a4"][e.variant];
    const dark = ["#2f633d", "#75442d", "#354f76"][e.variant];
    const belly = ["#98c86c", "#d7a35e", "#8fb0c8"][e.variant];

    // Dust clouds and long balancing tail.
    ctx.fillStyle = "rgba(225,203,145,.55)"; ctx.beginPath(); ctx.arc(91, 80, 10, 0, 7); ctx.arc(112, 77, 14, 0, 7); ctx.fill();
    ctx.fillStyle = dino; ctx.strokeStyle = "#261953"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(78, 43); ctx.quadraticCurveTo(110, 35, 137, 13); ctx.quadraticCurveTo(119, 46, 88, 62); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Muscular body, belly and striped scales.
    ctx.beginPath(); ctx.ellipse(72, 47, 37, 28, -.08, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(63, 58, 25, 13, -.1, 0, 7); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 5;
    for (let sx = 69; sx < 103; sx += 12) { ctx.beginPath(); ctx.moveTo(sx, 27); ctx.lineTo(sx + 4, 39); ctx.stroke(); }

    // Giant, deep T. rex skull points toward Eggbert on the left.
    ctx.fillStyle = dino; ctx.strokeStyle = "#261953"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(52, 39); ctx.quadraticCurveTo(47, 5, 16, 5); ctx.quadraticCurveTo(-13, 7, -16, 27); ctx.quadraticCurveTo(-14, 37, 4, 40); ctx.lineTo(43, 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Heavy brow ridge and cheek muscles give it the classic rex profile.
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(7, 13); ctx.quadraticCurveTo(22, 5, 37, 14); ctx.lineTo(31, 22); ctx.lineTo(7, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(39, 34, 13, 11, -.25, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd84d"; ctx.beginPath(); ctx.arc(18, 20, 5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#261953"; ctx.beginPath(); ctx.arc(16, 20, 2, 0, 7); ctx.arc(-2, 25, 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(32, 29, 7, 5, 0, 0, 7); ctx.fill();

    // Dark mouth cavity stays connected to the skull.
    ctx.fillStyle = "#351f45"; ctx.beginPath(); ctx.moveTo(-10, 34); ctx.lineTo(42, 40); ctx.lineTo(35, 48); ctx.lineTo(-6, 44); ctx.closePath(); ctx.fill();
    // Upper row of teeth hangs from the upper skull.
    ctx.fillStyle = "#fff8dc";
    for (let tx = -8; tx <= 34; tx += 8) { ctx.beginPath(); ctx.moveTo(tx, 36); ctx.lineTo(tx + 4, 47); ctx.lineTo(tx + 7, 37); ctx.closePath(); ctx.fill(); ctx.stroke(); }

    // The lower jaw hinges at the cheek and opens downward toward the ground.
    ctx.save(); ctx.translate(43, 42); ctx.rotate(-chomp * .022);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-57, -1); ctx.quadraticCurveTo(-53, 10, -42, 15); ctx.quadraticCurveTo(-21, 23, -4, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#7a253d"; ctx.beginPath(); ctx.moveTo(-48, 3); ctx.lineTo(-8, 4); ctx.quadraticCurveTo(-18, 15, -40, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff7590"; ctx.beginPath(); ctx.ellipse(-27, 11, 15, 4, -.05, 0, 7); ctx.fill();
    // Lower teeth point upward from the moving jaw.
    ctx.fillStyle = "#fff8dc";
    for (let tx = -49; tx <= -8; tx += 8) { ctx.beginPath(); ctx.moveTo(tx, 3); ctx.lineTo(tx + 4, -6); ctx.lineTo(tx + 7, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    // Tiny two-clawed arms.
    ctx.strokeStyle = "#261953"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(48, 44); ctx.lineTo(35, 55); ctx.lineTo(25, 52); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(25, 52); ctx.lineTo(18, 48); ctx.moveTo(25, 52); ctx.lineTo(18, 56); ctx.stroke();

    // Huge running legs with three toes each.
    [[49 + stride, 61], [79 - stride, 61]].forEach(([lx, ly]) => {
      ctx.fillStyle = dino; ctx.strokeStyle = "#261953"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 18, ly); ctx.lineTo(lx + 13, 86); ctx.lineTo(lx - 2, 86); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx - 2, 86); ctx.lineTo(lx - 10, 91); ctx.moveTo(lx + 4, 86); ctx.lineTo(lx, 92); ctx.moveTo(lx + 11, 86); ctx.lineTo(lx + 9, 92); ctx.stroke();
    });
  } else if (e.type === "lightning") {
    const flicker = 7 + Math.sin(e.phase * 7) * 3;
    // Compact thundercloud traveling with the bolt.
    ctx.fillStyle = "#333959"; ctx.strokeStyle = "#171a36"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(11, 27, 22, 0, 7); ctx.arc(31, 15, 28, 0, 7); ctx.arc(53, 29, 23, 0, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Wide glowing bolt remains shootable near ground level.
    ctx.shadowColor = "#fff45c"; ctx.shadowBlur = 20 + flicker;
    ctx.fillStyle = "#fff25b"; ctx.strokeStyle = "#d89e24"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(34, 42); ctx.lineTo(12, 132); ctx.lineTo(31, 127); ctx.lineTo(9, 215); ctx.lineTo(28, 207); ctx.lineTo(15, 302); ctx.lineTo(56, 189); ctx.lineTo(37, 194); ctx.lineTo(58, 106); ctx.lineTo(40, 112); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Electrical branches and ground sparks.
    ctx.strokeStyle = "#fffbd1"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(23, 145); ctx.lineTo(2, 169); ctx.lineTo(7, 191); ctx.moveTo(30, 226); ctx.lineTo(53, 249); ctx.lineTo(48, 270); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,242,91,.42)"; ctx.beginPath(); ctx.ellipse(26, 310, 38, 10, 0, 0, 7); ctx.fill();
  } else {
    // Animated tornado made from offset rotating wind bands and debris.
    const sway = Math.sin(e.phase * 2.5) * 7;
    ctx.fillStyle = "rgba(213,235,242,.28)"; ctx.beginPath(); ctx.ellipse(38, 112, 38, 9, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#25304d"; ctx.lineWidth = 4;
    const bands = [
      [0, 8, 68, 20], [7, 27, 60, 19], [12, 47, 51, 18],
      [18, 66, 41, 17], [23, 84, 31, 15], [29, 100, 20, 12]
    ];
    bands.forEach(([bx, by, bw, bh], i) => {
      const wave = Math.sin(e.phase * 4 + i) * (8 - i);
      ctx.fillStyle = i % 2 ? "#9fc5d4" : "#d5edf2";
      ctx.beginPath(); ctx.ellipse(bx + bw / 2 + sway + wave, by, bw / 2, bh / 2, -.08, 0, 7); ctx.fill(); ctx.stroke();
    });
    // Leaves and boards whip around the funnel.
    ctx.fillStyle = "#ffd84d"; ctx.fillRect(4 + sway, 43, 13, 6); ctx.fillRect(58 - sway, 72, 11, 6);
    ctx.fillStyle = "#6f4c31"; ctx.save(); ctx.translate(65 + sway, 28); ctx.rotate(e.phase); ctx.fillRect(-10, -3, 20, 6); ctx.restore();
    ctx.fillStyle = "#75c95e"; ctx.beginPath(); ctx.ellipse(7 - sway, 83, 9, 4, .5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawShots() {
  shots.forEach(s => { ctx.shadowColor = "#fff25b"; ctx.shadowBlur = 15; roundedRect(s.x, s.y, s.w, s.h, 5, "#fff25b"); ctx.shadowBlur = 0; });
}

function drawAmmoBoxes() {
  ammoBoxes.forEach(box => {
    const y = box.y + Math.sin(box.phase) * 5;
    ctx.save(); ctx.translate(box.x, y); ctx.rotate(Math.sin(box.phase) * .04);
    ctx.shadowColor = "rgba(255,216,77,.8)"; ctx.shadowBlur = 17;
    roundedRect(0, 0, box.w, box.h, 9, "#ffd84d", "#261953", 4);
    ctx.shadowBlur = 0; ctx.fillStyle = "#6c42d8"; ctx.fillRect(17, 3, 10, 38);
    ctx.fillStyle = "#261953"; ctx.font = "900 21px Nunito"; ctx.textAlign = "center"; ctx.fillText("✦", 22, 29);
    ctx.restore();
  });
}

function drawFruits() {
  fruits.forEach(fruit => {
    const y = fruit.y + Math.sin(fruit.phase) * 6;
    ctx.save(); ctx.translate(fruit.x + 19, y + 21);
    ctx.rotate(Math.sin(fruit.phase) * .12);
    ctx.shadowColor = "rgba(255,91,135,.65)"; ctx.shadowBlur = 15;
    ctx.strokeStyle = "#261953"; ctx.lineWidth = 3;
    if (fruit.type === 0) {
      // Apple
      ctx.fillStyle = "#ff5b67"; ctx.beginPath(); ctx.arc(-8, 3, 13, 0, 7); ctx.arc(8, 3, 13, 0, 7); ctx.lineTo(0, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (fruit.type === 1) {
      // Orange
      ctx.fillStyle = "#ff9c3d"; ctx.beginPath(); ctx.arc(0, 4, 17, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      // Strawberry
      ctx.fillStyle = "#ef4770"; ctx.beginPath(); ctx.moveTo(-17, -5); ctx.quadraticCurveTo(0, 27, 17, -5); ctx.quadraticCurveTo(0, -15, -17, -5); ctx.fill(); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#65b84f"; ctx.beginPath(); ctx.ellipse(5, -14, 10, 5, -.45, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "white"; ctx.font = "900 15px Nunito"; ctx.textAlign = "center"; ctx.fillText("♥", 0, 9);
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach(p => { ctx.globalAlpha = Math.min(1, p.life / 12); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
}

function drawProgress() {
  if (state !== "playing") return;
  roundedRect(W / 2 - 100, 18, 200, 13, 8, "rgba(38,25,83,.25)");
  roundedRect(W / 2 - 98, 20, Math.max(6, 196 * Math.min(1, distance / currentLevelLength())), 9, 6, "#ffd84d");
}

function render() {
  ctx.save();
  if (shake > .3) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  drawBackground(); drawProgress(); drawFruits(); drawAmmoBoxes(); drawShots(); enemies.forEach(drawEnemy); drawPlayer(); drawParticles();
  if (flash) { ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

function loop(time) {
  const dt = lastTime ? time - lastTime : 16.67; lastTime = time; update(dt); render(); requestAnimationFrame(loop);
}

function setDucking(ducking) {
  if (!ducking || (state === "playing" && player.grounded)) {
    player.ducking = ducking;
  }
}

function toggleSound() {
  soundOn = !soundOn;
  ui.soundButton.classList.toggle("muted", !soundOn);
  ui.soundButton.textContent = soundOn ? "♫" : "×";
  ui.soundButton.setAttribute("aria-pressed", String(soundOn));

  if (soundOn) {
    initAudio();
    beep(440, .06);
  }
}

byId("startButton").addEventListener("click", () => startGame(0));
document.querySelectorAll("[data-start-level]").forEach(button => {
  button.addEventListener("click", () => startGame(Number(button.dataset.startLevel)));
});
ui.messageButton.addEventListener("click", () => {
  if (state === "transition") continueLevel();
  else startGame(selectedStartLevel);
});
byId("jumpButton").addEventListener("pointerdown", event => {
  event.preventDefault();
  jump();
});
ui.duckButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  setDucking(true);
});
ui.duckButton.addEventListener("pointerup", () => setDucking(false));
ui.duckButton.addEventListener("pointercancel", () => setDucking(false));
byId("blastButton").addEventListener("pointerdown", event => {
  event.preventDefault();
  blast();
});
ui.homeButton.addEventListener("click", goHome);
ui.soundButton.addEventListener("click", toggleSound);
window.addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "ArrowDown") setDucking(true);
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "ArrowUp") jump();
  if (e.code === "KeyX" || e.code === "ArrowRight") blast();
  if (e.code === "Enter" && state === "menu") startGame();
});
window.addEventListener("keyup", event => {
  if (event.code === "ArrowDown") setDucking(false);
});

resetPlayer();
updateHud();
requestAnimationFrame(loop);
