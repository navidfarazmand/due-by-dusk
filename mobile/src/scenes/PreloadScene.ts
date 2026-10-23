// ============================================================================
// Due by Dusk · v0.6.00 — PreloadScene (`src/scenes/PreloadScene.ts`)
// Loads the authored Arthur Grumble 30-frame Phaser Texture Atlas
// (`assets/atlases/arthur_atlas.png` + `arthur_atlas.json`) and the 4
// illustrated regional farm panoramas (`CA`, `BR`, `FR`, `JP`), registers all
// 5 Phaser animations (`arthur_idle`, `arthur_smug`, `arthur_demand`,
// `arthur_anger`, `arthur_shock`), and launches `FarmScene`.
// ============================================================================

import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public preload(): void {
    // 1. Load Arthur Grumble 30-frame Texture Atlas (PNG + Phaser JSON Hash)
    this.load.atlas(
      'arthur',
      'assets/atlases/arthur_atlas.png',
      'assets/atlases/arthur_atlas.json'
    );

    // 2. Load the 4 Illustrated Regional Farm Scenery Panoramas (full & sky-keyed midground)
    for (const code of ['CA', 'BR', 'FR', 'JP']) {
      this.load.image(`env_${code}`, `assets/environments/env_${code}.png`);
      this.load.image(`env_${code}_fg`, `assets/environments/env_${code}_fg.png`);
    }
  }

  public create(): void {
    // Register Arthur Grumble's 5 multi-frame Phaser animations
    const animConfigs: Array<{ key: string; prefix: string; fps: number }> = [
      { key: 'arthur_idle',   prefix: 'idle_',   fps: 8 },
      { key: 'arthur_smug',   prefix: 'smug_',   fps: 10 },
      { key: 'arthur_demand', prefix: 'demand_', fps: 12 },
      { key: 'arthur_anger',  prefix: 'anger_',  fps: 14 },
      { key: 'arthur_shock',  prefix: 'shock_',  fps: 12 },
    ];

    for (const cfg of animConfigs) {
      if (!this.anims.exists(cfg.key)) {
        this.anims.create({
          key: cfg.key,
          frames: this.anims.generateFrameNames('arthur', {
            prefix: cfg.prefix,
            start: 0,
            end: 5,
          }),
          frameRate: cfg.fps,
          repeat: -1,
        });
      }
    }

    this.scene.start('FarmScene');
  }
}
