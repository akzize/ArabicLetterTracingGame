export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // load letters
        // this.load.image('alif', 'assets/letters/alif.png');
        this.load.image('baa', 'assets/letters/1.png');
    }

    create() {
        this.scene.start('MainScene');
    }
}
