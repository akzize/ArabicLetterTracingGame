import Phaser from "phaser";
export class MainScene extends Phaser.Scene {
  private letterImage!: Phaser.GameObjects.Image;
  private letterPath!: Phaser.Curves.Path;
  private dot!: Phaser.GameObjects.Image;
  private tracePath!: Phaser.GameObjects.Graphics;
  private pointerDown: boolean = false;
  private tracedPoints: { x: number; y: number }[] = [];
  private totalPathPoints: number = 0;
  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    // Background
    // this.add.rectangle(400, 300, 800, 600, 0xffffff); // White background

    // background
    const letterImage = this.add.image(400, 300, 'baa').setAlpha(0.5);

    // Tracing path (for visual guidance)
    this.tracePath = this.add.graphics();
    this.tracePath.lineStyle(5, 0xff0000, 1); // Red guide path
    this.tracePath.strokeCircle(400, 300, 100); // Example circle path

    // Define a curved path for tracing (the semi-circle of ب)
    this.letterPath = new Phaser.Curves.Path(300, 300);
    this.letterPath.splineTo([
      new Phaser.Math.Vector2(350,250),
      new Phaser.Math.Vector2(400,300),
      new Phaser.Math.Vector2(450,350),
    ]);
    this.totalPathPoints = 100; // Adjust for difficulty

    // Visualize the path
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xff0000, 0.5); // Red dotted path
    this.letterPath.draw(graphics);

    // Add the dot (نقطة)
    this.dot = this.add.image(400, 400, 'dot').setInteractive();
    this.dot.setAlpha(0.8); // Semi-transparent until activated

    // Enable pointer tracing
    this.input.on('pointerdown', () => {
      this.pointerDown = true;
      this.tracedPoints = [];
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pointerDown) {
        const { x, y } = pointer;
        this.tracedPoints.push({ x, y });

        // Draw the traced path
        graphics.fillStyle(0x00ff00, 1); // Green for correct trace
        graphics.fillCircle(x, y, 5); // Draw a point at the pointer
      }
    });

    this.input.on('pointerup', () => {
      this.pointerDown = false;
      this.checkTracingAccuracy();
    });

    // Handle dot interaction
    this.dot.on('pointerdown', () => {
      this.sound.play('correct'); // Play sound on correct dot placement
      this.dot.setAlpha(1); // Highlight the dot
    });
  }

  checkTracingAccuracy() {
    const accuracy = (this.tracedPoints.length / this.totalPathPoints) * 100;
    if (accuracy > 80) {
      console.log('correct');
      this.scene.restart(); // Move to the next letter
    } else {
      console.log('wrong');
      this.scene.restart(); // Retry tracing
    }
  }
}
