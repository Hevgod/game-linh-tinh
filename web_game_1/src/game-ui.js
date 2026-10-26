export class GameUI {
  constructor(i18n) {
    this.i18n = i18n;
    this.el = Object.fromEntries([
      "start-screen", "end-screen", "start-button", "restart-button", "status-text",
      "hearts", "desktop-hearts", "health-label", "desktop-health", "ammo-current",
      "magazine-label", "ammo-bar", "reload-label", "kill-count", "bot-count",
      "distance-label", "coordinate", "progress-fill", "best-distance", "clock",
      "hud-day", "end-copy", "final-score", "toast", "game-frame", "region-label",
      "fps-counter", "desktop-fps",
    ].map(id => [id, document.getElementById(id)]));
  }

  update(player, weapon, bots, data, elapsed, kills, milestones, biome) {
    const health = `${player.health.toFixed(1)} / ${player.maxHealth}`;
    this.el["health-label"].textContent = health;
    this.el["desktop-health"].textContent = health;
    const hearts = Array.from({ length: player.maxHealth }, (_, i) => {
      const value = Math.max(0, Math.min(1, player.health - i));
      return `<span class="heart${value === 0 ? " empty" : value < 1 ? " half" : ""}">♥</span>`;
    }).join("");
    this.el.hearts.innerHTML = hearts;
    this.el["desktop-hearts"].innerHTML = hearts;
    const heartLabel = this.i18n.t("hearts", { health: player.health, maxHealth: player.maxHealth });
    this.el.hearts.setAttribute("aria-label", heartLabel);
    this.el["desktop-hearts"].setAttribute("aria-label", heartLabel);
    this.el["ammo-current"].textContent = weapon.reloadTime > 0 ? "··" : String(weapon.ammo).padStart(2, "0");
    this.el["magazine-label"].textContent = weapon.reloadTime > 0 ? "··" : String(weapon.ammo);
    this.el["ammo-bar"].style.width = `${weapon.ammo / weapon.magazineSize * 100}%`;
    this.el["reload-label"].textContent = weapon.reloadTime > 0 ? this.i18n.t("reloading") : weapon.ammo === weapon.magazineSize ? this.i18n.t("magazineFull") : this.i18n.t("reloadPrompt");
    this.el["kill-count"].textContent = String(kills).padStart(3, "0");
    this.el["bot-count"].textContent = String(bots.bots.length).padStart(2, "0");
    this.el["distance-label"].textContent = `${player.distance} M${this.i18n.language === "en" ? " EXPLORED" : " ĐÃ KHÁM PHÁ"}`;
    const region = biome ? biome[this.i18n.language === "vi" ? "vi" : "en"] : this.i18n.t("region");
    this.el["region-label"].textContent = region;
    this.el["coordinate"].innerHTML = `${region} <span>·</span> ${String(player.distance).padStart(3, "0")} M`;
    this.el["progress-fill"].style.width = `${milestones.progress(player.distance)}%`;
    this.el["best-distance"].textContent = `${data.bestDistance} M`;
    const minutes = Math.floor(elapsed / 60);
    const hours = (8 + minutes) % 12 || 12;
    const clockMinutes = Math.floor((elapsed % 60)).toString().padStart(2, "0");
    this.el.clock.textContent = this.i18n.language === "vi"
      ? `${String(hours).padStart(2, "0")}:${clockMinutes} · ${minutes < 4 ? "SÁNG" : "CHIỀU"}`
      : `${String(hours).padStart(2, "0")}:${clockMinutes} ${minutes < 4 ? "AM" : "PM"}`;
    const day = String(Math.floor(elapsed / 180) + 1).padStart(2, "0");
    this.el["hud-day"].textContent = day;
  }

  setFPS(fps) {
    const value = fps === null ? "--" : String(fps);
    this.el["fps-counter"].textContent = value;
    this.el["desktop-fps"].textContent = value;
  }

  setPlaying(playing) {
    this.el["start-screen"].classList.toggle("hidden", playing);
    this.el["game-frame"].classList.toggle("is-playing", playing);
  }

  toast(message) {
    if (!message) return;
    const toast = this.el.toast;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add("hidden"), 1450);
  }

  end(player) {
    this.el["end-copy"].textContent = this.i18n.t("endMessage", { distance: player.distance });
    this.el["final-score"].textContent = this.i18n.t("score", { distance: player.distance });
    this.el["end-screen"].classList.remove("hidden");
    this.el["game-frame"].classList.remove("is-playing");
  }
}
