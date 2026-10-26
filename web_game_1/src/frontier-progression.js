const CONTRACTS = [
  { id: "range", kills: 4 },
  { id: "cadence", kills: 10 },
  { id: "stability", kills: 18 },
  { id: "survey", biomes: 3 },
];

export class FrontierProgression {
  constructor() {
    this.reset();
  }

  reset() {
    this.discoveredBiomes = new Set();
    this.completedContracts = new Set();
  }

  update(player, weapon, bots, biome, onEvent) {
    if (biome && !this.discoveredBiomes.has(biome.id)) {
      const firstDiscovery = this.discoveredBiomes.size > 0;
      this.discoveredBiomes.add(biome.id);
      if (firstDiscovery) onEvent("biome", biome.id);
    }

    for (const contract of CONTRACTS) {
      if (this.completedContracts.has(contract.id)) continue;
      const killGoalMet = contract.kills === undefined || bots.kills >= contract.kills;
      const biomeGoalMet = contract.biomes === undefined || this.discoveredBiomes.size >= contract.biomes;
      if (!killGoalMet || !biomeGoalMet) continue;

      this.completedContracts.add(contract.id);
      this.applyReward(contract.id, player, weapon);
      onEvent("contract", contract.id);
    }
  }

  applyReward(contractId, player, weapon) {
    if (contractId === "range") {
      weapon.range = Math.min(2100, weapon.range + 250);
    } else if (contractId === "cadence") {
      weapon.fireInterval = Math.max(.085, weapon.fireInterval - .02);
    } else if (contractId === "stability") {
      weapon.spread = Math.max(.008, weapon.spread * .68);
    } else if (contractId === "survey") {
      player.health = Math.min(player.maxHealth, player.health + 2);
      player.shield = Math.max(player.shield, 8);
    }
  }
}
