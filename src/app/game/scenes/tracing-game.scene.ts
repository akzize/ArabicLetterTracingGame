export class TracingGameScene extends Phaser.Scene {
  private letterData!: any; // Holds the loaded letter data
  private letterGraphics!: Phaser.GameObjects.Graphics;

  private childDrawingGraphics!: Phaser.GameObjects.Graphics; // Graphics for the child's drawing
  private isDrawing: boolean = false; // To track if the child is currently drawing
  private drawnPoints: { x: number; y: number }[] = []; // Store the points the child draws
  private targetPath: Phaser.Geom.Point[] = []; // The targetPath
  private outerPoints: Phaser.Geom.Point[] = []; // The targetPath
  override tweens: any;
  constructor() {
    super({ key: 'TracingGameScene' });
  }

  preload() {
    // Load the JSON file containing the letter paths
    this.load.json('letters', 'assets/letters.json');
    this.load.image('hand', 'assets/hands/hand.png'); // Replace with your hand image path
  }

  create() {
    this.letterData = this.cache.json.get('letters').baa;

    // Initialize graphics object for drawing
    this.letterGraphics = this.add.graphics();
    this.childDrawingGraphics = this.add.graphics();

    // Draw the letter path
    console.log(this.letterData.paths);

    // this.drawLetter(this.letterData.paths);

    // Draw the letter path with boundaries
    this.drawLetterWithBoundaries(this.letterData.paths);

    // Set up input for drawing
    this.input.on('pointerdown', this.startDrawing, this);
    this.input.on('pointermove', this.continueDrawing, this);
    this.input.on('pointerup', this.stopDrawing, this);
  }

  /**
   * Draws the specified letter paths on the scene using a blue line.
   * Each path is scaled up for visibility and rendered as a continuous line.
   *
   * @param paths - A two-dimensional array of points, where each inner array
   *                represents a path composed of points with x and y coordinates.
   */
  private drawLetter(paths: { x: number; y: number }[][]): void {
    this.letterGraphics.lineStyle(10, 0x0000ff, 1); // Blue line, 5px thick
    const scaleUp = 10;
    // Loop through each path in the paths array
    paths.forEach((path) => {
      this.letterGraphics.beginPath();
      path.forEach((point, index) => {
        if (index === 0) {
          // Move to the starting point
          this.letterGraphics.moveTo(point.x * scaleUp, point.y * scaleUp); // Scale up for visibility
        } else {
          // Draw a line to the next point
          this.letterGraphics.lineTo(point.x * scaleUp, point.y * scaleUp);
        }
      });
      this.letterGraphics.strokePath(); // Render the path
    });
  }

  // MARK: Draw letter with boundaries
  private drawLetterWithBoundaries(paths: { x: number; y: number }[][]): void {
    const offset = 1; // Offset distance for boundaries
    const scaleUp = 10;

    paths.forEach((path) => {
      // Calculate inner and outer paths
      const outerPath = this.calculateOffsetPath(path, offset);
      const innerPath = this.calculateOffsetPath(path, -offset);
      const outlineThickness = 3;

      // Draw the outer boundary
      this.letterGraphics.lineStyle(outlineThickness, 0xff0000, 1); // Red line, 3px thick
      this.letterGraphics.beginPath();
      outerPath.forEach((point, index) => {
        if (index === 0) {
          this.letterGraphics.moveTo(point.x * scaleUp, point.y * scaleUp); // Scale up for visibility
        } else {
          this.letterGraphics.lineTo(point.x * scaleUp, point.y * scaleUp);
        }

        this.outerPoints = outerPath.map(
          (point) => new Phaser.Geom.Point(point.x * scaleUp, point.y * scaleUp)
        );
      });
      this.letterGraphics.strokePath();

      // Draw the inner boundary
      this.letterGraphics.lineStyle(outlineThickness, 0x0000ff, 1); // Blue line, 3px thick
      this.letterGraphics.beginPath();
      innerPath.forEach((point, index) => {
        if (index === 0) {
          this.letterGraphics.moveTo(point.x * scaleUp, point.y * scaleUp); // Scale up for visibility
        } else {
          this.letterGraphics.lineTo(point.x * scaleUp, point.y * scaleUp);
        }
      });
      this.letterGraphics.strokePath();

      // Draw the actual letter path
      path.forEach((point, index) => {
        // this.drawDottedLineWithArrow(path, scaleUp);
        // this.drawDottedLineWithArrowAnimated(path, scaleUp, 2000);
        this.drawDottedLineWithHand(path, scaleUp, 2000);
        // push the point to the target path
        this.targetPath.push(
          new Phaser.Geom.Point(point.x * scaleUp, point.y * scaleUp)
        );

        // Show the hand animation after drawing the dotted line
        // this.showHandAnimation(path, scaleUp);
      });
      // this.letterGraphics.strokePath();

      // Draw the middle dashed line with an arrow
    });
  }

  private calculateOffsetPath(
    path: { x: number; y: number }[],
    offset: number
  ): { x: number; y: number }[] {
    const offsetPath: { x: number; y: number }[] = [];

    for (let i = 0; i < path.length; i++) {
      const current = path[i];
      const previous = path[i - 1] || path[i];
      const next = path[i + 1] || path[i];

      // Calculate direction vectors
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;

      // Normalize the vector
      const length = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / length; // Perpendicular vector x
      const ny = dx / length; // Perpendicular vector y

      // Offset the point
      offsetPath.push({
        x: current.x + nx * offset,
        y: current.y + ny * offset,
      });
    }

    return offsetPath;
  }

  /**
   * Draws a dashed line along the provided path with an arrowhead at the end.
   * The path is scaled up for visibility, and the line style is set to a dashed pattern.
   *
   * @param path - An array of points representing the path, each with x and y coordinates.
   * @param scaleUp - A scaling factor to increase the size of the drawn path for visibility.
   */
  private drawDashedLineWithArrow(
    path: { x: number; y: number }[],
    scaleUp: number
  ): void {
    const dashLength = 10; // Length of each dash
    const gapLength = 5; // Length of each gap between dashes
    const arrowSize = 15; // Size of the arrowhead

    // Draw dashed line
    this.letterGraphics.lineStyle(2, 0xff0000, 1); // Yellow dashed line
    this.letterGraphics.beginPath();

    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];

      const distance = Phaser.Math.Distance.Between(
        start.x,
        start.y,
        end.x,
        end.y
      );
      const direction = new Phaser.Math.Vector2(
        end.x - start.x,
        end.y - start.y
      ).normalize();

      let currentDistance = 0;

      while (currentDistance < distance) {
        const from = {
          x: start.x + direction.x * currentDistance,
          y: start.y + direction.y * currentDistance,
        };
        const to = {
          x:
            start.x +
            direction.x * Math.min(currentDistance + dashLength, distance),
          y:
            start.y +
            direction.y * Math.min(currentDistance + dashLength, distance),
        };

        this.letterGraphics.moveTo(from.x * scaleUp, from.y * scaleUp);
        this.letterGraphics.lineTo(to.x * scaleUp, to.y * scaleUp);
        currentDistance += dashLength + gapLength;
      }
    }

    this.letterGraphics.strokePath();

    // Add arrow at the end
    const lastPoint = path[path.length - 3];
    const arrowEnd = path[path.length - 2];

    const angle = Phaser.Math.Angle.BetweenPoints(lastPoint, arrowEnd);

    this.letterGraphics.fillStyle(0xff0000, 1); // Yellow arrow
    this.letterGraphics.beginPath();
    this.letterGraphics.moveTo(arrowEnd.x * scaleUp, arrowEnd.y * scaleUp);
    this.letterGraphics.lineTo(
      arrowEnd.x * scaleUp - Math.cos(angle - Math.PI / 6) * arrowSize,
      arrowEnd.y * scaleUp - Math.sin(angle - Math.PI / 6) * arrowSize
    );
    this.letterGraphics.lineTo(
      arrowEnd.x * scaleUp - Math.cos(angle + Math.PI / 6) * arrowSize,
      arrowEnd.y * scaleUp - Math.sin(angle + Math.PI / 6) * arrowSize
    );
    this.letterGraphics.closePath();
    this.letterGraphics.fillPath();
  }

  private drawDottedLineWithArrowAnimated(
    path: { x: number; y: number }[],
    scaleUp: number,
    duration: number
  ): void {
    const dotRadius = 3; // Radius of each dot
    const dotSpacing = 10; // Spacing between each dot
    const arrowSize = 15; // Size of the arrowhead
    const totalDots = Math.floor(duration / 50); // Adjust based on animation speed

    let dotIndex = 0; // Tracks how many dots have been drawn
    const dots: { x: number; y: number }[] = [];

    // Precompute all dot positions
    path.forEach((point, index) => {
      if (index < path.length - 1) {
        const start = path[index];
        const end = path[index + 1];

        const distance = Phaser.Math.Distance.Between(
          start.x,
          start.y,
          end.x,
          end.y
        );
        const direction = new Phaser.Math.Vector2(
          end.x - start.x,
          end.y - start.y
        ).normalize();

        let currentDistance = 0;
        while (currentDistance < distance) {
          dots.push({
            x: start.x + direction.x * currentDistance,
            y: start.y + direction.y * currentDistance,
          });
          currentDistance += dotSpacing;
        }
      }
    });

    // Animate dots
    const interval = setInterval(() => {
      if (dotIndex >= dots.length) {
        clearInterval(interval); // Stop animation when all dots are drawn

        // Add arrow at the end
        const lastPoint = path[path.length - 2];
        const arrowEnd = path[path.length - 1];

        const angle = Phaser.Math.Angle.BetweenPoints(lastPoint, arrowEnd);

        this.letterGraphics.fillStyle(0xff0000, 1); // Red arrow
        this.letterGraphics.beginPath();
        this.letterGraphics.moveTo(arrowEnd.x * scaleUp, arrowEnd.y * scaleUp);
        this.letterGraphics.lineTo(
          arrowEnd.x * scaleUp - Math.cos(angle - Math.PI / 6) * arrowSize,
          arrowEnd.y * scaleUp - Math.sin(angle - Math.PI / 6) * arrowSize
        );
        this.letterGraphics.lineTo(
          arrowEnd.x * scaleUp - Math.cos(angle + Math.PI / 6) * arrowSize,
          arrowEnd.y * scaleUp - Math.sin(angle + Math.PI / 6) * arrowSize
        );
        this.letterGraphics.closePath();
        this.letterGraphics.fillPath();

        return;
      }

      // Draw the current dot
      const dot = dots[dotIndex];
      this.letterGraphics.fillStyle(0xff0000, 1); // Red color for dots
      this.letterGraphics.fillCircle(
        dot.x * scaleUp,
        dot.y * scaleUp,
        dotRadius
      );

      dotIndex++;
    }, duration / totalDots);
  }

  private drawDottedLineWithHand(
    path: { x: number; y: number }[],
    scaleUp: number,
    duration: number
  ): void {
    const dotRadius = 3; // Radius of each dot
    const dotSpacing = 10; // Spacing between each dot
    const totalDots = Math.floor(duration / 50); // Adjust based on animation speed
    const hand = this.add
      .sprite(0, 0, 'hand')
      .setOrigin(0.3,0.2)
      .setScale(0.05) // Adjust as needed
      .setVisible(false)
      .setDepth(1); // Ensure it renders above other elements

    let dotIndex = 0; // Tracks how many dots have been drawn
    const dots: { x: number; y: number }[] = [];

    // Precompute all dot positions
    path.forEach((point, index) => {
      if (index < path.length - 1) {
        const start = path[index];
        const end = path[index + 1];

        const distance = Phaser.Math.Distance.Between(
          start.x,
          start.y,
          end.x,
          end.y
        );
        const direction = new Phaser.Math.Vector2(
          end.x - start.x,
          end.y - start.y
        ).normalize();

        let currentDistance = 0;
        while (currentDistance < distance) {
          dots.push({
            x: start.x + direction.x * currentDistance,
            y: start.y + direction.y * currentDistance,
          });
          currentDistance += dotSpacing;
        }
      }
    });

    // Animate dots and hand together
    const interval = setInterval(() => {
      if (dotIndex >= dots.length) {
        clearInterval(interval); // Stop animation when all dots are drawn

        // Add arrow at the end
        const lastPoint = path[path.length - 2];
        const arrowEnd = path[path.length - 1];
        const angle = Phaser.Math.Angle.BetweenPoints(lastPoint, arrowEnd);

        this.letterGraphics.fillStyle(0xff0000, 1); // Red arrow
        this.letterGraphics.beginPath();
        this.letterGraphics.moveTo(arrowEnd.x * scaleUp, arrowEnd.y * scaleUp);
        this.letterGraphics.lineTo(
          arrowEnd.x * scaleUp - Math.cos(angle - Math.PI / 6) * 15,
          arrowEnd.y * scaleUp - Math.sin(angle - Math.PI / 6) * 15
        );
        this.letterGraphics.lineTo(
          arrowEnd.x * scaleUp - Math.cos(angle + Math.PI / 6) * 15,
          arrowEnd.y * scaleUp - Math.sin(angle + Math.PI / 6) * 15
        );
        this.letterGraphics.closePath();
        this.letterGraphics.fillPath();

        hand.destroy(); // Remove the hand after completing the animation
        return;
      }

      // Draw the current dot
      const dot = dots[dotIndex];
      this.letterGraphics.fillStyle(0xff0000, 1); // Red color for dots
      this.letterGraphics.fillCircle(
        dot.x * scaleUp,
        dot.y * scaleUp,
        dotRadius
      );

      // Move the hand to the current dot position
      hand.setPosition(
        Math.round(dot.x * scaleUp),
        Math.round(dot.y * scaleUp)
      );
      hand.setVisible(true);

      console.log(`Hand Position: (${hand.x}, ${hand.y})`); // Debugging

      dotIndex++;
    }, duration / totalDots);
  }

  // MARK: - Drawing
  /* ------------------------------ drawind start ----------------------------- */
  private drawPath(path: { x: number; y: number }[], scaleUp: number): void {
    this.letterGraphics.beginPath();
    path.forEach((point, index) => {
      if (index === 0) {
        this.letterGraphics.moveTo(point.x * scaleUp, point.y * scaleUp);
      } else {
        this.letterGraphics.lineTo(point.x * scaleUp, point.y * scaleUp);
      }
    });
    this.letterGraphics.strokePath();
  }

  private startDrawing(pointer: Phaser.Input.Pointer): void {
    this.isDrawing = true;
    this.childDrawingGraphics.clear(); // Clear previous drawings
    this.childDrawingGraphics.lineStyle(20, 0x00ff00); // Green line for drawing

    this.childDrawingGraphics.beginPath();
    this.childDrawingGraphics.moveTo(pointer.x, pointer.y);

    console.log(pointer.x, pointer.y);
    this.drawnPoints = [{ x: pointer.x, y: pointer.y }];
  }

  private continueDrawing(pointer: Phaser.Input.Pointer): void {
    if (this.isDrawing) {
      this.childDrawingGraphics.lineTo(pointer.x, pointer.y);
      this.childDrawingGraphics.strokePath();
      this.drawnPoints.push({ x: pointer.x, y: pointer.y });
      // this.childDrawingGraphics.moveTo(pointer.x, pointer.y);
    }
  }

  private stopDrawing(): void {
    this.isDrawing = false;
    this.checkTracing(); // Validate the drawing
    console.log('Drawn Points:', this.drawnPoints); // Log drawn points for debugging
  }
  /* ------------------------------ drawind End ----------------------------- */

  // MARK: - Tracing check
  private checkTracing(): void {
    const tolerance = 20; // How close the drawing needs to be to the path
    let matchedPathPoints = 0; // Number of real path points covered
    const totalPathPoints = this.targetPath.length;
    let isOutOfBounds = false; // Flag to detect out-of-bounds drawing

    // Iterate over each point in the real path
    this.targetPath.forEach((pathPoint) => {
      const isMatched = this.drawnPoints.some((drawnPoint) => {
        const drawn = new Phaser.Geom.Point(drawnPoint.x, drawnPoint.y);
        return Phaser.Math.Distance.BetweenPoints(drawn, pathPoint) < tolerance;
      });

      if (isMatched) {
        matchedPathPoints++;
      }
    });

    // Check if any drawn point is outside the outer boundary
    this.drawnPoints.forEach((drawnPoint) => {
      const drawn = new Phaser.Geom.Point(drawnPoint.x, drawnPoint.y);
      const nearestOuterPoint = this.findNearestPointOnPath(
        drawn,
        this.outerPoints
      );

      // If the drawn point is farther from the nearest outer point than the tolerance, it's out of bounds
      if (
        Phaser.Math.Distance.BetweenPoints(drawn, nearestOuterPoint) > tolerance
      ) {
        isOutOfBounds = true;
      }
    });

    // Calculate coverage as a percentage
    const coverage = (matchedPathPoints / totalPathPoints) * 100;
    console.log(`Path Coverage: ${coverage.toFixed(2)}%`);
    console.log(`Out of Bounds: ${isOutOfBounds}`);

    // Provide feedback
    if (coverage > 92) {
      this.add
        .text(400, 500, 'Great job!', { fontSize: '32px', color: '#0f0' })
        .setOrigin(0.5);
    } else if (isOutOfBounds) {
      this.add
        .text(400, 500, 'You drew outside the boundaries!', {
          fontSize: '32px',
          color: '#f00',
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(400, 500, 'Try again!', { fontSize: '32px', color: '#f00' })
        .setOrigin(0.5);
    }
  }

  private findNearestPointOnPath(
    drawnPoint: Phaser.Geom.Point,
    pathPoints: Phaser.Geom.Point[]
  ): Phaser.Geom.Point {
    let nearestPoint = pathPoints[0];
    let minDistance = Phaser.Math.Distance.Between(
      drawnPoint.x,
      drawnPoint.y,
      nearestPoint.x,
      nearestPoint.y
    );

    for (const point of pathPoints) {
      const distance = Phaser.Math.Distance.Between(
        drawnPoint.x,
        drawnPoint.y,
        point.x,
        point.y
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    return nearestPoint;
  }

  // MARK: ANIMATIONS
  private showHandAnimation(
    path: { x: number; y: number }[],
    scaleUp: number
  ): void {
    if (!path || path.length < 2) return; // Ensure path has enough points to animate

    // Add the hand sprite
    const hand = this.add.sprite(
      path[0].x * scaleUp,
      path[0].y * scaleUp,
      'hand'
    );
    hand.setScale(0.06); // Adjust the size of the hand as needed

    // Create an array of tween targets from the path points
    const tweens = path.map((point) => ({
      x: point.x * scaleUp,
      y: point.y * scaleUp,
      duration: 200, // Duration for moving between points (adjust for speed)
    }));

    // Animate the hand along the path using the tweens
    this.tweens.timeline({
      targets: hand,
      tweens: tweens,
      ease: 'Linear', // Linear movement
      onComplete: () => {
        hand.destroy(); // Remove the hand after completing the animation
      },
    });
  }

  override update() {
    // Optionally add any animations or real-time updates
  }
}
