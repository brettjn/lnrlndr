'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const GRAVITY = 0.025;          // pixels/frame² downward
const THRUST_POWER = 0.06;      // pixels/frame² along heading
const ROTATE_SPEED = 2.5;       // degrees/frame
const MAX_LAND_VY = 2.0;        // max safe vertical landing speed (px/frame)
const MAX_LAND_VX = 1.2;        // max safe horizontal landing speed (px/frame)
const MAX_LAND_ANGLE = 15;      // degrees from upright
const INITIAL_FUEL = 500;
const PAD_WIDTH = 80;
const LANDER_SCALE = 1;         // multiplier for lander sprite size
const STARS = 150;

// ─── Terrain generation ───────────────────────────────────────────────────────
/**
 * Generate a jagged lunar surface as an array of x-sorted {x, y} points.
 * One flat landing pad of width PAD_WIDTH is inserted at a random location.
 * Returns { points, padX, padY }.
 */
function generateTerrain() {
  const points = [];
  const step = 10;

  // Pick a pad start somewhere in the middle third of the canvas
  const padX = Math.floor(Math.random() * (W * 0.5) + W * 0.2);
  const padY = Math.floor(Math.random() * (H * 0.25) + H * 0.55);

  // Midpoint-displacement terrain
  const segs = Math.ceil(W / step) + 1;
  const raw = new Array(segs);
  raw[0] = padY + (Math.random() - 0.5) * 80;
  raw[segs - 1] = padY + (Math.random() - 0.5) * 80;

  function displace(lo, hi, rough) {
    if (hi - lo <= 1) return;
    const mid = Math.floor((lo + hi) / 2);
    raw[mid] = (raw[lo] + raw[hi]) / 2 + (Math.random() - 0.5) * rough;
    raw[mid] = Math.max(H * 0.45, Math.min(H - 20, raw[mid]));
    displace(lo, mid, rough * 0.6);
    displace(mid, hi, rough * 0.6);
  }
  displace(0, segs - 1, 120);

  for (let i = 0; i < segs; i++) {
    const x = i * step;
    // Flatten the landing pad
    if (x >= padX && x <= padX + PAD_WIDTH) {
      points.push({ x, y: padY });
    } else {
      points.push({ x, y: Math.round(raw[i]) || padY });
    }
  }

  return { points, padX, padY };
}

// ─── Lander state ─────────────────────────────────────────────────────────────
function createLander() {
  return {
    x: W / 2,
    y: 80,
    vx: (Math.random() - 0.5) * 1.5,
    vy: 0.5,
    angle: 0,    // 0 = pointing up; positive = clockwise degrees
    fuel: INITIAL_FUEL,
    thrusting: false,
    dead: false,
    landed: false,
  };
}

// ─── Canvas setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') resetGame();
  // Prevent page scroll on game keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ─── Stars (static across resets) ────────────────────────────────────────────
const starField = Array.from({ length: STARS }, () => ({
  x: Math.random() * W,
  y: Math.random() * H * 0.6,
  r: Math.random() * 1.2 + 0.3,
}));

// ─── Game state ───────────────────────────────────────────────────────────────
let terrain, padX, padY, lander, score, message;

function resetGame() {
  ({ points: terrain, padX, padY } = generateTerrain());
  lander = createLander();
  score = 0;
  message = null;
}
resetGame();

// ─── Physics & collision ──────────────────────────────────────────────────────
/** Return the terrain y-value at a given x by linear interpolation. */
function terrainYAt(x) {
  if (terrain.length < 2) return H;
  // Binary search for the segment
  let lo = 0, hi = terrain.length - 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (terrain[mid + 1].x <= x) lo = mid + 1;
    else hi = mid;
  }
  const p1 = terrain[lo];
  const p2 = terrain[Math.min(lo + 1, terrain.length - 1)];
  if (p2.x === p1.x) return p1.y;
  const t = (x - p1.x) / (p2.x - p1.x);
  return p1.y + t * (p2.y - p1.y);
}

function update() {
  if (lander.dead || lander.landed) return;

  // Rotation
  if (keys['ArrowLeft']) lander.angle -= ROTATE_SPEED;
  if (keys['ArrowRight']) lander.angle += ROTATE_SPEED;

  // Thrust
  lander.thrusting = (keys['ArrowUp'] || keys['Space']) && lander.fuel > 0;
  if (lander.thrusting) {
    const rad = (lander.angle - 90) * Math.PI / 180; // -90 so "up" is 0°
    lander.vx += Math.cos(rad) * THRUST_POWER;
    lander.vy += Math.sin(rad) * THRUST_POWER;
    lander.fuel = Math.max(0, lander.fuel - 1);
  }

  // Gravity
  lander.vy += GRAVITY;

  // Move
  lander.x += lander.vx;
  lander.y += lander.vy;

  // Wrap horizontally
  if (lander.x < 0) lander.x = W;
  if (lander.x > W) lander.x = 0;

  // Collision with terrain
  const groundY = terrainYAt(lander.x);
  const landerBottom = lander.y + 14; // approx distance from centre to legs

  if (landerBottom >= groundY) {
    // Landed on pad?
    const onPad = lander.x >= padX && lander.x <= padX + PAD_WIDTH;
    const normAngle = ((lander.angle % 360) + 360) % 360;
    const angleDiff = Math.min(normAngle, 360 - normAngle);
    const safeAngle = angleDiff <= MAX_LAND_ANGLE;
    const safeSpeed = Math.abs(lander.vy) <= MAX_LAND_VY && Math.abs(lander.vx) <= MAX_LAND_VX;

    if (onPad && safeAngle && safeSpeed) {
      lander.landed = true;
      lander.y = groundY - 14;
      lander.vx = 0;
      lander.vy = 0;
      // Score: remaining fuel + speed bonus
      const speedBonus = Math.round((MAX_LAND_VY - Math.abs(lander.vy)) * 100);
      score = lander.fuel + speedBonus;
      message = { text: `LANDED SAFELY!  Score: ${score}`, color: '#7f7' };
    } else {
      lander.dead = true;
      lander.y = groundY - 14;
      if (!onPad) {
        message = { text: 'CRASHED – missed the pad!', color: '#f77' };
      } else if (!safeAngle) {
        message = { text: 'CRASHED – tilted too far!', color: '#f77' };
      } else {
        message = { text: `CRASHED – too fast! (${Math.abs(lander.vy).toFixed(2)} px/f)`, color: '#f77' };
      }
    }
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawStars() {
  ctx.fillStyle = '#fff';
  for (const s of starField) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain() {
  if (!terrain.length) return;

  // Landing pad highlight
  ctx.fillStyle = '#339';
  ctx.fillRect(padX, padY - 3, PAD_WIDTH, 3);

  // Pad poles
  ctx.strokeStyle = '#55f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, padY);
  ctx.lineTo(padX, padY - 12);
  ctx.moveTo(padX + PAD_WIDTH, padY);
  ctx.lineTo(padX + PAD_WIDTH, padY - 12);
  ctx.stroke();

  // Terrain fill
  ctx.fillStyle = '#334';
  ctx.beginPath();
  ctx.moveTo(terrain[0].x, H);
  for (const p of terrain) ctx.lineTo(p.x, p.y);
  ctx.lineTo(terrain[terrain.length - 1].x, H);
  ctx.closePath();
  ctx.fill();

  // Terrain outline
  ctx.strokeStyle = '#aac';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(terrain[0].x, terrain[0].y);
  for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i].x, terrain[i].y);
  ctx.stroke();
}

function drawLander() {
  const { x, y, angle, thrusting, dead, landed } = lander;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * Math.PI / 180);

  const s = LANDER_SCALE;

  // Body
  ctx.strokeStyle = dead ? '#f55' : (landed ? '#7f7' : '#eef');
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Main capsule (octagon-ish)
  ctx.moveTo(0, -18 * s);
  ctx.lineTo(10 * s, -10 * s);
  ctx.lineTo(10 * s, 5 * s);
  ctx.lineTo(0, 10 * s);
  ctx.lineTo(-10 * s, 5 * s);
  ctx.lineTo(-10 * s, -10 * s);
  ctx.closePath();
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(-10 * s, 5 * s);
  ctx.lineTo(-18 * s, 14 * s);
  ctx.moveTo(10 * s, 5 * s);
  ctx.lineTo(18 * s, 14 * s);
  ctx.stroke();

  // Thruster nozzle
  ctx.beginPath();
  ctx.moveTo(-5 * s, 10 * s);
  ctx.lineTo(5 * s, 10 * s);
  ctx.lineTo(3 * s, 14 * s);
  ctx.lineTo(-3 * s, 14 * s);
  ctx.closePath();
  ctx.stroke();

  // Flame
  if (thrusting) {
    const flameLen = 10 + Math.random() * 12;
    const grad = ctx.createLinearGradient(0, 14 * s, 0, (14 + flameLen) * s);
    grad.addColorStop(0, 'rgba(255,220,100,0.95)');
    grad.addColorStop(0.5, 'rgba(255,100,20,0.7)');
    grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-3 * s, 14 * s);
    ctx.lineTo(3 * s, 14 * s);
    ctx.lineTo(0, (14 + flameLen) * s);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawHUD() {
  const fuelPct = lander.fuel / INITIAL_FUEL;
  const speed = Math.sqrt(lander.vx * lander.vx + lander.vy * lander.vy);

  ctx.font = '13px Courier New';
  ctx.fillStyle = '#aad';
  ctx.fillText(`FUEL  ${lander.fuel.toString().padStart(4)}`, 12, 22);
  ctx.fillText(`SPEED ${speed.toFixed(2).padStart(6)}`, 12, 40);
  ctx.fillText(`VX    ${lander.vx.toFixed(2).padStart(6)}`, 12, 58);
  ctx.fillText(`VY    ${lander.vy.toFixed(2).padStart(6)}`, 12, 76);
  ctx.fillText(`ALT   ${Math.max(0, Math.round(terrainYAt(lander.x) - lander.y)).toString().padStart(4)}`, 12, 94);

  // Fuel bar
  ctx.strokeStyle = '#446';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 102, 100, 8);
  ctx.fillStyle = fuelPct > 0.3 ? '#4c8' : '#f84';
  ctx.fillRect(12, 102, 100 * fuelPct, 8);

  // Angle indicator
  const normAngle = ((lander.angle % 360) + 360) % 360;
  const angleDiff = Math.min(normAngle, 360 - normAngle);
  ctx.fillStyle = angleDiff <= MAX_LAND_ANGLE ? '#4c8' : '#f84';
  ctx.fillText(`ANGLE ${angleDiff.toFixed(1).padStart(5)}°`, 12, 124);

  // Pad distance
  const distToPad = Math.abs(lander.x - (padX + PAD_WIDTH / 2));
  ctx.fillStyle = '#aad';
  ctx.fillText(`PAD   ${Math.round(distToPad).toString().padStart(4)}`, 12, 142);

  // Press R to restart
  if (lander.dead || lander.landed) {
    ctx.fillStyle = '#888';
    ctx.font = '12px Courier New';
    ctx.fillText('Press R to restart', 12, 162);
  }
}

function drawMessage() {
  if (!message) return;
  const { text, color } = message;
  ctx.save();
  ctx.font = 'bold 22px Courier New';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2 - 20);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawStars();
  drawTerrain();
  drawLander();
  drawHUD();
  drawMessage();
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
