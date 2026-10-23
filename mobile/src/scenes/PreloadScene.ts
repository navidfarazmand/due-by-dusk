import Phaser from 'phaser';
// All game art is local procedural vector drawing; no bitmap loading is needed.
export class PreloadScene extends Phaser.Scene {
 constructor(){super({key:'PreloadScene'});}
 create(){this.scene.start('FarmScene');}
}
