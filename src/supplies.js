export class SupplyManager {
  constructor() {
    this.items = [];
    this.spawnTimer = 7;
  }

  reset() {
    this.items = [];
    this.spawnTimer = 7;
  }

  step(dt, player, world, onCollect) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.items.length < 3) {
      const x = Math.max(80, player.x + (Math.random() < .5 ? -1 : 1) * (260 + Math.random() * 320));
      const health = player.health < player.maxHealth && Math.random() < .68;
      this.items.push({
        x, y: world.groundAt(x) - 21,
        type: health ? "medkit" : "shield",
        life: 27,
        phase: Math.random() * Math.PI * 2,
      });
      this.spawnTimer = 13 + Math.random() * 11;
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      item.phase += dt * 3;
      item.y = world.groundAt(item.x) - 21 + Math.sin(item.phase) * 3;
      if (Math.hypot(player.x - item.x, player.y + player.height / 2 - item.y) < 34) {
        if (item.type === "medkit" && player.health >= player.maxHealth) continue;
        if (item.type === "medkit") player.health = Math.min(player.maxHealth, player.health + 1);
        else player.shield = 8;
        onCollect(item.type);
        this.items.splice(i, 1);
      } else if (item.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx, cameraX) {
    for (const item of this.items) {
      const x = item.x - cameraX;
      if (x < -35 || x > 995) continue;
      const color = item.type === "medkit" ? "#9bc886" : "#8cd0d5";
      ctx.save(); ctx.translate(x, item.y);
      ctx.globalAlpha = .22; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = "#33423a"; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.fillRect(-11, -10, 22, 21); ctx.strokeRect(-11, -10, 22, 21);
      ctx.fillStyle = color;
      if (item.type === "medkit") {
        ctx.fillRect(-2, -7, 4, 14); ctx.fillRect(-7, -2, 14, 4);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, -5); ctx.lineTo(5, 3); ctx.lineTo(0, 8); ctx.lineTo(-5, 3); ctx.lineTo(-6, -5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
}
