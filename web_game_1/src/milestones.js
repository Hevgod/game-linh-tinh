const FIRST_MILESTONES = [1000, 1500, 3600];
const REPEAT_INTERVAL = 2500;

export class Milestones {
  constructor() {
    this.nextIndex = 0;
    this.lastDistance = 0;
    this.nextDistance = FIRST_MILESTONES[0];
  }

  reset() {
    this.nextIndex = 0;
    this.lastDistance = 0;
    this.nextDistance = FIRST_MILESTONES[0];
  }

  update(distance, player, onMilestone) {
    if (distance < this.nextDistance) return false;
    const reached = this.nextDistance;
    player.health = Math.min(player.maxHealth, player.health + 1);
    onMilestone(reached, player.health);
    this.lastDistance = reached;
    this.nextIndex++;
    this.nextDistance = FIRST_MILESTONES[this.nextIndex]
      ?? FIRST_MILESTONES[FIRST_MILESTONES.length - 1] + REPEAT_INTERVAL * (this.nextIndex - FIRST_MILESTONES.length + 1);
    return true;
  }

  progress(distance) {
    const interval = this.nextDistance - this.lastDistance;
    return Math.max(0, Math.min(100, (distance - this.lastDistance) / interval * 100));
  }
}
