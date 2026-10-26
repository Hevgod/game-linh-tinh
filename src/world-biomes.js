const BIOME_LENGTH_METERS = 1450;
const TRANSITION_METERS = 110;
const START_X = 140;

export const BIOMES = [
  {
    id: "pineRidge",
    en: "PINE RIDGE",
    vi: "ĐỒI THÔNG",
    surfaceOffset: 0,
    treeDensity: 1,
    pineWeight: 0.72,
    archerChance: 0.3,
    sky: ["#728c9a", "#a8b7ad", "#d4c7a8", "#d7b992"],
    ridges: [["#899a98", "#788d8a"], ["#72847d", "#64776d"], ["#62765f", "#4d634f"]],
    soil: ["#80674f", "#665440", "#353b38"],
    grass: ["#66764f", "#a0a26c"],
    detailWeights: { bush: 0.37, rock: 0.29, flowers: 0.25, log: 0.09 },
    structureWeights: { cabin: 0.2, barn: 0.2, stoneHouse: 0.13, chapel: 0.11, windmill: 0.08, bunker: 0.08, watchtower: 0.12, ruins: 0.08 },
  },
  {
    id: "sunscarredReach",
    en: "SUNSCARRED REACH",
    vi: "MIỀN ĐẤT NẮNG",
    surfaceOffset: -8,
    treeDensity: 0.52,
    pineWeight: 0.16,
    archerChance: 0.42,
    sky: ["#708994", "#b0a895", "#e2c79b", "#d9ad77"],
    ridges: [["#96988d", "#878879"], ["#8f8068", "#76664f"], ["#97734c", "#70583e"]],
    soil: ["#a9855d", "#866849", "#51483c"],
    grass: ["#948354", "#c5a56a"],
    detailWeights: { bush: 0.12, rock: 0.48, flowers: 0.08, log: 0.12, scrub: 0.2 },
    structureWeights: { cabin: 0.08, barn: 0.1, stoneHouse: 0.2, chapel: 0.1, windmill: 0.13, bunker: 0.2, watchtower: 0.12, ruins: 0.17 },
  },
  {
    id: "mistfen",
    en: "MISTFEN",
    vi: "ĐẦM SƯƠNG",
    surfaceOffset: 9,
    treeDensity: 0.78,
    pineWeight: 0.32,
    archerChance: 0.34,
    sky: ["#697f85", "#8fa19a", "#b4b49e", "#a99f82"],
    ridges: [["#84918c", "#73837a"], ["#687d70", "#536a5f"], ["#536d60", "#43584f"]],
    soil: ["#776951", "#5e5948", "#343b36"],
    grass: ["#586b4d", "#82906a"],
    detailWeights: { bush: 0.31, rock: 0.15, flowers: 0.12, log: 0.26, reed: 0.16 },
    structureWeights: { cabin: 0.12, barn: 0.08, stoneHouse: 0.12, chapel: 0.09, windmill: 0.06, bunker: 0.12, watchtower: 0.13, ruins: 0.31 },
  },
  {
    id: "frostline",
    en: "FROSTLINE",
    vi: "RÌA BĂNG GIÁ",
    surfaceOffset: 3,
    treeDensity: 0.82,
    pineWeight: 0.9,
    archerChance: 0.48,
    sky: ["#71899b", "#a9bcc4", "#d6d6c9", "#c7d2d0"],
    ridges: [["#9aaab0", "#81949a"], ["#7b9095", "#637a80"], ["#657a7d", "#526467"]],
    soil: ["#888b82", "#6e7774", "#42494a"],
    grass: ["#73877c", "#b2b9a7"],
    detailWeights: { bush: 0.18, rock: 0.32, flowers: 0.12, log: 0.23, frost: 0.15 },
    structureWeights: { cabin: 0.18, barn: 0.08, stoneHouse: 0.18, chapel: 0.12, windmill: 0.06, bunker: 0.12, watchtower: 0.16, ruins: 0.12 },
  },
];

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function biomePositionAt(worldX) {
  const distance = Math.max(0, (worldX - START_X) / 4);
  const segment = Math.floor(distance / BIOME_LENGTH_METERS);
  const localDistance = distance - segment * BIOME_LENGTH_METERS;
  const current = BIOMES[segment % BIOMES.length];
  const previous = BIOMES[(segment - 1 + BIOMES.length) % BIOMES.length];
  const next = BIOMES[(segment + 1) % BIOMES.length];
  const transitionWidth = TRANSITION_METERS * 2;

  if (segment > 0 && localDistance < TRANSITION_METERS) {
    return {
      current,
      blendFrom: previous,
      blendTo: current,
      blend: smoothstep((localDistance + TRANSITION_METERS) / transitionWidth),
      distance,
    };
  }
  if (localDistance > BIOME_LENGTH_METERS - TRANSITION_METERS) {
    return {
      current,
      blendFrom: current,
      blendTo: next,
      blend: smoothstep((localDistance - BIOME_LENGTH_METERS + TRANSITION_METERS) / transitionWidth),
      distance,
    };
  }
  return { current, blendFrom: current, blendTo: current, blend: 0, distance };
}

export function biomeAtWorldX(worldX) {
  const position = biomePositionAt(worldX);
  return position.blend < 0.5 ? position.blendFrom : position.blendTo;
}

export function weightedValue(position, property) {
  const from = position.blendFrom[property];
  const to = position.blendTo[property];
  return from + (to - from) * position.blend;
}

export function weightedChoice(weights, rand) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}
