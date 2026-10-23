// ============================================================================
// Due by Dusk · v0.6.00 — BootScene (`src/scenes/BootScene.ts`)
// Initializes the versioned SaveSystem (`due-by-dusk-v2` with automatic backup
// and idempotent migration from `due-by-dusk-v1`) and launches PreloadScene.
// ============================================================================

import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    const payload = SaveSystem.loadOrMigrate();
    (window as any).__DBD_INITIAL_SAVE = payload;
    this.scene.start('PreloadScene');
  }
}
