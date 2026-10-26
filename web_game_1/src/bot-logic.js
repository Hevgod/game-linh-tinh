import { archerReadyToFire, createArcherArrow, updateArcherTactics } from "./archer-ai.js";

export class BotManager {
  constructor(world) {
    this.world = world;
    this.bots = [];
    this.arrows = [];
    this.spawnTimer = 1.5;
    this.kills = 0;
  }

  reset(playerX) {
    this.bots = [];
    this.arrows = [];
    this.spawnTimer = 1.2;
    this.kills = 0;
    this.spawnAt(playerX + 510, "archer");
    this.spawnAt(playerX + 740, "scout");
  }

  spawnAt(x, type) {
    x = Math.max(40, x);
    const y = this.world.groundAt(x);
    type ??= Math.random() < this.world.biomeAt(x).archerChance ? "archer" : "scout";
    const archer = type === "archer";
    this.bots.push({
      type, x, y: y - (archer ? 43 : 39), vx: 0, vy: 0,
      width: archer ? 27 : 25, height: archer ? 43 : 39,
      health: archer ? 2 : 3, facing: -1,
      attackCooldown: .6 + Math.random(),
      jumpCooldown: .8 + Math.random() * 1.5,
      shotCooldown: 1 + Math.random() * 1.2,
      strafeDirection: Math.random() < .5 ? -1 : 1,
      strafeTimer: .8 + Math.random() * 1.5,
      state: "approach", animation: Math.random() * 8,
    });
  }

  step(dt, player, onHit) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.bots.length < 9) {
      let side = Math.random() < .5 ? -1 : 1;
      const distance = 570 + Math.random() * 260;
      if (player.x - distance < 40) side = 1;
      this.spawnAt(player.x + side * distance);
      this.spawnTimer = 2.8 + Math.random() * 2;
    }
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i];
      const deltaX = player.x - bot.x;
      const direction = Math.sign(deltaX);
      bot.facing = direction || bot.facing;

      let desiredDirection = direction;
      if (bot.type === "archer") {
        desiredDirection = updateArcherTactics(bot, player, dt);
      } else {
        bot.state = Math.abs(deltaX) < 46 ? "attack" : "approach";
      }

      const acceleration = bot.type === "archer" ? 520 : 760;
      const maxSpeed = bot.type === "archer" ? 105 : 125;
      bot.vx += desiredDirection * acceleration * dt;
      if (bot.type === "archer" && bot.state === "strafe") bot.vx *= Math.exp(-1.5 * dt);
      bot.vx = Math.max(-maxSpeed, Math.min(maxSpeed, bot.vx));
      bot.x = Math.max(18, bot.x + bot.vx * dt);

      bot.vy = Math.min(680, bot.vy + 1700 * dt);
      bot.y += bot.vy * dt;
      const nextFeet = bot.y + bot.height;
      if (nextFeet >= this.world.groundAt(bot.x)) {
        bot.y = this.world.groundAt(bot.x) - bot.height;
        bot.vy = 0;
      }

      bot.jumpCooldown -= dt;
      if (bot.jumpCooldown <= 0 && bot.vy === 0) {
        const nextGround = this.world.groundAt(bot.x + (desiredDirection || direction) * 75);
        const obstacleAhead = Math.abs(nextGround - this.world.groundAt(bot.x)) > 16;
        if (obstacleAhead || (bot.type === "scout" && Math.random() < .2)) {
          bot.vy = bot.type === "archer" ? -410 : -470;
          bot.jumpCooldown = .9 + Math.random() * 1.2;
        }
      }
      bot.attackCooldown = Math.max(0, bot.attackCooldown - dt);
      if (bot.type === "scout" && Math.abs(deltaX) < 31 && Math.abs(player.y - bot.y) < 52 && bot.attackCooldown <= 0) {
        bot.attackCooldown = 1.15;
        onHit(bot, "melee");
      }
      if (bot.type === "archer") {
        bot.shotCooldown = Math.max(0, bot.shotCooldown - dt);
        if (archerReadyToFire(bot, player, () => this.hasLineOfSight(bot, player))) {
          this.arrows.push(createArcherArrow(bot, player));
        }
      }
      bot.animation += Math.abs(bot.vx) * dt * .07;
    }
    this.stepArrows(dt, player, onHit);
  }

  hasLineOfSight(bot, player) {
    const startX = bot.x + bot.facing * 10;
    const startY = bot.y + 12;
    const endX = player.x;
    const endY = player.y + player.height * .42;
    const distance = Math.abs(endX - startX);
    const steps = Math.max(1, Math.ceil(distance / 18));
    for (let step = 1; step < steps; step++) {
      const fraction = step / steps;
      const x = startX + (endX - startX) * fraction;
      const y = startY + (endY - startY) * fraction;
      if (y >= this.world.groundAt(x) - 3) return false;
    }
    return true;
  }

  stepArrows(dt, player, onHit) {
    const left = player.x - player.width * .46 - 3;
    const right = player.x + player.width * .46 + 3;
    const top = player.y + 3;
    const bottom = player.y + player.height - 2;
    for (let index = this.arrows.length - 1; index >= 0; index--) {
      const arrow = this.arrows[index];
      const startX = arrow.x, startY = arrow.y;
      arrow.vy += arrow.gravity * dt;
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;
      arrow.distance += Math.hypot(arrow.x - startX, arrow.y - startY);
      arrow.life -= dt;
      const hitPlayer = this.segmentHitsBox(startX, startY, arrow.x, arrow.y, left, top, right, bottom);
      const hitGround = this.segmentHitsGround(startX, startY, arrow.x, arrow.y);
      if (hitPlayer) onHit(arrow.owner, "arrow");
      if (hitPlayer || hitGround || arrow.life <= 0 || arrow.distance > 760 || arrow.y < -20) {
        this.arrows.splice(index, 1);
      }
    }
  }

  segmentHitsGround(startX, startY, endX, endY) {
    const length = Math.hypot(endX - startX, endY - startY);
    const steps = Math.max(1, Math.ceil(length / 5));
    for (let step = 0; step <= steps; step++) {
      const fraction = step / steps;
      const x = startX + (endX - startX) * fraction;
      const y = startY + (endY - startY) * fraction;
      if (y >= this.world.groundAt(x)) return true;
    }
    return false;
  }

  segmentHitsBox(startX, startY, endX, endY, left, top, right, bottom) {
    const directionX = endX - startX;
    const directionY = endY - startY;
    let entry = 0, exit = 1;
    for (const [origin, direction, minimum, maximum] of [
      [startX, directionX, left, right],
      [startY, directionY, top, bottom],
    ]) {
      if (Math.abs(direction) < 1e-8) {
        if (origin < minimum || origin > maximum) return false;
        continue;
      }
      let near = (minimum - origin) / direction;
      let far = (maximum - origin) / direction;
      if (near > far) [near, far] = [far, near];
      entry = Math.max(entry, near);
      exit = Math.min(exit, far);
      if (entry > exit) return false;
    }
    return true;
  }

  hitTestSegment(startX, startY, endX, endY, maxFraction = 1) {
    let hitIndex = -1;
    let firstFraction = maxFraction;
    const directionX = endX - startX;
    const directionY = endY - startY;
    for (let index = 0; index < this.bots.length; index++) {
      const bot = this.bots[index];
      const left = bot.x - bot.width * .48 - 2;
      const right = bot.x + bot.width * .48 + 2;
      const top = bot.y + bot.height * .08 - 2;
      const bottom = bot.y + bot.height * .94 + 2;
      let entry = 0, exit = Math.min(1, firstFraction);
      for (const [origin, direction, minimum, maximum] of [
        [startX, directionX, left, right],
        [startY, directionY, top, bottom],
      ]) {
        if (Math.abs(direction) < 1e-8) {
          if (origin < minimum || origin > maximum) { entry = Infinity; break; }
          continue;
        }
        let near = (minimum - origin) / direction;
        let far = (maximum - origin) / direction;
        if (near > far) [near, far] = [far, near];
        entry = Math.max(entry, near);
        exit = Math.min(exit, far);
        if (entry > exit) { entry = Infinity; break; }
      }
      if (entry <= exit && entry <= firstFraction) {
        hitIndex = index;
        firstFraction = entry;
      }
    }
    if (hitIndex < 0) return null;
    const bot = this.bots[hitIndex];
    bot.health--;
    if (bot.health <= 0) { this.bots.splice(hitIndex, 1); this.kills++; }
    return {
      x: startX + directionX * firstFraction,
      y: startY + directionY * firstFraction,
    };
  }

  draw(ctx, cameraX, time) {
    for (const arrow of this.arrows) {
      const x = arrow.x - cameraX;
      const angle = Math.atan2(arrow.vy, arrow.vx);
      ctx.save();
      ctx.translate(x, arrow.y);
      ctx.rotate(angle);
      ctx.strokeStyle = "#3f3428";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.strokeStyle = "#bdad86";
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = "#c6c1ad";
      ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(7, -3); ctx.lineTo(8, 0); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#a86f55";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -4); ctx.moveTo(-10, 0); ctx.lineTo(-14, 4); ctx.stroke();
      ctx.restore();
    }
    for (const bot of this.bots) {
      const sx = bot.x - cameraX;
      if (sx < -50 || sx > 1010) continue;
      const step = Math.sin(bot.animation) * 3;
      ctx.save(); ctx.translate(sx, bot.y + bot.height / 2); ctx.scale(bot.facing, 1);
      ctx.fillStyle = "rgba(35,40,34,.3)"; ctx.beginPath(); ctx.ellipse(0, 19, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      if (bot.type === "archer") {
        ctx.fillStyle = "#333a35"; ctx.fillRect(-9, 9 + step, 7, 10); ctx.fillRect(3, 9 - step, 7, 10);
        ctx.fillStyle = "#6c725e"; ctx.fillRect(-11, -9, 22, 21);
        ctx.fillStyle = "#4d5547"; ctx.fillRect(-9, -7, 18, 16);
        ctx.fillStyle = "#514638"; ctx.fillRect(-13, -5, 4, 14); ctx.fillRect(9, -5, 4, 14);
        ctx.fillStyle = "#5b4a37"; ctx.fillRect(-9, -22, 18, 15);
        ctx.fillStyle = "#302f2a"; ctx.beginPath(); ctx.moveTo(-11, -19); ctx.lineTo(-7, -30); ctx.lineTo(5, -31); ctx.lineTo(12, -22); ctx.lineTo(8, -21); ctx.lineTo(6, -25); ctx.lineTo(-8, -23); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#e9ac60"; ctx.shadowColor = "#e58a48"; ctx.shadowBlur = 7;
        ctx.fillRect(3, -17, 5, 3); ctx.shadowBlur = 0;
        ctx.strokeStyle = "#5c4934"; ctx.lineWidth = 2.7;
        ctx.beginPath(); ctx.moveTo(11, -10); ctx.quadraticCurveTo(23, 1, 11, 12); ctx.stroke();
        ctx.strokeStyle = "#c5b58c"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(11, -10); ctx.lineTo(11, 12); ctx.moveTo(14, 1); ctx.lineTo(22, 1); ctx.stroke();
        ctx.fillStyle = "#8a6949"; ctx.fillRect(-14, -4, 3, 18);
        ctx.fillStyle = "#bd755f"; ctx.fillRect(-9, -33, 18, 2);
        ctx.fillStyle = "#d7c982"; ctx.fillRect(-9, -33, 18 * bot.health / 2, 2);
      } else {
        ctx.fillStyle = "#333a35"; ctx.fillRect(-9, 8 + step, 7, 11); ctx.fillRect(3, 8 - step, 7, 11);
        ctx.fillStyle = "#686b5a"; ctx.fillRect(-11, -9, 22, 21);
        ctx.fillStyle = "#85826a"; ctx.fillRect(-9, -7, 18, 4);
        ctx.fillStyle = "#403e35"; ctx.fillRect(-12, -6, 4, 14); ctx.fillRect(8, -6, 4, 14);
        ctx.fillStyle = "#877e69"; ctx.fillRect(-8, -22, 18, 15);
        ctx.fillStyle = "#35352e"; ctx.fillRect(-9, -24, 20, 6);
        ctx.fillStyle = "#e58157"; ctx.shadowColor = "#f07852"; ctx.shadowBlur = 8;
        ctx.fillRect(2, -18, 5, 3); ctx.shadowBlur = 0;
        ctx.fillStyle = "#c3bda5"; ctx.fillRect(-6, -15, 3, 2);
        ctx.strokeStyle = "#b6b6a7"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(9, -5); ctx.lineTo(17, 2); ctx.lineTo(19, 11); ctx.stroke();
        ctx.strokeStyle = "#524638"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(11, -1); ctx.stroke();
        ctx.fillStyle = "#d7c9a4"; ctx.fillRect(13, 5, 8, 3);
        ctx.fillStyle = "#bd755f"; ctx.fillRect(-9, -29, 18, 2);
        ctx.fillStyle = "#91bc7f"; ctx.fillRect(-9, -29, 18 * bot.health / 3, 2);
      }
      ctx.restore();
    }
    void time;
  }
}
