const STORAGE_KEY = "last-light-frontier-v1";

function loadSavedData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      bestDistance: Number.isFinite(saved.bestDistance) ? Math.max(0, saved.bestDistance) : 0,
      totalKills: Number.isFinite(saved.totalKills) ? Math.max(0, saved.totalKills) : 0,
    };
  } catch (error) {
    console.warn("Could not load saved frontier data.", error);
    return { bestDistance: 0, totalKills: 0 };
  }
}

export class UserData {
  constructor() {
    Object.assign(this, loadSavedData());
  }

  recordRun(distance, kills) {
    this.bestDistance = Math.max(this.bestDistance, Math.floor(distance));
    this.totalKills += kills;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bestDistance: this.bestDistance,
        totalKills: this.totalKills,
      }));
    } catch (error) {
      console.warn("Could not save frontier data.", error);
    }
  }
}
