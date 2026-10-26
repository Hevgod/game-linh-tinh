export function updateArcherTactics(bot, player, dt) {
  const deltaX = player.x - bot.x;
  const direction = Math.sign(deltaX);
  const distance = Math.abs(deltaX);
  bot.strafeTimer -= dt;
  if (bot.strafeTimer <= 0) {
    bot.strafeDirection *= -1;
    bot.strafeTimer = 1 + Math.random() * 1.4;
  }

  if (distance < 215) {
    bot.state = "retreat";
    return -direction;
  }
  if (distance > 445) {
    bot.state = "approach";
    return direction;
  }
  bot.state = "strafe";
  return bot.strafeDirection;
}

export function archerReadyToFire(bot, player, canSeePlayer) {
  bot.shotCooldown = Math.max(0, bot.shotCooldown);
  const distance = Math.abs(player.x - bot.x);
  return distance > 175 && distance < 570 && bot.shotCooldown <= 0 && canSeePlayer();
}

export function createArcherArrow(bot, player) {
  const speed = 490;
  const gravity = 520;
  const originX = bot.x + bot.facing * 13;
  const originY = bot.y + 12;
  const estimatedFlight = Math.abs(player.x - originX) / speed;
  const targetX = player.x + player.vx * estimatedFlight * .28;
  const targetY = player.y + player.height * .42;
  const angle = Math.atan2(
    targetY - originY - gravity * estimatedFlight * estimatedFlight * .5,
    targetX - originX,
  );
  bot.shotCooldown = 1.65 + Math.random() * .6;
  bot.state = "shoot";
  return {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    gravity,
    owner: bot,
    distance: 0,
    life: 1.7,
  };
}
