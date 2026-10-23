import { SkillNodeData } from '../types/game';
// ============================================================================
// Due by Dusk · v0.5.01 — Spatial Branching Skill Tree (DAG)
// Every node costs 1 💎 Diamond (separate from Grit).
// Features true forks, cross-links, and multi-path capstones on a 1000x580 canvas.
// ============================================================================

export const SKILL_TREE_NODES: SkillNodeData[] = [
    // CENTRAL CORE ROOT (Unlocked by default or first 1-Diamond choice)
    {
      id: 'core_awakening',
      branch: 'core',
      name: "Harvester's Awakening",
      x: 500, y: 290,
      cost: 1,
      reqs: [],
      icon: '⚔️',
      summary: '+10% Scythe Damage & +1.0s Daylight',
      desc: 'Awakens the ancient Harvester Codex. Grants +10% base scythe damage and +1.0 second of daylight on every farm, and opens the three great branching wings: Reap, Soil, and Fortune.'
    },

    // ========================================================================
    // WING I: WAY OF THE REAP (West / Northwest — Forks into Speed vs. Cleave)
    // ========================================================================
    {
      id: 'reap_root',
      branch: 'reap',
      name: 'Honed Temper',
      x: 350, y: 245,
      cost: 1,
      reqs: ['core_awakening'],
      icon: '🗡️',
      summary: '+2 Base Scythe Damage',
      desc: 'Cold-forged high-carbon steel adds +2 flat base damage to every swing on all farms.'
    },
    // Fork A (Upper West): Speed & Dash-Slash Path
    {
      id: 'reap_swift',
      branch: 'reap',
      name: 'Mercurial Wrist',
      x: 215, y: 155,
      cost: 1,
      reqs: ['reap_root'],
      icon: '⚡',
      summary: '+18% Faster Swing Rate',
      desc: 'Counter-weighted ash handle increases your automatic swing rate by +18% across every farm.'
    },
    {
      id: 'reap_dash',
      branch: 'reap',
      name: 'Gale Dash-Slash',
      x: 95, y: 120,
      cost: 1,
      reqs: ['reap_swift'],
      icon: '🌪️',
      summary: 'Fast Swipes Emit Wind Waves',
      desc: 'Sweeping the sickle rapidly across the field emits a crescent wind wave that slices nearby crops for +50% bonus reach.'
    },
    // Fork B (Lower West): Heavy Charge Cleave Path
    {
      id: 'reap_cleave',
      branch: 'reap',
      name: 'Sundering Cleave',
      x: 215, y: 335,
      cost: 1,
      reqs: ['reap_root'],
      icon: '💥',
      summary: 'Charge Cleave +45% Faster & +25% Wider',
      desc: 'Holding click/touch or Spacebar charges your Cleave 45% faster and expands its shockwave radius by +25%.'
    },
    {
      id: 'reap_vortex',
      branch: 'reap',
      name: 'Whirlwind Echo',
      x: 95, y: 375,
      cost: 1,
      reqs: ['reap_cleave'],
      icon: '🌀',
      summary: 'Cleave Spawns a 1.8s Spinning Vortex',
      desc: 'Unleashing a Charge Cleave leaves behind a spinning golden blade vortex for 1.8 seconds that continuously chops crops.'
    },
    // Reap Capstone (Converges from either Dash-Slash OR Whirlwind Echo)
    {
      id: 'reap_exec',
      branch: 'reap',
      name: "Reaper's Verdict",
      x: 55, y: 248,
      cost: 1,
      reqs: ['reap_dash', 'reap_vortex'],
      reqMode: 'any', // Unlockable via EITHER upper or lower Reap sub-branch!
      icon: '👑',
      summary: 'Execute <25% HP Crops & Crit Chain Lightning',
      desc: 'Capstone: Any crop dropped below 25% HP is instantly executed, and critical hits arc golden lightning to 2 nearby crops.'
    },

    // ========================================================================
    // WING II: WAY OF THE SOIL (North / Northeast — Forks into Abundance vs. Seasons)
    // ========================================================================
    {
      id: 'soil_root',
      branch: 'soil',
      name: 'Living Humus',
      x: 545, y: 165,
      cost: 1,
      reqs: ['core_awakening'],
      icon: '🌱',
      summary: '+2 Max Field Crops & +12% Sprout Speed',
      desc: 'Mycorrhizal soil enrichment allows +2 additional crops on the field at once and speeds up sprouting by 12%.'
    },
    // Fork A (Upper North): Germination & Twin Crops Path
    {
      id: 'soil_twin',
      branch: 'soil',
      name: 'Twin Germination',
      x: 475, y: 72,
      cost: 1,
      reqs: ['soil_root'],
      icon: '🌿',
      summary: '22% Chance Crops Spawn in Pairs',
      desc: 'Whenever a new crop sprouts, there is a 22% chance a second bonus crop sprouts simultaneously beside it.'
    },
    {
      id: 'soil_dew',
      branch: 'soil',
      name: 'Dawn Abundance',
      x: 615, y: 48,
      cost: 1,
      reqs: ['soil_twin'],
      icon: '💧',
      summary: 'Start Every Day with +3 Ripe Crops',
      desc: 'Morning dew nourishes the field overnight so every day starts with +3 extra Stage-3 ripe crops ready to cut.'
    },
    // Fork B (East-Northeast): Daylight & Field Props Path
    {
      id: 'soil_sun',
      branch: 'soil',
      name: 'Longer Solstice',
      x: 695, y: 152,
      cost: 1,
      reqs: ['soil_root'],
      icon: '☀️',
      summary: '+2.0 Seconds of Daylight Every Day',
      desc: 'Extends the golden hour across every region, granting +2.0 seconds of extra harvesting time each day.'
    },
    {
      id: 'soil_bounty',
      branch: 'soil',
      name: 'Artisan Compost',
      x: 825, y: 120,
      cost: 1,
      reqs: ['soil_sun'],
      icon: '🧺',
      summary: 'Fertilizer Bags & Treats Spawn 2× Faster',
      desc: 'Sliceable Fertilizer Bags (+4 instant crops) and Clover Treats appear twice as often during the day.'
    },
    // Soil Capstone (Converges from Dawn Abundance OR Artisan Compost)
    {
      id: 'soil_eden',
      branch: 'soil',
      name: 'Perennial Bloom',
      x: 765, y: 45,
      cost: 1,
      reqs: ['soil_dew', 'soil_bounty'],
      reqMode: 'any',
      icon: '🌺',
      summary: '25% Chance Harvested Crops Instantly Regrow',
      desc: 'Capstone: Harvesting any Stage-3 crop has a 25% chance to immediately pop a fresh Stage-2 bud in its place.'
    },

    // ========================================================================
    // WING III: WAY OF FORTUNE (South / Southeast — Forks into Banking vs. Beasts)
    // ========================================================================
    {
      id: 'gold_root',
      branch: 'gold',
      name: "Merchant's Scale",
      x: 615, y: 385,
      cost: 1,
      reqs: ['core_awakening'],
      icon: '⚖️',
      summary: '+15% Crop Sell Value on All Farms',
      desc: 'Direct export contracts with regional markets increase the sell price of all harvested crops by +15%.'
    },
    // Fork A (South): Banking & Legal Defense against Arthur Grumble
    {
      id: 'gold_lawyer',
      branch: 'gold',
      name: 'Retained Counsel',
      x: 525, y: 492,
      cost: 1,
      reqs: ['gold_root'],
      icon: '📜',
      summary: 'All Bank Bills Cost 12% Less',
      desc: 'Your county lawyer audits Grumble & Sons, permanently reducing the amount required for every bank bill by 12%.'
    },
    {
      id: 'gold_interest',
      branch: 'gold',
      name: 'Compound Reserve',
      x: 685, y: 522,
      cost: 1,
      reqs: ['gold_lawyer'],
      icon: '🏦',
      summary: '+12% Overnight Interest on Saved Cash',
      desc: 'Earn +12% overnight interest (up to +$300/night) on unspent cash at the end of each day.'
    },
    // Fork B (Southeast): Pasture Beasts & Friendly Goat Herd
    {
      id: 'gold_treaty',
      branch: 'gold',
      name: 'Pasture Accord',
      x: 765, y: 365,
      cost: 1,
      reqs: ['gold_root'],
      icon: '🐐',
      summary: 'Goats Never Headbutt & Tip Cash Instead',
      desc: 'Permanently signs a peace treaty with the White Goat—it never steals daylight and tips you cash when touched.'
    },
    {
      id: 'gold_herd',
      branch: 'gold',
      name: 'Loyal Goat Herd',
      x: 895, y: 415,
      cost: 1,
      reqs: ['gold_treaty'],
      icon: '🔔',
      summary: 'Friendly Goats Harvest Crops FOR You',
      desc: 'The White Goat becomes your loyal farmhand, trotting through the field and headbutting crops to harvest them for you!'
    },
    // Fortune Capstone (Converges from Compound Reserve OR Loyal Goat Herd)
    {
      id: 'gold_midas',
      branch: 'gold',
      name: 'Sovereign Mint',
      x: 885, y: 518,
      cost: 1,
      reqs: ['gold_interest', 'gold_herd'],
      reqMode: 'any',
      icon: '💎',
      summary: 'Lucky & Regional Specialty Crops Pay +50%',
      desc: 'Capstone: Lucky crops, Golden Corn, and all regional specialty crops (Canola, Pineapple, Lavender, Daikon) pay +50% more.'
    }
  ]
