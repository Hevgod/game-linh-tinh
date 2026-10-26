import { biomeAtWorldX, biomePositionAt, weightedChoice, weightedValue } from "./world-biomes.js";

const TILE = 32;
const CHUNK = 800;
const VIEW_WIDTH = 960;

function hash(seed) {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function random(seed) {
  let state = hash(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixColor(from, to, amount) {
  const parse = color => [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
  const start = parse(from);
  const end = parse(to);
  const channels = start.map((value, index) => Math.round(value + (end[index] - value) * amount));
  return `rgb(${channels.join(",")})`;
}

export class World {
  constructor() {
    this.tile = TILE;
    this.trees = [];
    this.structures = [];
    this.chunks = new Map();
    this.backgroundTrees = new Map();
    this.firstChunk = Infinity;
    this.lastChunk = -Infinity;
    this.backgroundGradient = null;
    this.horizonGradient = null;
    this.ridgeGradients = null;
    this.backgroundVignette = null;
    this.sunSprite = null;
    this.ensureArea(-VIEW_WIDTH, VIEW_WIDTH * 2);
  }

  biomeAt(worldX) {
    return biomeAtWorldX(worldX);
  }

  groundAt(x) {
    const biome = biomePositionAt(x);
    const broad = Math.sin(x * .00072) * 40 + Math.sin(x * .0019 + 1.6) * 25;
    const middle = Math.sin(x * .0064 + Math.sin(x * .0011)) * 7;
    const cell = Math.floor(x / 144);
    const mix = (x / 144) - cell;
    const smooth = mix * mix * (3 - 2 * mix);
    const left = ((hash(cell + 2137) / 4294967295) - .5) * 20;
    const right = ((hash(cell + 2138) / 4294967295) - .5) * 20;
    const biomeOffset = weightedValue(biome, "surfaceOffset");
    return Math.round((398 + biomeOffset + broad + middle + left * (1 - smooth) + right * smooth) / 2) * 2;
  }

  ensureArea(left, right) {
    const first = Math.floor(left / CHUNK) - 1;
    const last = Math.floor(right / CHUNK) + 1;
    if (first >= this.firstChunk && last <= this.lastChunk) return;
    for (let index = first; index <= last; index++) {
      if (!this.chunks.has(index)) this.chunks.set(index, this.createChunk(index));
    }
    for (const [index] of this.chunks) {
      if (index < first - 2 || index > last + 2) this.chunks.delete(index);
    }
    this.firstChunk = first;
    this.lastChunk = last;
    this.trees = [];
    this.structures = [];
    for (const chunk of this.chunks.values()) {
      this.trees.push(...chunk.trees);
      this.structures.push(...chunk.structures);
    }
  }

  createChunk(index) {
    const start = index * CHUNK;
    const rand = random(index + 94117);
    const trees = [];
    for (let n = 0; n < 17; n++) {
      const x = start + 24 + rand() * (CHUNK - 48);
      const biome = this.biomeAt(x);
      if (rand() > biome.treeDensity) continue;
      const ground = this.groundAt(x);
      if (ground > 255) trees.push({
        x, y: ground, height: 42 + rand() * 82, width: 17 + rand() * 26,
        tone: Math.floor(rand() * 6), layer: .12 + rand() * .88,
        species: this.chooseTreeSpecies(biome, rand),
        seed: Math.floor(rand() * 4294967295),
        sprite: null,
      });
    }

    const structures = [];
    const structureRoll = rand();
    if (structureRoll > .48) {
      const x = start + CHUNK * (.24 + rand() * .52);
      const biome = this.biomeAt(x);
      structures.push({
        type: weightedChoice(biome.structureWeights, rand),
        x, y: this.groundAt(x), variant: Math.floor(rand() * 3),
      });
    }

    const details = [];
    for (let n = 0; n < 23; n++) {
      const x = start + 18 + rand() * (CHUNK - 36);
      const nearStructure = structures.some(structure => Math.abs(x - structure.x) < 112);
      if (nearStructure || this.groundAt(x) < 270) continue;
      const biome = this.biomeAt(x);
      details.push({
        x, y: this.groundAt(x),
        type: weightedChoice(biome.detailWeights, rand),
        size: .65 + rand() * .75,
        tone: Math.floor(rand() * 5),
        seed: Math.floor(rand() * 4294967295),
      });
    }

    return { trees, structures, details, terrainCanvas: null, detailCanvas: null };
  }

  chooseTreeSpecies(biome, rand) {
    if (biome.id === "sunscarredReach") return rand() < .48 ? "cactus" : "broadleaf";
    if (biome.id === "mistfen") return rand() < .42 ? "broadleaf" : "pine";
    if (biome.id === "frostline") return rand() < .9 ? "pine" : "broadleaf";
    return rand() < .3 ? "broadleaf" : "pine";
  }

  drawBackground(ctx, cameraX, time) {
    const position = biomePositionAt(cameraX + VIEW_WIDTH / 2);
    const blendStep = Math.round(position.blend * 20);
    const paletteKey = `${position.blendFrom.id}:${position.blendTo.id}:${blendStep}`;
    if (!this.backgroundGradient || this.backgroundBiomeId !== paletteKey) {
      this.backgroundBiomeId = paletteKey;
      const sky = position.blendFrom.sky.map((color, index) =>
        mixColor(color, position.blendTo.sky[index], blendStep / 20));
      const ridges = position.blendFrom.ridges.map(([top, bottom], index) => [
        mixColor(top, position.blendTo.ridges[index][0], blendStep / 20),
        mixColor(bottom, position.blendTo.ridges[index][1], blendStep / 20),
      ]);
      this.backgroundGradient = ctx.createLinearGradient(0, 0, 0, 540);
      this.backgroundGradient.addColorStop(0, sky[0]);
      this.backgroundGradient.addColorStop(.4, sky[1]);
      this.backgroundGradient.addColorStop(.73, sky[2]);
      this.backgroundGradient.addColorStop(1, sky[3]);
      this.horizonGradient = ctx.createLinearGradient(0, 230, 0, 440);
      this.horizonGradient.addColorStop(0, "rgba(229,210,168,0)");
      this.horizonGradient.addColorStop(.6, "rgba(232,207,157,.3)");
      this.horizonGradient.addColorStop(1, "rgba(198,168,124,0)");
      this.ridgeGradients = ridges.map(([top, bottom]) => {
        const gradient = ctx.createLinearGradient(0, 210, 0, 455);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, bottom);
        return gradient;
      });
      this.backgroundVignette = ctx.createLinearGradient(0, 0, 0, 540);
      this.backgroundVignette.addColorStop(0, "rgba(24,39,43,.02)");
      this.backgroundVignette.addColorStop(1, "rgba(42,45,34,.14)");
    }
    ctx.fillStyle = this.backgroundGradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, 540);

    if (!this.sunSprite) {
      this.sunSprite = document.createElement("canvas");
      this.sunSprite.width = 168;
      this.sunSprite.height = 168;
      const sun = this.sunSprite.getContext("2d");
      const glow = sun.createRadialGradient(84, 84, 6, 84, 84, 84);
      glow.addColorStop(0, "rgba(255,247,216,.9)");
      glow.addColorStop(.22, "rgba(255,227,174,.42)");
      glow.addColorStop(1, "rgba(255,215,158,0)");
      sun.fillStyle = glow;
      sun.fillRect(0, 0, 168, 168);
      sun.beginPath();
      sun.arc(84, 84, 26, 0, Math.PI * 2);
      sun.fillStyle = "rgba(255,237,194,.87)";
      sun.fill();
    }
    const sunDrift = Math.sin(time * .018) * 5;
    ctx.drawImage(this.sunSprite, 720 - cameraX * .035 + sunDrift, 46, 168, 168);
    this.drawCloud(ctx, 185 - cameraX * .075 - time * 1.1, 112, 1.05, .3);
    this.drawCloud(ctx, 880 - cameraX * .055 - time * .7, 168, .72, .22);
    this.drawRidge(ctx, cameraX, 270, this.ridgeGradients[0], .1, 118, 300);
    this.drawRidge(ctx, cameraX, 315, this.ridgeGradients[1], .2, 91, 230);
    this.drawRidge(ctx, cameraX, 352, this.ridgeGradients[2], .34, 56, 145);
    ctx.fillStyle = this.horizonGradient;
    ctx.fillRect(0, 205, VIEW_WIDTH, 245);

    this.drawBackgroundForest(ctx, cameraX);
    ctx.fillStyle = this.backgroundVignette;
    ctx.fillRect(0, 0, VIEW_WIDTH, 540);
  }

  drawBackgroundForest(ctx, cameraX) {
    const layers = [
      { factor: .12, spacing: 47, baseline: 321, scale: .25, alpha: .38 },
      { factor: .22, spacing: 58, baseline: 345, scale: .36, alpha: .52 },
      { factor: .34, spacing: 72, baseline: 370, scale: .48, alpha: .67 },
    ];
    const visibleKeys = new Set();
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const left = cameraX * layer.factor - 100;
      const right = cameraX * layer.factor + VIEW_WIDTH + 100;
      const firstCell = Math.floor(left / layer.spacing);
      const lastCell = Math.ceil(right / layer.spacing);
      for (let cell = firstCell; cell <= lastCell; cell++) {
        const key = `${layerIndex}:${cell}`;
        visibleKeys.add(key);
        let tree = this.backgroundTrees.get(key);
        if (!tree) {
          const rand = random(cell * 173 + layerIndex * 7919 + 48271);
          tree = {
            x: (cell + .5 + (rand() - .5) * .62) * layer.spacing,
            height: 48 + rand() * 68,
            width: 17 + rand() * 21,
            tone: Math.floor(rand() * 6),
            species: this.chooseTreeSpecies(this.biomeAt((cell + .5) * layer.spacing), rand),
            seed: Math.floor(rand() * 4294967295),
            sprite: null,
            layer: layerIndex,
          };
          this.backgroundTrees.set(key, tree);
        }
        const screenX = tree.x - cameraX * layer.factor;
        const scale = layer.scale * (.78 + tree.height / 250);
        const groundY = layer.baseline + (hash(cell + layerIndex * 101) % 9) - 4;
        this.drawTree(ctx, tree, screenX, groundY - tree.height * scale, layer.alpha, scale);
      }
    }
    for (const key of this.backgroundTrees.keys()) {
      if (!visibleKeys.has(key)) this.backgroundTrees.delete(key);
    }
  }

  drawCloud(ctx, x, y, scale, alpha) {
    const wrappedX = ((x % 1240) + 1240) % 1240 - 140;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f4e9d3";
    ctx.beginPath();
    ctx.ellipse(wrappedX, y + 4 * scale, 47 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(wrappedX - 24 * scale, y + 2 * scale, 21 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(wrappedX - 6 * scale, y - 7 * scale, 27 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(wrappedX + 20 * scale, y, 25 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCactus(ctx, x, y, width, height) {
    const stemWidth = Math.max(4, width * .31);
    const body = ctx.createLinearGradient(x - stemWidth, 0, x + stemWidth, 0);
    body.addColorStop(0, "#526d48");
    body.addColorStop(.35, "#88a260");
    body.addColorStop(.72, "#6f8b50");
    body.addColorStop(1, "#425a42");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x - stemWidth / 2, y + height * .18, stemWidth, height * .82, stemWidth * .42);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - stemWidth * .4, y + height * .56);
    ctx.lineTo(x - width * .48, y + height * .56);
    ctx.quadraticCurveTo(x - width * .65, y + height * .56, x - width * .65, y + height * .4);
    ctx.lineTo(x - width * .65, y + height * .29);
    ctx.quadraticCurveTo(x - width * .65, y + height * .19, x - width * .48, y + height * .19);
    ctx.lineTo(x - width * .39, y + height * .19);
    ctx.strokeStyle = "#779256";
    ctx.lineWidth = Math.max(4, width * .2);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + stemWidth * .4, y + height * .69);
    ctx.lineTo(x + width * .46, y + height * .69);
    ctx.quadraticCurveTo(x + width * .62, y + height * .69, x + width * .62, y + height * .52);
    ctx.lineTo(x + width * .62, y + height * .43);
    ctx.stroke();
    ctx.strokeStyle = "rgba(214,211,159,.5)";
    ctx.lineWidth = 1;
    for (let rib = -1; rib <= 1; rib++) {
      ctx.beginPath();
      ctx.moveTo(x + rib * stemWidth * .24, y + height * .29);
      ctx.lineTo(x + rib * stemWidth * .24, y + height * .93);
      ctx.stroke();
    }
    ctx.fillStyle = "#c5a76b";
    ctx.beginPath(); ctx.arc(x, y + height * .16, stemWidth * .23, Math.PI, Math.PI * 2); ctx.fill();
  }

  drawRidge(ctx, cameraX, baseline, color, factor, amplitude, period) {
    ctx.beginPath();
    ctx.moveTo(0, 540);
    for (let x = 0; x <= VIEW_WIDTH + 20; x += 20) {
      const worldX = x + cameraX * factor;
      const y = baseline + Math.sin(worldX / period) * amplitude * .52 + Math.sin(worldX / (period * .39) + 2) * amplitude * .23;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_WIDTH + 20, 540); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }

  drawPine(ctx, x, y, width, height, tone, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const trunk = width * .15;
    const bark = ctx.createLinearGradient(x - trunk, 0, x + trunk, 0);
    bark.addColorStop(0, "#393b32");
    bark.addColorStop(.45, "#705d43");
    bark.addColorStop(1, "#403e34");
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.moveTo(x - trunk * .42, y + height * .23);
    ctx.lineTo(x + trunk * .42, y + height * .23);
    ctx.lineTo(x + trunk * .63, y + height);
    ctx.lineTo(x - trunk * .65, y + height);
    ctx.closePath();
    ctx.fill();

    const greens = ["#30473f", "#375245", "#435a45", "#4c6048", "#536548", "#385044"];
    for (let i = 0; i < 6; i++) {
      const level = i / 6;
      const top = y + level * height * .71;
      const spread = width * (.22 + level * .48);
      const bottom = top + height * (.25 + level * .1);
      const branch = ctx.createLinearGradient(x - spread, top, x + spread, bottom);
      branch.addColorStop(0, greens[(tone + i + 1) % greens.length]);
      branch.addColorStop(.42, greens[(tone + i) % greens.length]);
      branch.addColorStop(1, "#293f37");
      ctx.fillStyle = branch;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.bezierCurveTo(x - spread * .14, top + height * .12, x - spread * .46, bottom - height * .08, x - spread, bottom);
      ctx.quadraticCurveTo(x - spread * .72, bottom - height * .012, x - spread * .62, bottom + height * .023);
      ctx.quadraticCurveTo(x - spread * .32, bottom - height * .015, x - spread * .14, bottom + height * .034);
      ctx.quadraticCurveTo(x + spread * .3, bottom + height * .012, x + spread, bottom + height * .026);
      ctx.bezierCurveTo(x + spread * .62, top + height * .17, x + spread * .19, top + height * .09, x, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(190,197,147,.25)";
      ctx.lineWidth = Math.max(.65, width * .023);
      ctx.beginPath();
      ctx.moveTo(x, top + height * .045);
      ctx.lineTo(x - spread * .56, bottom - height * .035);
      ctx.moveTo(x, top + height * .06);
      ctx.lineTo(x + spread * .4, bottom - height * .018);
      ctx.stroke();
      ctx.fillStyle = "rgba(192,194,145,.13)";
      ctx.beginPath();
      ctx.ellipse(x - spread * .35, bottom - height * .035, spread * .22, height * .025, -.2, 0, Math.PI * 2);
      ctx.ellipse(x + spread * .28, bottom - height * .005, spread * .2, height * .02, .18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTree(ctx, tree, x, y, alpha = 1, scale = 1) {
    if (!tree.sprite) {
      const sprite = document.createElement("canvas");
      const cactus = tree.species === "cactus";
      sprite.width = Math.ceil(tree.width * (cactus ? 1.9 : tree.species === "broadleaf" ? 2.05 : 1.55) + 6);
      sprite.height = Math.ceil(tree.height + 3);
      const spriteCtx = sprite.getContext("2d");
      if (tree.species === "broadleaf") {
        this.drawBroadleaf(spriteCtx, sprite.width / 2, 0, tree.width, tree.height, tree.tone, tree.seed);
      } else if (cactus) {
        this.drawCactus(spriteCtx, sprite.width / 2, 0, tree.width, tree.height);
      } else {
        this.drawPine(spriteCtx, sprite.width / 2, 0, tree.width, tree.height, tree.tone);
      }
      tree.sprite = sprite;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(tree.sprite, x - tree.sprite.width * scale / 2, y, tree.sprite.width * scale, tree.sprite.height * scale);
    ctx.restore();
  }

  drawBroadleaf(ctx, x, y, width, height, tone, seed) {
    const rand = random(seed);
    const trunkWidth = Math.max(2.2, width * .14);
    const trunk = ctx.createLinearGradient(x - trunkWidth, 0, x + trunkWidth, 0);
    trunk.addColorStop(0, "#403f34");
    trunk.addColorStop(.43, "#817052");
    trunk.addColorStop(.72, "#685943");
    trunk.addColorStop(1, "#393d34");
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth * .42, y + height * .34);
    ctx.quadraticCurveTo(x - trunkWidth * .5, y + height * .62, x - trunkWidth * .78, y + height);
    ctx.lineTo(x + trunkWidth * .8, y + height);
    ctx.quadraticCurveTo(x + trunkWidth * .42, y + height * .58, x + trunkWidth * .38, y + height * .32);
    ctx.quadraticCurveTo(x + trunkWidth * .14, y + height * .14, x, y + height * .08);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(119,99,66,.9)";
    ctx.lineWidth = Math.max(1.2, width * .085);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + height * .54);
    ctx.quadraticCurveTo(x - width * .18, y + height * .34, x - width * .38, y + height * .27);
    ctx.moveTo(x + width * .04, y + height * .43);
    ctx.quadraticCurveTo(x + width * .22, y + height * .25, x + width * .4, y + height * .2);
    ctx.moveTo(x - width * .1, y + height * .39);
    ctx.lineTo(x - width * .16, y + height * .16);
    ctx.stroke();

    const leaves = [
      ["#3e5945", "#536b4a"],
      ["#4b6047", "#66734c"],
      ["#566849", "#798056"],
      ["#405743", "#5d704b"],
      ["#625f40", "#83734a"],
      ["#465b49", "#6a754f"],
    ];
    const [shadow, light] = leaves[tone % leaves.length];
    const canopy = ctx.createRadialGradient(x - width * .18, y + height * .29, 1, x, y + height * .36, width * .88);
    canopy.addColorStop(0, light);
    canopy.addColorStop(.64, shadow);
    canopy.addColorStop(1, "#314538");
    ctx.fillStyle = canopy;
    for (let i = 0; i < 15; i++) {
      const clusterX = x + (rand() - .5) * width * 1.15;
      const clusterY = y + height * (.16 + rand() * .43);
      const radiusX = width * (.12 + rand() * .18);
      const radiusY = height * (.08 + rand() * .085);
      ctx.beginPath();
      ctx.ellipse(clusterX, clusterY, radiusX, radiusY, (rand() - .5) * .45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(207,196,137,.16)";
    for (let i = 0; i < 8; i++) {
      const glintX = x + (rand() - .5) * width * .95;
      const glintY = y + height * (.22 + rand() * .29);
      ctx.beginPath();
      ctx.ellipse(glintX, glintY, width * .075, height * .022, (rand() - .5) * .5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTerrain(ctx, cameraX) {
    const first = Math.floor(cameraX / CHUNK);
    const last = Math.floor((cameraX + VIEW_WIDTH) / CHUNK);
    for (let index = first; index <= last; index++) {
      const chunk = this.chunks.get(index);
      if (!chunk) continue;
      if (!chunk.terrainCanvas) chunk.terrainCanvas = this.createTerrainCanvas(index);
      ctx.drawImage(chunk.terrainCanvas, index * CHUNK - cameraX, 0);
    }
  }

  createTerrainCanvas(index) {
    const canvas = document.createElement("canvas");
    canvas.width = CHUNK;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    const start = index * CHUNK;
    const tileLeft = Math.floor(start / TILE) * TILE;
    const tileRight = start + CHUNK;

    ctx.beginPath();
    ctx.moveTo(0, 540);
    for (let x = 0; x <= CHUNK; x += TILE) ctx.lineTo(x, this.groundAt(start + x));
    ctx.lineTo(CHUNK, 540);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    for (let x = 0; x < CHUNK; x += 32) {
      const position = biomePositionAt(start + x + 16);
      const amount = position.blend;
      const soilColors = position.blendFrom.soil.map((color, index) =>
        mixColor(color, position.blendTo.soil[index], amount));
      const soil = ctx.createLinearGradient(0, 380, 0, 540);
      soil.addColorStop(0, soilColors[0]);
      soil.addColorStop(.28, soilColors[1]);
      soil.addColorStop(1, soilColors[2]);
      ctx.fillStyle = soil;
      ctx.fillRect(x, 0, 32, 540);
    }
    ctx.restore();

    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = 0; x <= CHUNK; x += 8) {
      const pathY = this.groundAt(start + x) + 13 + Math.sin((start + x) * .003) * 2.2;
      if (x === 0) ctx.moveTo(x, pathY);
      else ctx.lineTo(x, pathY);
    }
    ctx.strokeStyle = "rgba(81,67,51,.34)";
    ctx.lineWidth = 19;
    ctx.stroke();
    ctx.strokeStyle = "rgba(202,172,127,.16)";
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.lineJoin = "round";
    for (let x = 0; x < CHUNK; x += 32) {
      const position = biomePositionAt(start + x + 16);
      const grassBase = mixColor(position.blendFrom.grass[0], position.blendTo.grass[0], position.blend);
      const grassHighlight = mixColor(position.blendFrom.grass[1], position.blendTo.grass[1], position.blend);
      ctx.beginPath();
      ctx.moveTo(x, this.groundAt(start + x));
      ctx.lineTo(x + 32, this.groundAt(start + x + 32));
      ctx.strokeStyle = grassBase;
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = grassHighlight;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let x = tileLeft; x < tileRight; x += 11) {
      const tuftHash = hash(Math.floor(x / 11) * 61);
      if (tuftHash % 3 === 0) continue;
      const screenX = x - start;
      const surface = this.groundAt(x + 5);
      const height = 3 + ((tuftHash >>> 4) % 6);
      ctx.strokeStyle = tuftHash % 2 ? "rgba(176,177,112,.72)" : "rgba(107,130,79,.78)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(screenX + 5, surface + 2);
      ctx.lineTo(screenX + 3, surface - height * .5);
      ctx.moveTo(screenX + 6, surface + 1);
      ctx.lineTo(screenX + 8, surface - height);
      ctx.stroke();
    }

    for (let x = tileLeft; x < tileRight; x += TILE) {
      const localX = x - start;
      const y = this.groundAt(x + TILE * .5);
      for (let row = 0; y + row * TILE < 540; row++) {
        const tileY = y + row * TILE;
        const tileHash = hash(Math.floor(x / TILE) * 19 + row * 83);
        const soilY = tileY + (tileHash % 19);
        ctx.strokeStyle = row === 0 ? "rgba(181,154,109,.26)" : "rgba(181,154,109,.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(localX + 3, soilY);
        ctx.lineTo(localX + 10 + (tileHash % 8), soilY + 1);
        ctx.lineTo(localX + 20 + ((tileHash >>> 4) % 7), soilY - 1);
        ctx.stroke();
        const stoneX = localX + 4 + ((tileHash >>> 7) % 23);
        const stoneY = tileY + 7 + ((tileHash >>> 12) % 19);
        ctx.fillStyle = "rgba(39,43,39,.28)";
        ctx.beginPath();
        ctx.ellipse(stoneX, stoneY, 2 + (tileHash % 3), 1 + ((tileHash >>> 4) % 2), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(215,185,137,.25)";
        ctx.fillRect(stoneX - 1, stoneY - 1, 2, 1);
        if ((tileHash & 3) === 0) {
          ctx.fillStyle = "rgba(40,47,45,.34)";
          ctx.beginPath();
          ctx.ellipse(stoneX + 4, stoneY + 2, 2.7, 1.5, -.24, 0, Math.PI * 2);
          ctx.ellipse(stoneX + 9, stoneY + 4, 1.5, 1, .12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      for (let x = 0; x <= CHUNK; x += 18) {
        const baseY = this.groundAt(start + x) + 45 + layer * 22;
        const strataY = baseY + Math.sin((start + x) * .008 + layer * 1.7) * 4 +
          Math.sin((start + x) * .021 + layer) * 1.7;
        if (x === 0) ctx.moveTo(x, strataY);
        else ctx.lineTo(x, strataY);
      }
      ctx.strokeStyle = layer === 1 ? "rgba(40,47,43,.33)" : "rgba(192,157,110,.22)";
      ctx.lineWidth = layer === 1 ? 3 : 1.4;
      ctx.stroke();
    }

    for (let x = tileLeft + 37; x < tileRight; x += 91) {
      const rootHash = hash(Math.floor(x / 91) * 127);
      if (rootHash % 3 === 0) continue;
      const localX = x - start;
      const surface = this.groundAt(x);
      ctx.strokeStyle = "rgba(83,68,47,.58)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(localX, surface + 2);
      ctx.bezierCurveTo(localX + 1, surface + 8, localX - 6, surface + 10, localX - 8, surface + 15);
      ctx.moveTo(localX + 2, surface + 3);
      ctx.quadraticCurveTo(localX + 8, surface + 8, localX + 11, surface + 12);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(169,151,102,.42)";
    ctx.lineWidth = 2;
    for (let x = tileLeft; x < tileRight; x += TILE * 2) {
      const localX = x + TILE - start;
      const y = this.groundAt(x + TILE);
      ctx.beginPath();
      ctx.moveTo(localX, y + 8);
      ctx.lineTo(localX + 3, y + 16);
      ctx.lineTo(localX - 2, y + 23);
      ctx.stroke();
    }
    return canvas;
  }

  drawChunkDetails(ctx, index, cameraX) {
    const chunk = this.chunks.get(index);
    if (!chunk) return;
    if (!chunk.detailCanvas) {
      chunk.detailCanvas = document.createElement("canvas");
      chunk.detailCanvas.width = CHUNK;
      chunk.detailCanvas.height = 540;
      const detailCtx = chunk.detailCanvas.getContext("2d");
      const start = index * CHUNK;
      for (const detail of chunk.details) {
        detailCtx.save();
        detailCtx.translate(detail.x - start, detail.y);
        if (detail.type === "bush") this.drawBush(detailCtx, detail);
        else if (detail.type === "rock") this.drawRock(detailCtx, detail);
        else if (detail.type === "flowers") this.drawWildflowers(detailCtx, detail);
        else if (detail.type === "reed") this.drawReeds(detailCtx, detail);
        else if (detail.type === "frost") this.drawFrostDetail(detailCtx, detail);
        else if (detail.type === "scrub") this.drawScrub(detailCtx, detail);
        else this.drawFallenLog(detailCtx, detail);
        detailCtx.restore();
      }
      for (const structure of chunk.structures) {
        this.drawStructure(detailCtx, { ...structure, x: structure.x - start }, 0);
      }
    }
    ctx.drawImage(chunk.detailCanvas, index * CHUNK - cameraX, 0);
  }

  drawReeds(ctx, detail) {
    const rand = random(detail.seed);
    const height = 13 * detail.size;
    ctx.fillStyle = "rgba(36,43,34,.2)";
    ctx.beginPath(); ctx.ellipse(0, 0, 15 * detail.size, 3 * detail.size, 0, 0, Math.PI * 2); ctx.fill();
    for (let reed = 0; reed < 5; reed++) {
      const x = (rand() - .5) * 19 * detail.size;
      const reedHeight = height * (.55 + rand() * .7);
      ctx.strokeStyle = reed % 2 ? "#75835a" : "#a08b59";
      ctx.lineWidth = Math.max(.8, detail.size);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + (rand() - .5) * 5, -reedHeight * .65, x + (rand() - .5) * 8, -reedHeight);
      ctx.stroke();
      ctx.fillStyle = "#87714c";
      ctx.beginPath(); ctx.ellipse(x, -reedHeight, 1.5 * detail.size, 4 * detail.size, -.18, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawFrostDetail(ctx, detail) {
    this.drawRock(ctx, detail);
    ctx.fillStyle = "rgba(205,222,218,.72)";
    ctx.beginPath();
    ctx.moveTo(-8 * detail.size, -3 * detail.size);
    ctx.lineTo(-4 * detail.size, -10 * detail.size);
    ctx.lineTo(-1 * detail.size, -4 * detail.size);
    ctx.lineTo(4 * detail.size, -12 * detail.size);
    ctx.lineTo(8 * detail.size, -2 * detail.size);
    ctx.closePath();
    ctx.fill();
  }

  drawScrub(ctx, detail) {
    this.drawBush(ctx, { ...detail, tone: (detail.tone + 4) % 5, size: detail.size * .72 });
    ctx.strokeStyle = "rgba(162,132,82,.8)";
    ctx.lineWidth = Math.max(1, detail.size);
    ctx.beginPath();
    ctx.moveTo(-9 * detail.size, -3);
    ctx.lineTo(-14 * detail.size, -12 * detail.size);
    ctx.moveTo(7 * detail.size, -4);
    ctx.lineTo(12 * detail.size, -14 * detail.size);
    ctx.stroke();
  }

  drawBush(ctx, detail) {
    const size = detail.size;
    const palette = ["#40563e", "#536544", "#66704a", "#465b48", "#705f3f"];
    const base = palette[detail.tone];
    const rand = random(detail.seed);
    ctx.fillStyle = "rgba(31,35,29,.24)";
    ctx.beginPath();
    ctx.ellipse(0, -1, 21 * size, 4.5 * size, 0, 0, Math.PI * 2);
    ctx.fill();
    const leaf = ctx.createLinearGradient(-12 * size, -25 * size, 10 * size, 0);
    leaf.addColorStop(0, "#78805a");
    leaf.addColorStop(.37, base);
    leaf.addColorStop(1, "#293f34");
    ctx.fillStyle = leaf;
    for (let i = 0; i < 7; i++) {
      const x = (rand() - .5) * 25 * size;
      const y = -(3 + rand() * 12) * size;
      const radius = (5 + rand() * 4) * size;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (.67 + rand() * .17), (rand() - .5) * .35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(179,175,120,.32)";
    ctx.lineWidth = Math.max(.55, size);
    ctx.beginPath();
    ctx.moveTo(-11 * size, -9 * size);
    ctx.quadraticCurveTo(-2 * size, -17 * size, 1 * size, -21 * size);
    ctx.moveTo(-1 * size, -5 * size);
    ctx.quadraticCurveTo(5 * size, -13 * size, 12 * size, -14 * size);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "rgba(194,188,137,.5)" : "rgba(36,55,39,.6)";
      ctx.beginPath();
      ctx.ellipse((rand() - .5) * 24 * size, -(5 + rand() * 9) * size, 1.2 * size, .75 * size, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRock(ctx, detail) {
    const size = detail.size;
    const rand = random(detail.seed);
    const width = (7 + rand() * 10) * size;
    const height = (4 + rand() * 6) * size;
    ctx.fillStyle = "rgba(31,35,32,.25)";
    ctx.beginPath();
    ctx.ellipse(1, -1, width * 1.15, height * .48, 0, 0, Math.PI * 2);
    ctx.fill();
    const stone = ctx.createLinearGradient(-width, -height, width * .45, 1);
    stone.addColorStop(0, "#a29b80");
    stone.addColorStop(.32, "#77776a");
    stone.addColorStop(1, "#44483f");
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(-width, -height * .15);
    ctx.lineTo(-width * .59, -height * .87);
    ctx.lineTo(-width * .08, -height);
    ctx.lineTo(width * .55, -height * .73);
    ctx.lineTo(width, -height * .2);
    ctx.lineTo(width * .7, 0);
    ctx.lineTo(-width * .74, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(210,201,168,.38)";
    ctx.lineWidth = Math.max(.6, size * .8);
    ctx.beginPath();
    ctx.moveTo(-width * .6, -height * .65);
    ctx.lineTo(-width * .1, -height * .82);
    ctx.lineTo(width * .34, -height * .58);
    ctx.stroke();
    ctx.fillStyle = "rgba(135,148,93,.55)";
    ctx.beginPath();
    ctx.ellipse(-width * .14, -height * .84, width * .19, height * .11, -.08, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWildflowers(ctx, detail) {
    const size = detail.size;
    const rand = random(detail.seed);
    const palettes = ["#ede1b7", "#d9a878", "#d9d5c1", "#c9b276", "#c48b75"];
    const petal = palettes[detail.tone];
    for (let i = 0; i < 5; i++) {
      const x = (rand() - .5) * 27 * size;
      const height = (7 + rand() * 7) * size;
      ctx.strokeStyle = "rgba(74,99,55,.9)";
      ctx.lineWidth = Math.max(.7, size);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + 2 * size, -height * .6, x + (rand() - .5) * 4 * size, -height);
      ctx.stroke();
      const flowerX = x + (rand() - .5) * 4 * size;
      const flowerY = -height;
      ctx.fillStyle = petal;
      for (let petalIndex = 0; petalIndex < 5; petalIndex++) {
        const angle = petalIndex * Math.PI * .4;
        ctx.beginPath();
        ctx.ellipse(
          flowerX + Math.cos(angle) * 2.1 * size,
          flowerY + Math.sin(angle) * 2.1 * size,
          1.6 * size,
          .95 * size,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#d8ba68";
      ctx.beginPath();
      ctx.arc(flowerX, flowerY, .85 * size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFallenLog(ctx, detail) {
    const size = detail.size;
    const width = 21 * size;
    const height = 5 * size;
    ctx.fillStyle = "rgba(34,35,29,.28)";
    ctx.beginPath();
    ctx.ellipse(2, 0, width * 1.04, height * .65, 0, 0, Math.PI * 2);
    ctx.fill();
    const bark = ctx.createLinearGradient(0, -height * 1.8, 0, 0);
    bark.addColorStop(0, "#92714c");
    bark.addColorStop(.42, "#684e36");
    bark.addColorStop(1, "#423d31");
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.roundRect(-width, -height * 1.2, width * 2, height * 1.45, height * .62);
    ctx.fill();
    ctx.strokeStyle = "rgba(192,153,102,.52)";
    ctx.lineWidth = Math.max(.7, size);
    ctx.beginPath();
    ctx.moveTo(-width * .72, -height * .74);
    ctx.lineTo(width * .65, -height * .74);
    ctx.moveTo(-width * .4, -height * .28);
    ctx.lineTo(width * .8, -height * .28);
    ctx.stroke();
    ctx.fillStyle = "#c0a077";
    ctx.beginPath();
    ctx.ellipse(width * .91, -height * .49, height * .48, height * .56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#66513a";
    ctx.lineWidth = Math.max(.55, size * .8);
    ctx.beginPath();
    ctx.ellipse(width * .91, -height * .49, height * .27, height * .32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawStructure(ctx, structure, cameraX) {
    const x = structure.x - cameraX, y = structure.y;
    if (x < -150 || x > VIEW_WIDTH + 150) return;
    if (structure.type === "cabin") {
      ctx.fillStyle = "rgba(21,25,21,.32)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 76, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#594c39";
      ctx.fillRect(x - 56, y - 8, 112, 9);
      ctx.fillStyle = "#807052";
      ctx.fillRect(x - 53, y - 12, 106, 7);

      const wall = ctx.createLinearGradient(x - 54, y - 67, x + 54, y);
      wall.addColorStop(0, "#96734e"); wall.addColorStop(.55, "#73563c"); wall.addColorStop(1, "#4f4838");
      ctx.fillStyle = wall; ctx.fillRect(x - 52, y - 67, 104, 57);
      ctx.fillStyle = "#594833";
      for (let plankY = y - 58; plankY < y - 11; plankY += 11) {
        ctx.fillRect(x - 50, plankY, 100, 1.5);
      }
      ctx.fillStyle = "#493a2b";
      ctx.fillRect(x - 16, y - 42, 26, 32);
      ctx.fillStyle = "#292e2a";
      ctx.fillRect(x - 12, y - 39, 18, 29);
      ctx.fillStyle = "#b0905d";
      ctx.fillRect(x - 18, y - 44, 30, 3);
      ctx.fillRect(x - 19, y - 10, 32, 4);
      ctx.fillStyle = "#c3a36c";
      ctx.beginPath(); ctx.arc(x + 2, y - 25, 1.6, 0, Math.PI * 2); ctx.fill();

      for (const wx of [x - 42, x + 25]) {
        ctx.fillStyle = "#3c4438"; ctx.fillRect(wx, y - 54, 19, 19);
        ctx.fillStyle = structure.variant === 1 ? "#d1ac68" : "#93a58d";
        ctx.fillRect(wx + 3, y - 51, 13, 13);
        ctx.fillStyle = "rgba(255,232,169,.35)";
        ctx.fillRect(wx + 4, y - 50, 5, 11);
        ctx.strokeStyle = "#c0aa7a"; ctx.lineWidth = 2;
        ctx.strokeRect(wx, y - 54, 19, 19);
        ctx.beginPath(); ctx.moveTo(wx + 9.5, y - 53); ctx.lineTo(wx + 9.5, y - 36);
        ctx.moveTo(wx + 1, y - 45); ctx.lineTo(wx + 18, y - 45); ctx.stroke();
      }

      ctx.fillStyle = "#42392d";
      ctx.beginPath();
      ctx.moveTo(x - 68, y - 64); ctx.lineTo(x - 7, y - 110); ctx.lineTo(x + 68, y - 64);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#795a3c";
      ctx.beginPath();
      ctx.moveTo(x - 59, y - 66); ctx.lineTo(x - 7, y - 103); ctx.lineTo(x + 58, y - 66);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(180,141,94,.34)";
      ctx.beginPath();
      ctx.moveTo(x - 57, y - 66); ctx.lineTo(x - 7, y - 101); ctx.lineTo(x - 3, y - 99);
      ctx.lineTo(x - 43, y - 66); ctx.closePath();
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(195,159,108,.52)"; ctx.lineWidth = 1;
      for (let seam = -49; seam <= 35; seam += 17) {
        ctx.beginPath(); ctx.moveTo(x + seam, y - 68); ctx.lineTo(x - 7 + (seam + 7) * .36, y - 106); ctx.stroke();
      }
      ctx.fillStyle = "#736047"; ctx.fillRect(x + 35, y - 99, 13, 26);
      ctx.fillStyle = "#403a2f"; ctx.fillRect(x + 32, y - 101, 19, 4);
      ctx.fillStyle = "#d0ad68"; ctx.fillRect(x + 42, y - 91, 3, 3);
    } else if (structure.type === "watchtower") {
      ctx.fillStyle = "rgba(24,26,23,.3)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 48, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#514635"; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x - 26, y); ctx.lineTo(x - 17, y - 87);
      ctx.moveTo(x + 26, y); ctx.lineTo(x + 17, y - 87);
      ctx.moveTo(x - 22, y - 8); ctx.lineTo(x + 20, y - 66);
      ctx.moveTo(x + 22, y - 8); ctx.lineTo(x - 20, y - 66);
      ctx.stroke();
      ctx.fillStyle = "#826344"; ctx.fillRect(x - 39, y - 91, 78, 8);
      ctx.fillStyle = "#594833"; ctx.fillRect(x - 44, y - 97, 88, 8);
      ctx.strokeStyle = "#a58a60"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 35, y - 82); ctx.lineTo(x - 35, y - 20);
      ctx.moveTo(x + 35, y - 82); ctx.lineTo(x + 35, y - 20);
      for (let rungY = y - 73; rungY < y - 18; rungY += 11) {
        ctx.moveTo(x - 35, rungY); ctx.lineTo(x + 35, rungY);
      }
      ctx.stroke();

      ctx.fillStyle = "#6b523a"; ctx.fillRect(x - 34, y - 139, 68, 39);
      ctx.fillStyle = "#59432f";
      ctx.beginPath(); ctx.moveTo(x - 43, y - 138); ctx.lineTo(x, y - 169);
      ctx.lineTo(x + 43, y - 138); ctx.lineTo(x + 36, y - 133);
      ctx.lineTo(x, y - 160); ctx.lineTo(x - 36, y - 133); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#9a8054"; ctx.fillRect(x - 38, y - 101, 76, 5);
      for (const wx of [x - 25, x + 8]) {
        ctx.fillStyle = "#30352e"; ctx.fillRect(wx, y - 129, 17, 18);
        ctx.fillStyle = "rgba(220,193,129,.56)"; ctx.fillRect(wx + 3, y - 126, 11, 12);
        ctx.strokeStyle = "#baa579"; ctx.lineWidth = 2; ctx.strokeRect(wx, y - 129, 17, 18);
      }
      ctx.fillStyle = "#c4a86f"; ctx.fillRect(x - 2, y - 137, 5, 28);
    } else if (structure.type === "barn") {
      ctx.fillStyle = "rgba(24,26,23,.3)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 81, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#594b38"; ctx.fillRect(x - 67, y - 8, 134, 9);
      const wall = ctx.createLinearGradient(x - 62, y - 78, x + 62, y);
      wall.addColorStop(0, "#9a624a"); wall.addColorStop(.5, "#80503f"); wall.addColorStop(1, "#59463a");
      ctx.fillStyle = wall; ctx.fillRect(x - 62, y - 75, 124, 66);
      ctx.fillStyle = "rgba(47,42,35,.48)";
      for (let plankX = x - 55; plankX < x + 58; plankX += 17) ctx.fillRect(plankX, y - 72, 2, 60);
      ctx.fillStyle = "#493b30";
      ctx.beginPath(); ctx.moveTo(x - 26, y - 10); ctx.lineTo(x - 26, y - 48);
      ctx.lineTo(x, y - 69); ctx.lineTo(x + 26, y - 48); ctx.lineTo(x + 26, y - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#342f29";
      ctx.beginPath(); ctx.moveTo(x - 20, y - 11); ctx.lineTo(x - 20, y - 45);
      ctx.lineTo(x, y - 62); ctx.lineTo(x + 20, y - 45); ctx.lineTo(x + 20, y - 11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#b59a6d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y - 61); ctx.lineTo(x, y - 12); ctx.moveTo(x - 20, y - 34); ctx.lineTo(x, y - 48); ctx.lineTo(x + 20, y - 34); ctx.stroke();
      ctx.fillStyle = "#443a30";
      ctx.beginPath(); ctx.moveTo(x - 72, y - 74); ctx.lineTo(x - 42, y - 107); ctx.lineTo(x + 42, y - 107); ctx.lineTo(x + 72, y - 74); ctx.lineTo(x + 60, y - 68); ctx.lineTo(x + 36, y - 95); ctx.lineTo(x - 36, y - 95); ctx.lineTo(x - 60, y - 68); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#79513c";
      ctx.beginPath(); ctx.moveTo(x - 60, y - 75); ctx.lineTo(x - 36, y - 99); ctx.lineTo(x + 36, y - 99); ctx.lineTo(x + 60, y - 75); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#77664a"; ctx.fillRect(x + 39, y - 102, 15, 26);
      ctx.fillStyle = "#433a30"; ctx.fillRect(x + 36, y - 105, 21, 4);
      ctx.strokeStyle = "rgba(218,192,139,.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 53, y - 66); ctx.lineTo(x - 53, y - 20); ctx.moveTo(x + 53, y - 66); ctx.lineTo(x + 53, y - 20); ctx.stroke();
    } else if (structure.type === "stoneHouse" || structure.type === "chapel") {
      const chapel = structure.type === "chapel";
      const width = chapel ? 54 : 64;
      const wallTop = chapel ? y - 83 : y - 68;
      ctx.fillStyle = "rgba(24,26,23,.3)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, width + 17, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#777360"; ctx.fillRect(x - width, y - 8, width * 2, 8);
      const stone = ctx.createLinearGradient(x - width, wallTop, x + width, y);
      stone.addColorStop(0, "#aaa28a"); stone.addColorStop(.46, "#817b69"); stone.addColorStop(1, "#59594f");
      ctx.fillStyle = stone; ctx.fillRect(x - width, wallTop, width * 2, y - wallTop - 8);
      ctx.fillStyle = "rgba(43,45,39,.42)";
      for (let row = 0; row < 4; row++) {
        const courseY = wallTop + 13 + row * 14;
        ctx.fillRect(x - width + 3, courseY, width * 2 - 6, 1.5);
        for (let stoneX = x - width + 12 + (row % 2) * 11; stoneX < x + width - 7; stoneX += 24) {
          ctx.fillRect(stoneX, courseY - 9, 1.5, 9);
        }
      }
      ctx.fillStyle = "#34362f";
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x - 16, y - 31);
      ctx.quadraticCurveTo(x - 16, y - 51, x, y - 51);
      ctx.quadraticCurveTo(x + 16, y - 51, x + 16, y - 31);
      ctx.lineTo(x + 16, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#c0b18b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 18, y - 31);
      ctx.quadraticCurveTo(x - 18, y - 53, x, y - 53);
      ctx.quadraticCurveTo(x + 18, y - 53, x + 18, y - 31);
      ctx.lineTo(x + 18, y); ctx.stroke();
      for (const windowX of [x - width + 13, x + width - 25]) {
        ctx.fillStyle = "#30352f"; ctx.fillRect(windowX, y - 52, 13, 20);
        ctx.fillStyle = "rgba(221,193,126,.54)"; ctx.fillRect(windowX + 3, y - 48, 7, 12);
        ctx.strokeStyle = "#c4b58d"; ctx.lineWidth = 2; ctx.strokeRect(windowX, y - 52, 13, 20);
      }
      ctx.fillStyle = chapel ? "#554b3e" : "#494339";
      ctx.beginPath();
      if (chapel) {
        ctx.moveTo(x - width - 10, wallTop + 2); ctx.lineTo(x, y - 126);
        ctx.lineTo(x + width + 10, wallTop + 2); ctx.lineTo(x + width, wallTop + 7);
        ctx.lineTo(x, y - 113); ctx.lineTo(x - width, wallTop + 7);
      } else {
        ctx.moveTo(x - width - 9, wallTop + 4); ctx.lineTo(x, y - 111);
        ctx.lineTo(x + width + 9, wallTop + 4); ctx.lineTo(x + width - 5, wallTop + 10);
        ctx.lineTo(x, y - 101); ctx.lineTo(x - width + 5, wallTop + 10);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b9a779";
      ctx.beginPath(); ctx.moveTo(x, chapel ? y - 126 : y - 111);
      ctx.lineTo(x + 4, chapel ? y - 138 : y - 122); ctx.lineTo(x + 8, chapel ? y - 126 : y - 111); ctx.closePath(); ctx.fill();
      if (chapel) {
        ctx.strokeStyle = "#b9aa82"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 4, y - 135); ctx.lineTo(x + 4, y - 119);
        ctx.moveTo(x - 2, y - 130); ctx.lineTo(x + 10, y - 130); ctx.stroke();
      }
    } else if (structure.type === "windmill") {
      ctx.fillStyle = "rgba(24,26,23,.3)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 59, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#65583f";
      ctx.beginPath(); ctx.moveTo(x - 43, y); ctx.lineTo(x - 29, y - 101); ctx.lineTo(x + 29, y - 101);
      ctx.lineTo(x + 43, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8c7753";
      ctx.beginPath(); ctx.moveTo(x - 34, y - 8); ctx.lineTo(x - 23, y - 95); ctx.lineTo(x + 23, y - 95);
      ctx.lineTo(x + 34, y - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#333630"; ctx.fillRect(x - 12, y - 47, 24, 39);
      ctx.fillStyle = "#b69b68"; ctx.fillRect(x - 15, y - 48, 30, 4);
      ctx.fillStyle = "#9cad91"; ctx.fillRect(x - 18, y - 78, 13, 17);
      ctx.fillStyle = "#303731"; ctx.fillRect(x - 15, y - 75, 7, 11);
      ctx.fillStyle = "#55442f";
      ctx.beginPath(); ctx.moveTo(x - 39, y - 99); ctx.lineTo(x, y - 133); ctx.lineTo(x + 39, y - 99); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#9c865d";
      ctx.beginPath(); ctx.arc(x, y - 116, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#594833"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x, y - 116); ctx.lineTo(x - 56, y - 150);
      ctx.moveTo(x, y - 116); ctx.lineTo(x + 54, y - 154);
      ctx.moveTo(x, y - 116); ctx.lineTo(x + 58, y - 80);
      ctx.moveTo(x, y - 116); ctx.lineTo(x - 48, y - 79); ctx.stroke();
      ctx.fillStyle = "#b29462";
      for (const [bladeX, bladeY, angle] of [[-28, -133, -.54], [27, -135, .58], [38, -98, 1.35], [-24, -98, 2.48]]) {
        ctx.save(); ctx.translate(x + bladeX, y + bladeY); ctx.rotate(angle);
        ctx.fillRect(-3, -19, 6, 28); ctx.fillRect(-9, -17, 18, 5); ctx.restore();
      }
    } else if (structure.type === "bunker") {
      ctx.fillStyle = "rgba(24,26,23,.3)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 76, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#69695e";
      ctx.beginPath(); ctx.moveTo(x - 70, y); ctx.lineTo(x - 61, y - 42);
      ctx.lineTo(x - 42, y - 61); ctx.lineTo(x + 43, y - 61);
      ctx.lineTo(x + 63, y - 43); ctx.lineTo(x + 70, y); ctx.closePath(); ctx.fill();
      const concrete = ctx.createLinearGradient(x - 62, y - 55, x + 62, y);
      concrete.addColorStop(0, "#a49f87"); concrete.addColorStop(.5, "#77776b"); concrete.addColorStop(1, "#515850");
      ctx.fillStyle = concrete;
      ctx.beginPath(); ctx.moveTo(x - 62, y - 3); ctx.lineTo(x - 54, y - 39);
      ctx.lineTo(x - 38, y - 53); ctx.lineTo(x + 38, y - 53);
      ctx.lineTo(x + 54, y - 39); ctx.lineTo(x + 62, y - 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#343a36"; ctx.fillRect(x - 31, y - 39, 62, 19);
      ctx.strokeStyle = "#b5aa87"; ctx.lineWidth = 3; ctx.strokeRect(x - 34, y - 42, 68, 25);
      ctx.fillStyle = "#222c2b"; ctx.fillRect(x - 9, y - 17, 18, 17);
      ctx.fillStyle = "#c0a66d"; ctx.fillRect(x - 25, y - 49, 12, 4); ctx.fillRect(x + 13, y - 49, 12, 4);
      ctx.strokeStyle = "rgba(46,53,48,.6)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 49, y - 25); ctx.lineTo(x - 39, y - 19);
      ctx.moveTo(x + 45, y - 35); ctx.lineTo(x + 51, y - 25); ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(24,26,23,.28)";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 66, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4c4d40";
      ctx.beginPath();
      ctx.moveTo(x - 57, y); ctx.lineTo(x - 57, y - 51); ctx.lineTo(x - 46, y - 51);
      ctx.lineTo(x - 46, y - 69); ctx.lineTo(x - 28, y - 69); ctx.lineTo(x - 28, y - 57);
      ctx.lineTo(x - 15, y - 57); ctx.lineTo(x - 15, y - 45); ctx.lineTo(x + 14, y - 45);
      ctx.lineTo(x + 14, y - 61); ctx.lineTo(x + 27, y - 61); ctx.lineTo(x + 27, y - 78);
      ctx.lineTo(x + 45, y - 78); ctx.lineTo(x + 45, y - 60); ctx.lineTo(x + 56, y - 60);
      ctx.lineTo(x + 56, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#77745e";
      for (const [stoneX, stoneY, width] of [
        [-57, -51, 11], [-46, -69, 18], [-28, -57, 13], [-15, -45, 29],
        [14, -61, 13], [27, -78, 18], [45, -60, 11],
      ]) ctx.fillRect(x + stoneX, y + stoneY, width, 6);

      ctx.fillStyle = "#292f2b";
      ctx.beginPath();
      ctx.moveTo(x - 15, y); ctx.lineTo(x - 15, y - 27);
      ctx.quadraticCurveTo(x - 15, y - 46, x, y - 47);
      ctx.quadraticCurveTo(x + 15, y - 46, x + 15, y - 27);
      ctx.lineTo(x + 15, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#918b70"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 15, y); ctx.lineTo(x - 15, y - 27);
      ctx.quadraticCurveTo(x - 15, y - 46, x, y - 47);
      ctx.quadraticCurveTo(x + 15, y - 46, x + 15, y - 27);
      ctx.lineTo(x + 15, y); ctx.stroke();

      ctx.strokeStyle = "rgba(39,40,34,.65)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 55, y - 34); ctx.lineTo(x - 47, y - 34); ctx.moveTo(x - 46, y - 19); ctx.lineTo(x - 30, y - 19);
      ctx.moveTo(x + 29, y - 44); ctx.lineTo(x + 42, y - 44); ctx.moveTo(x + 36, y - 25); ctx.lineTo(x + 54, y - 25);
      ctx.stroke();
      ctx.fillStyle = "#80785d"; ctx.fillRect(x - 62, y - 5, 124, 5);
    }
  }

  draw(ctx, cameraX, time) {
    this.ensureArea(cameraX - 100, cameraX + VIEW_WIDTH + 100);
    this.drawBackground(ctx, cameraX, time);
    this.drawTerrain(ctx, cameraX);
    const left = cameraX - 50, right = cameraX + VIEW_WIDTH + 50;
    for (const tree of this.trees) {
      if (tree.x < left || tree.x > right) continue;
      this.drawTree(ctx, tree, tree.x - cameraX, tree.y - tree.height);
    }
    const first = Math.floor(cameraX / CHUNK);
    const last = Math.floor((cameraX + VIEW_WIDTH) / CHUNK);
    for (let index = first; index <= last; index++) this.drawChunkDetails(ctx, index, cameraX);
  }
}
