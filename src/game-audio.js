const audioFiles = {
  shot: new URL("../assets/audio/akm-shot.wav", import.meta.url),
  step: new URL("../assets/audio/dirt-step.wav", import.meta.url),
  reload: new URL("../assets/audio/reload.wav", import.meta.url),
  playerHit: new URL("../assets/audio/player-hit.wav", import.meta.url),
  health: new URL("../assets/audio/health-pickup.wav", import.meta.url),
  shield: new URL("../assets/audio/shield-pickup.wav", import.meta.url),
  targetHit: new URL("../assets/audio/target-hit.wav", import.meta.url),
  music: new URL("../assets/audio/frontier-theme.wav", import.meta.url),
};

function makeAudio(file, { volume, loop = false } = {}) {
  const audio = new Audio(file.href);
  audio.preload = loop ? "none" : "auto";
  audio.volume = volume;
  audio.loop = loop;
  audio.addEventListener("error", () => {
    console.warn(`Unable to load game audio: ${file.pathname}`);
  }, { once: true });
  return audio;
}

export class GameAudio {
  constructor(toggleButton, i18n) {
    this.toggleButton = toggleButton;
    this.i18n = i18n;
    this.enabled = this.loadPreference();
    this.active = false;
    this.stepTimer = 0;
    this.shotIndex = 0;
    this.stepIndex = 0;
    this.shots = Array.from({ length: 4 }, () => makeAudio(audioFiles.shot, { volume: 0.56 }));
    this.steps = Array.from({ length: 3 }, () => makeAudio(audioFiles.step, { volume: 0.3 }));
    this.effects = {
      reload: makeAudio(audioFiles.reload, { volume: 0.55 }),
      playerHit: makeAudio(audioFiles.playerHit, { volume: 0.64 }),
      health: makeAudio(audioFiles.health, { volume: 0.46 }),
      shield: makeAudio(audioFiles.shield, { volume: 0.4 }),
      targetHit: makeAudio(audioFiles.targetHit, { volume: 0.4 }),
    };
    this.music = makeAudio(audioFiles.music, { volume: 0.25, loop: true });
    this.applyPreference();
    this.toggleButton.addEventListener("click", () => this.toggle());
  }

  loadPreference() {
    try {
      return localStorage.getItem("memaybeo-audio") !== "off";
    } catch (error) {
      console.warn("Could not load audio preference.", error);
      return true;
    }
  }

  savePreference() {
    try {
      localStorage.setItem("memaybeo-audio", this.enabled ? "on" : "off");
    } catch (error) {
      console.warn("Could not save audio preference.", error);
    }
  }

  applyPreference() {
    this.toggleButton.textContent = this.enabled ? "♫" : "♪";
    this.toggleButton.setAttribute("aria-pressed", String(this.enabled));
    const label = this.i18n.t(this.enabled ? "muteAudio" : "enableAudio");
    this.toggleButton.setAttribute("aria-label", label);
    this.toggleButton.title = label;
    this.music.muted = !this.enabled;
    for (const audio of [...this.shots, ...this.steps, ...Object.values(this.effects)]) audio.muted = !this.enabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.savePreference();
    this.applyPreference();
    if (this.enabled && this.active) this.playMusic();
  }

  playMusic() {
    if (!this.enabled || !this.active) return;
    this.music.play().catch(error => {
      console.warn("Unable to start the frontier soundtrack.", error);
    });
  }

  startGame() {
    this.active = true;
    if (!this.enabled) return;
    this.playMusic();
  }

  stopGame() {
    this.active = false;
    this.music.pause();
    this.music.currentTime = 0;
    this.stepTimer = 0;
  }

  playShot() {
    if (!this.enabled || !this.active) return;
    const audio = this.shots[this.shotIndex];
    this.shotIndex = (this.shotIndex + 1) % this.shots.length;
    this.playEffect(audio);
  }

  playReload() {
    this.playEffect(this.effects.reload);
  }

  playPlayerHit() {
    this.playEffect(this.effects.playerHit);
  }

  playHealthPickup() {
    this.playEffect(this.effects.health);
  }

  playShieldPickup() {
    this.playEffect(this.effects.shield);
  }

  playTargetHit() {
    this.playEffect(this.effects.targetHit);
  }

  playEffect(audio) {
    if (!this.enabled || !this.active) return;
    audio.currentTime = 0;
    audio.play().catch(error => {
      console.warn(`Unable to play game sound: ${audio.src}`, error);
    });
  }

  updateFootsteps(dt, player, input) {
    if (!this.enabled || !this.active || !player.onGround || Math.abs(player.vx) < 60 || !input.x) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer += dt;
    const interval = input.run ? 0.29 : 0.37;
    if (this.stepTimer < interval) return;
    this.stepTimer %= interval;
    const audio = this.steps[this.stepIndex];
    this.stepIndex = (this.stepIndex + 1) % this.steps.length;
    audio.playbackRate = input.run ? 1.12 : 0.94;
    audio.currentTime = 0;
    audio.play().catch(error => {
      console.warn("Unable to play the footstep sound.", error);
    });
  }
}
