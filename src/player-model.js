import { drawAKM } from "./weapon-model.js";

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export class Player {
  constructor(world) {
    this.world = world;
    this.startX = 140;
    this.x = this.startX; this.y = world.groundAt(this.x) - 48;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.width = 22; this.height = 46;
    this.maxHealth = 20; this.health = this.maxHealth; this.shield = 0; this.invulnerable = 0;
    this.onGround = false; this.coyote = 0; this.jumpBuffer = 0;
    this.distance = 0; this.animation = 0;
  }

  jump() {
    this.jumpBuffer = .14;
  }

  step(dt, input) {
    const direction = Math.max(-1, Math.min(1, input.x));
    const acceleration = this.onGround ? 1900 : 1150;
    const maxSpeed = input.run ? 285 : 225;
    if (direction) {
      this.vx += direction * acceleration * dt;
      this.facing = Math.sign(direction);
    } else {
      this.vx *= Math.exp(-(this.onGround ? 11 : 2.1) * dt);
    }
    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    this.x = Math.max(18, this.x + this.vx * dt);

    this.vy = Math.min(760, this.vy + 1850 * dt);
    this.y += this.vy * dt;
    const nextFeet = this.y + this.height;
    const floor = this.world.groundAt(this.x);
    this.onGround = false;
    if (nextFeet >= floor) {
      this.y = floor - this.height; this.vy = 0; this.onGround = true;
    }

    this.coyote = this.onGround ? .13 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -650; this.onGround = false; this.coyote = 0; this.jumpBuffer = 0;
    }
    if (!input.jumpHeld && this.vy < -200) this.vy *= .94;
    this.shield = Math.max(0, this.shield - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.animation += Math.abs(this.vx) * dt * .055;
    this.distance = Math.max(this.distance, Math.floor((this.x - this.startX) / 4));
  }

  draw(ctx, cameraX, time) {
    const walk = this.onGround ? Math.sin(this.animation) : 0;
    const blink = this.invulnerable > 0 && Math.floor(time * 18) % 2 === 0;
    ctx.save();
    ctx.translate(this.x - cameraX, this.y + this.height / 2);
    ctx.scale(this.facing, 1);
    if (blink) ctx.globalAlpha = .52;
    if (this.shield > 0) {
      ctx.strokeStyle = `rgba(143,211,217,${.45 + Math.sin(time * 8) * .16})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 19, 26, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(117,197,205,.08)"; ctx.fill();
    }

    ctx.fillStyle = "#252a26"; roundedRect(ctx, -10, 8 + walk * 2, 9, 15, 3); ctx.fill();
    ctx.fillStyle = "#59604f"; ctx.fillRect(-11, 19 + walk * 2, 11, 5);
    ctx.fillStyle = "#272b27"; roundedRect(ctx, 2, 8 - walk * 2, 9, 15, 3); ctx.fill();
    ctx.fillStyle = "#67604d"; ctx.fillRect(1, 19 - walk * 2, 12, 5);

    ctx.fillStyle = "#262d29"; ctx.fillRect(-13, -8, 7, 19);
    ctx.fillStyle = "#434f43"; roundedRect(ctx, -11, -9, 23, 23, 4); ctx.fill();
    ctx.fillStyle = "#75805e"; ctx.fillRect(-10, -8, 21, 5);
    ctx.fillStyle = "#323d35"; ctx.fillRect(-8, -4, 16, 15);
    ctx.fillStyle = "#93794f"; ctx.fillRect(-8, -4, 6, 14);
    ctx.fillStyle = "#c0b28d"; ctx.fillRect(-3, -3, 3, 12);
    ctx.fillStyle = "#a78050"; ctx.fillRect(1, -3, 5, 5);
    ctx.fillStyle = "#c2ad79"; ctx.fillRect(2, -2, 3, 3);
    ctx.fillStyle = "#667252"; ctx.fillRect(-8, 7, 7, 5);
    ctx.fillStyle = "#6b765a"; ctx.fillRect(1, 7, 7, 5);
    ctx.fillStyle = "#353b35"; ctx.fillRect(8, -6, 5, 12);

    ctx.fillStyle = "#bd8766"; ctx.beginPath(); ctx.ellipse(5, -14, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#34302a"; ctx.beginPath(); ctx.moveTo(-4, -15); ctx.quadraticCurveTo(-5, -25, 5, -25); ctx.quadraticCurveTo(16, -25, 15, -14); ctx.lineTo(11, -16); ctx.lineTo(3, -18); ctx.lineTo(-2, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#292a26"; ctx.beginPath(); ctx.arc(-4, -19, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d5c79d"; ctx.fillRect(10, -16, 3, 2);
    ctx.fillStyle = "#292b27"; ctx.fillRect(12, -11, 3, 2);
    ctx.fillStyle = "#47382e"; ctx.fillRect(2, -7, 7, 3);
    ctx.fillStyle = "#ceb58c"; ctx.fillRect(4, -6, 4, 2);

    ctx.fillStyle = "#343831"; ctx.beginPath(); ctx.ellipse(11, 0, 5, 8, -.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#bb8767"; ctx.beginPath(); ctx.ellipse(13, 2, 3, 6, -.2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#262b27"; ctx.fillRect(-2, -9, 4, 19);
    ctx.fillStyle = "#505344"; ctx.fillRect(0, -9, 7, 4);
    ctx.fillStyle = "#c4ad79"; ctx.fillRect(2, -8, 3, 3);
    ctx.fillStyle = "#867651"; ctx.fillRect(-8, 3, 16, 2);

    drawAKM(ctx, 31, -3, .5);
    ctx.restore();
  }

  takeDamage(amount = .5) {
    if (this.invulnerable > 0) return false;
    if (this.shield > 0) this.shield = 0;
    else this.health = Math.max(0, this.health - amount);
    this.invulnerable = .75;
    return true;
  }
}
