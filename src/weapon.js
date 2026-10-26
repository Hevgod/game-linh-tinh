export class Weapon {
  constructor() {
    this.magazineSize = 30;
    this.ammo = this.magazineSize;
    this.reloadTime = 0;
    this.fireCooldown = 0;
    this.fireInterval = .115;
    this.spread = .025;
    this.range = 1500;
    this.bullets = [];
    this.shotsFired = 0;
  }

  reset() {
    this.ammo = this.magazineSize;
    this.reloadTime = 0;
    this.fireCooldown = 0;
    this.fireInterval = .115;
    this.spread = .025;
    this.range = 1500;
    this.bullets = [];
    this.shotsFired = 0;
  }

  reload(onReload) {
    if (this.reloadTime <= 0 && this.ammo < this.magazineSize) {
      this.reloadTime = 1.15;
      onReload();
    }
  }

  nearestTarget(player, bots) {
    let target = null, distance = this.range;
    for (const bot of bots) {
      const deltaX = bot.x - player.x;
      const deltaY = bot.y + bot.height / 2 - (player.y + 21);
      const candidate = Math.hypot(deltaX, deltaY);
      if (candidate < distance && Math.sign(deltaX) === player.facing && Math.abs(deltaY) < candidate * .8 + 100) {
        target = bot; distance = candidate;
      }
    }
    return target;
  }

  step(dt, player, bots, input, onShot, onReload) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloadTime > 0) {
      this.reloadTime = Math.max(0, this.reloadTime - dt);
      if (this.reloadTime === 0) { this.ammo = this.magazineSize; onShot("MAGAZINE FULL · 30 ROUNDS"); }
    }
    if (input.reload) this.reload(onReload);
    if (!input.fire || this.fireCooldown > 0 || this.reloadTime > 0) return;
    if (!this.ammo) { this.reload(onReload); return; }

    const target = input.aim ? null : this.nearestTarget(player, bots.bots);
    const originX = player.x + player.facing * 24;
    const originY = player.y + 21;
    const speed = 1080;
    const gravity = 90;
    let angle = player.facing * -.025;
    if (target) {
      const flightTime = Math.abs(target.x - originX) / speed;
      const targetX = target.x + target.vx * flightTime;
      const targetY = target.y + target.height / 2 + target.vy * flightTime;
      angle = Math.atan2(targetY - originY - gravity * flightTime * flightTime / 2, targetX - originX);
    } else if (input.aim) {
      const flightTime = Math.abs(input.aim.x - originX) / speed;
      const compensatedY = input.aim.y - gravity * flightTime * flightTime / 2;
      angle = Math.atan2(compensatedY - originY, input.aim.x - originX);
    }
    angle += (Math.random() - .5) * this.spread;
    this.bullets.push({
      x: originX, y: originY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      gravity, travelled: 0, life: this.range / speed, trailX: originX, trailY: originY,
    });
    this.ammo--;
    this.fireCooldown = this.fireInterval;
    this.shotsFired++;
    onShot(null);
  }

  moveBullets(dt, bots, world, onHit) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const startX = bullet.x, startY = bullet.y;
      bullet.trailX = startX; bullet.trailY = startY;
      bullet.vy += bullet.gravity * dt;
      let endX = startX + bullet.vx * dt;
      let endY = startY + bullet.vy * dt;
      const segmentLength = Math.hypot(endX - startX, endY - startY);
      const rangeLeft = this.range - bullet.travelled;
      const rangeFraction = segmentLength > rangeLeft ? rangeLeft / segmentLength : 1;
      endX = startX + (endX - startX) * rangeFraction;
      endY = startY + (endY - startY) * rangeFraction;
      bullet.travelled += Math.hypot(endX - startX, endY - startY);
      bullet.x = endX;
      bullet.y = endY;
      bullet.life -= dt * rangeFraction;

      const terrainHit = this.terrainIntersection(startX, startY, endX, endY, world);
      const hitBot = bots.hitTestSegment(startX, startY, endX, endY, terrainHit?.fraction ?? 1);
      if (hitBot) onHit(hitBot.x, hitBot.y);
      if (hitBot || terrainHit || bullet.travelled >= this.range || bullet.life <= 0 || bullet.y < 0 || bullet.y > 540) {
        this.bullets.splice(i, 1);
      }
    }
  }

  terrainIntersection(startX, startY, endX, endY, world) {
    const distance = Math.hypot(endX - startX, endY - startY);
    const steps = Math.max(1, Math.ceil(distance / 6));
    let previousFraction = 0;
    let previousDepth = startY - world.groundAt(startX);
    if (previousDepth >= 0) return { fraction: 0 };
    for (let step = 1; step <= steps; step++) {
      const fraction = step / steps;
      const x = startX + (endX - startX) * fraction;
      const y = startY + (endY - startY) * fraction;
      const depth = y - world.groundAt(x);
      if (depth >= 0) {
        const span = depth - previousDepth;
        const crossFraction = span === 0 ? fraction : previousFraction + (fraction - previousFraction) * (-previousDepth / span);
        return { fraction: crossFraction };
      }
      previousFraction = fraction;
      previousDepth = depth;
    }
    return null;
  }

  draw(ctx, cameraX) {
    for (const bullet of this.bullets) {
      const x = bullet.x - cameraX, tailX = bullet.trailX - cameraX;
      ctx.strokeStyle = "rgba(255,221,146,.35)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tailX, bullet.trailY); ctx.lineTo(x, bullet.y); ctx.stroke();
      ctx.fillStyle = "#fff0c2"; ctx.shadowColor = "#f6ca76"; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(x, bullet.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
}
