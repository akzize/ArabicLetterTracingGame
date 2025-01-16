import Phaser from 'phaser';

export const TeachingLetterData = [
  {
    name: 'ب', // Arabic letter name
    image: 'baa', // Letter image key
    lines: [
      {
        points: [
          { x: 100, y: 100 },
          { x: 100, y: 200 }, // First vertical line
        ],
        arrowDirection: 'down',
      },
      {
        points: [
          { x: 100, y: 200 },
          { x: 200, y: 200 }, // Horizontal line
        ],
        arrowDirection: 'right',
      },
      {
        points: [
          { x: 200, y: 100 },
          { x: 200, y: 200 }, // Second vertical line
        ],
        arrowDirection: 'down',
      },
    ],
  },
  // Add other letters...
];

export class MainScene extends Phaser.Scene {
  private currentLineIndex: number = 0; // Tracks the current line
  private currentPoints: { x: number; y: number }[] = [];
  private tracedPoints: { x: number; y: number }[] = [];
  private dashes: Phaser.GameObjects.Text[] = [];
  private letterData: any;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    this.load.image('arrow_down', 'assets/arrows/down-arrow.png');
    this.load.image('arrow_right', 'assets/arrows/up-arrow.png');
  }

  create() {
    // Load letter data
    this.letterData = TeachingLetterData[0];

    // rescale the arrows

    // Display placeholder image for ب
    this.add.image(400, 300, this.letterData.image).setAlpha(0.3); // Semi-transparent

    // Display score
    this.scoreText = this.add.text(20, 20, '● ● ● ●', {
      fontSize: '32px',
      color: '#000',
    });

    // Start with the first line
    this.startLine(this.letterData.lines[this.currentLineIndex]);

    // Enable tracing
    this.input.on('pointerdown', this.startTracing, this);
    this.input.on('pointermove', this.tracePath, this);
    this.input.on('pointerup', this.checkLineCompletion, this);
  }

  startLine(line: any) {
    // Clear previous dashes
    this.dashes.forEach(dash => dash.destroy());
    this.dashes = [];

    // Get the current line's points
    this.currentPoints = line.points;

    // Display dashes between points
    const [start, end] = line.points;
    const dashCount = 5;
    for (let i = 1; i < dashCount; i++) {
      const dashX = Phaser.Math.Interpolation.Linear([start.x, end.x], i / dashCount);
      const dashY = Phaser.Math.Interpolation.Linear([start.y, end.y], i / dashCount);
      const dash = this.add.text(dashX, dashY, '.', {
        fontSize: '40px',
        color: '#000',
      }).setOrigin(0.5);
      this.dashes.push(dash);
    }

    // Display arrow
    this.add
      .image(end.x, end.y, `arrow_${line.arrowDirection}`)
      .setOrigin(0.5)
      .setScale(0.07999999999999999, 0.059999999999999984);
  }

  startTracing(pointer: Phaser.Input.Pointer) {
    this.tracedPoints = [{ x: pointer.x, y: pointer.y }];
  }

  tracePath(pointer: Phaser.Input.Pointer) {
    // Track tracing points
    this.tracedPoints.push({ x: pointer.x, y: pointer.y });

    // Visual feedback for tracing
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x00ff00, 1); // Green line for correct tracing
    graphics.beginPath();
    graphics.moveTo(this.tracedPoints[0].x, this.tracedPoints[0].y);
    this.tracedPoints.forEach(point => graphics.lineTo(point.x, point.y));
    graphics.strokePath();
  }

  checkLineCompletion() {
    const accuracy = this.calculateAccuracy(this.currentPoints);

    if (accuracy > 80) {
      // Move to the next line
      this.currentLineIndex++;
      this.updateScore();

      if (this.currentLineIndex < this.letterData.lines.length) {
        this.startLine(this.letterData.lines[this.currentLineIndex]);
      } else {
        // Letter completed
        this.scene.restart(); // Restart the scene for now
      }
    } else {
      // Reset the current line
      this.startLine(this.letterData.lines[this.currentLineIndex]);
    }
  }

  calculateAccuracy(points: { x: number; y: number }[]) {
    const [start, end] = points;
    let correctPoints = 0;

    this.tracedPoints.forEach(point => {
      const withinSegment =
        point.x >= Math.min(start.x, end.x) &&
        point.x <= Math.max(start.x, end.x) &&
        point.y >= Math.min(start.y, end.y) &&
        point.y <= Math.max(start.y, end.y);

      if (withinSegment) correctPoints++;
    });

    return (correctPoints / this.tracedPoints.length) * 100;
  }

  updateScore() {
    const score = '● '.repeat(this.currentLineIndex) + '○ '.repeat(4 - this.currentLineIndex);
    this.scoreText.setText(score.trim());
  }
}
