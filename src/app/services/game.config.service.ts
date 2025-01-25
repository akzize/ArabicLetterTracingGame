import { PreloadScene } from './../game/scenes/preload.scene';
import { Injectable } from '@angular/core';
import { MainScene } from '../game/scenes/main.scene';
import { TracingGameScene } from '../game/scenes/tracing-game.scene';
// import { TracingGameScene } from '../game/scenes/tracing-game.scene11';

@Injectable({
  providedIn: 'root',
})
export class GameConfigService {
  constructor() {}

  getConfig(container: HTMLElement): Phaser.Types.Core.GameConfig {
    return {
      type: Phaser.CANVAS,
      width: 1000,
      height: 600,
      scene: [PreloadScene, TracingGameScene, MainScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      backgroundColor: '#fff2f2',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 200 },
        },
      },
      parent: container,
      antialias: false,
    };
  }
}
