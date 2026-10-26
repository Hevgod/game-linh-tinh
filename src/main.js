import { World } from "./world.js";
import { Player } from "./player-model.js";
import { BotManager } from "./bot-logic.js";
import { Weapon } from "./weapon.js";
import { SupplyManager } from "./supplies.js";
import { Controls } from "./controls.js";
import { GameUI } from "./game-ui.js";
import { UserData } from "./user-data.js";
import { Milestones } from "./milestones.js";
import { FrontierProgression } from "./frontier-progression.js";
import { I18n } from "./i18n.js";
import { akmImage, drawAKM } from "./weapon-model.js";
import { GameAudio } from "./game-audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const weaponPreview = document.getElementById("weapon-preview");
const weaponPreviewContext = weaponPreview.getContext("2d");
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const world = new World();
const i18n = new I18n();
const ui = new GameUI(i18n);
const audio = new GameAudio(document.getElementById("audio-toggle"), i18n);
const data = new UserData();
const weapon = new Weapon();
const supplies = new SupplyManager();
const milestones = new Milestones();
const progression = new FrontierProgression();
const bots = new BotManager(world);
const controls = new Controls(canvas, {
  stickZone: document.getElementById("stick-zone"),
  knob: document.getElementById("stick-knob"),
  jumpButton: document.getElementById("jump-button"),
  fireButton: document.getElementById("fire-button"),
  reloadButton: document.getElementById("reload-button"),
});

let player = new Player(world);
let running = false;
let elapsed = 0;
let lastFrame = 0;
let cameraX = 0;
let flash = 0;
let statusKey = "startStatus";
let statusValues = {};
let hudAccumulator = 0;
let fpsFrames = 0;
let fpsSampleStart = 0;
const vignette = ctx.createRadialGradient(480, 270, 165, 480, 270, 590);
vignette.addColorStop(0, "rgba(19,27,29,0)");
vignette.addColorStop(1, "rgba(20,31,32,.25)");

function setStatus(key, values = {}) {
  statusKey = key;
  statusValues = values;
  const translatedValues = key === "biomeDiscovered" && values.biomeEn
    ? { biome: values[i18n.language === "vi" ? "biomeVi" : "biomeEn"] }
    : values;
  ui.el["status-text"].textContent = i18n.t(key, translatedValues);
}

function reset() {
  player = new Player(world);
  bots.reset(player.x);
  weapon.reset();
  supplies.reset();
  milestones.reset();
  progression.reset();
  elapsed = 0;
  cameraX = 0;
  flash = 0;
  hudAccumulator = 0;
  fpsFrames = 0;
  fpsSampleStart = 0;
  lastFrame = performance.now();
  ui.setFPS(null);
  ui.el["end-screen"].classList.add("hidden");
  ui.setPlaying(true);
  setStatus("detected");
  ui.update(player, weapon, bots, data, elapsed, bots.kills, milestones, world.biomeAt(player.x));
}

function start() {
  if (running) return;
  reset();
  running = true;
  audio.startGame();
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

function stop() {
  running = false;
  audio.stopGame();
  ui.setFPS(null);
  data.recordRun(player.distance, bots.kills);
  ui.update(player, weapon, bots, data, elapsed, bots.kills, milestones, world.biomeAt(player.x));
  ui.end(player);
  setStatus("gameOverStatus");
}

function drawEffects() {
  if (flash <= 0) return;
  ctx.fillStyle = `rgba(245,218,161,${flash * .32})`;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function render(time) {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  world.draw(ctx, cameraX, time);
  supplies.draw(ctx, cameraX);
  bots.draw(ctx, cameraX, time);
  weapon.draw(ctx, cameraX);
  player.draw(ctx, cameraX, time);
  drawEffects();
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function frame(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrame) / 1000, .033);
  lastFrame = now;
  fpsFrames++;
  if (!fpsSampleStart) fpsSampleStart = now;
  if (now - fpsSampleStart >= 500) {
    ui.setFPS(Math.round(fpsFrames * 1000 / (now - fpsSampleStart)));
    fpsFrames = 0;
    fpsSampleStart = now;
  }
  elapsed += dt;
  const input = controls.getInput();
  if (input.jumpPressed) player.jump();
  if (input.aim) input.aim = { x: input.aim.x + cameraX, y: input.aim.y };
  player.step(dt, input);
  audio.updateFootsteps(dt, player, input);
  bots.step(dt, player, (bot, attackType) => {
    const shielded = player.shield > 0;
    const damage = attackType === "arrow" ? 1 : .5;
    if (player.takeDamage(damage)) {
      audio.playPlayerHit();
      player.vx += bot.facing * -190;
      if (!player.onGround) player.vy = Math.min(player.vy, -100);
      const message = shielded
        ? i18n.t("shieldHit")
        : i18n.t(attackType === "arrow" ? "arrowHit" : "swordHit");
      ui.toast(message);
      setStatus(attackType === "arrow" ? "arrowHit" : "swordHit");
    }
  });
  weapon.step(dt, player, bots, input, message => {
    if (message) ui.toast(message);
    else {
      flash = .075;
      audio.playShot();
    }
  }, () => audio.playReload());
  weapon.moveBullets(dt, bots, world, () => {
    audio.playTargetHit();
    setStatus("botDisabled");
  });
  progression.update(player, weapon, bots, world.biomeAt(player.x), (type, value) => {
    const key = type === "biome"
      ? "biomeDiscovered"
      : `contract${value[0].toUpperCase()}${value.slice(1)}`;
    const currentBiome = world.biomeAt(player.x);
    const values = type === "biome"
      ? { biomeEn: currentBiome.en, biomeVi: currentBiome.vi }
      : {};
    const toastValues = type === "biome"
      ? { biome: values[i18n.language === "vi" ? "biomeVi" : "biomeEn"] }
      : values;
    ui.toast(i18n.t(key, toastValues));
    setStatus(key, values);
  });
  supplies.step(dt, player, world, type => {
    if (type === "medkit") audio.playHealthPickup();
    else audio.playShieldPickup();
    ui.toast(type === "medkit" ? i18n.t("medkit") : i18n.t("shieldPickup"));
  });
  if (milestones.update(player.distance, player, reached => {
    audio.playHealthPickup();
    ui.toast(i18n.t("milestone", { distance: reached }));
    setStatus("milestone", { distance: reached });
    flash = .4;
  })) {
    flash = Math.max(flash, .2);
  }
  flash = Math.max(0, flash - dt);

  cameraX += (Math.max(0, player.x - VIEW_WIDTH * .39) - cameraX) * Math.min(1, dt * 6);
  if (player.health <= 0) { stop(); render(elapsed); return; }
  render(elapsed);
  hudAccumulator += dt;
  if (hudAccumulator >= .05) {
    hudAccumulator %= .05;
    ui.update(player, weapon, bots, data, elapsed, bots.kills, milestones, world.biomeAt(player.x));
  }
  requestAnimationFrame(frame);
}

document.getElementById("start-button").addEventListener("click", start);
document.getElementById("restart-button").addEventListener("click", start);
document.getElementById("language-toggle").addEventListener("click", () => {
  i18n.toggle();
  setStatus(statusKey, statusValues);
  ui.update(player, weapon, bots, data, elapsed, bots.kills, milestones, world.biomeAt(player.x));
});
document.addEventListener("keydown", event => {
  if (event.key === "Enter" && !running) start();
});

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
    ctx.setTransform(width / 960, 0, 0, height / 540, 0, 0);
    if (!running) render(0);
  }
}

function renderWeaponPreview() {
  const { width, height } = weaponPreview;
  weaponPreviewContext.clearRect(0, 0, width, height);
  weaponPreviewContext.save();
  weaponPreviewContext.translate(width / 2, height / 2);
  drawAKM(weaponPreviewContext, 0, 0, 2.5);
  weaponPreviewContext.restore();
}

akmImage.addEventListener("load", renderWeaponPreview, { once: true });
window.addEventListener("resize", resizeCanvas);
new ResizeObserver(resizeCanvas).observe(document.getElementById("game-frame"));
renderWeaponPreview();
ui.setPlaying(false);
ui.setFPS(null);
i18n.apply();
ui.update(player, weapon, bots, data, elapsed, bots.kills, milestones, world.biomeAt(player.x));
setStatus("startStatus");
render(0);
resizeCanvas();
