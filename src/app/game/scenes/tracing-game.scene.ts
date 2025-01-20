interface Letter {
  paths: { x: number; y: number }[][];
  dims: {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    wid: number; // Optional if calculated dynamically
  };
}

export class TracingGameScene extends Phaser.Scene {
  private letterData!: any; // Holds the loaded letter data
  private letterGraphics!: Phaser.GameObjects.Graphics;

  private childDrawingGraphics!: Phaser.GameObjects.Graphics; // Graphics for the child's drawing
  private isDrawing: boolean = false; // To track if the child is currently drawing
  private drawnPoints: { x: number; y: number }[] = []; // Store the points the child draws
  private targetPath: Phaser.Geom.Point[] = []; // The targetPath
  private outerPoints: Phaser.Geom.Point[] = []; // The targetPath
  private innerPoints: Phaser.Geom.Point[] = []; // The targetPath
  private lastValidPoint: Phaser.Geom.Point | null = null;

  private letterMask: any;

  private scaleUp: number = 10;
  private offsetX: number = 0;
  private offsetY: number = 0;

  private currentChunkIndex: number = 0; // Stores the index of the current chunk being processed

  constructor() {
    super({ key: 'TracingGameScene' });
  }

  // MARK: Preload
  preload() {
    // Load the JSON file containing the letter paths
    this.load.json('letters', 'assets/letters.json');
    this.load.image('arrow', 'assets/arrows/up-arrow.png');
    this.load.image('hand', 'assets/hands/hand.png'); // Replace with your hand image path
  }

  // MARK: Create
  create() {
    this.letterData = this.cache.json.get('letters').siin;

    // Initialize graphics object for drawing
    this.letterGraphics = this.add.graphics();
    this.childDrawingGraphics = this.add.graphics();

    // Draw the letter path
    console.log(this.letterData.paths);

    // Setup input and button functionality
    this.setupInputAndButton();

    // this.drawLetter(this.letterData.paths);

    // Draw the letter path with boundaries
    this.drawLetterWithBoundaries(this.letterData.paths, this.letterData.dims);

    // Set up input for drawing
    this.input.setPollAlways(); // Ensure smooth input tracking
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

  private setupInputAndButton(): void {
    // Access the input field and button
    const inputElement = document.getElementById(
      'letter-input'
    ) as HTMLInputElement;
    const buttonElement = document.getElementById(
      'draw-button'
    ) as HTMLButtonElement;

    // Add click event listener to the button
    buttonElement.addEventListener('click', () => {
      const letter = inputElement.value.toLowerCase().trim(); // Get the input value
      if (letter) {
        this.loadAndDrawLetter(letter);
      } else {
        console.error('Please enter a valid letter.');
      }
    });
  }

  private async loadAndDrawLetter(letter: string) {
    try {
      const response = await fetch(`https://lisaaniapi.khabirak.pro/api/word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numbers: this.generateWordASIICodes(letter) }),
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch data for letter "${letter}": ${response.statusText}`
        );
      }

      const letterData: Letter[] = await response.json(); // Parse the JSON response

      console.log(response);
      console.log(letterData);

      this.letterData = letterData;

      // Clear previous graphics
      this.letterGraphics.clear();
      this.childDrawingGraphics.clear();

      // Draw the new letter
      this.letterData.forEach(async (letter: Letter) => {
        this.drawLetterWithBoundaries([letter.paths], letter.dims);
      });
    } catch (error: any) {
      console.error(`Error fetching letter data: ${error.message}`);
    }
  }

  private drawLetter(paths: { x: number; y: number }[][]): void {
    this.letterGraphics.lineStyle(10, 0x0000ff, 1); // Blue line, 5px thick
    // Loop through each path in the paths array
    paths.forEach((path) => {
      this.letterGraphics.beginPath();
      path.forEach((point, index) => {
        if (index === 0) {
          // Move to the starting point
          this.letterGraphics.moveTo(point.x * this.scaleUp, point.y * this.scaleUp); // Scale up for visibility
        } else {
          // Draw a line to the next point
          this.letterGraphics.lineTo(point.x * this.scaleUp, point.y * this.scaleUp);
        }
      });
      this.letterGraphics.strokePath(); // Render the path
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

  private validateChildDrawing(
    chunk: { x: number; y: number }[][],
    scaleUp: number,
    offsetX: number,
    offsetY: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const tolerance = 20; // Define a tolerance for matching drawn points to the chunk
      let isValid = true;

      for (const path of chunk) {
        for (const point of path) {
          const drawnPoint = this.drawnPoints.find(
            (drawn) =>
              Phaser.Math.Distance.Between(
                point.x * scaleUp + offsetX,
                point.y * scaleUp + offsetY,
                drawn.x,
                drawn.y
              ) < tolerance
          );

          if (!drawnPoint) {
            isValid = false;
            break;
          }
        }

        if (!isValid) break;
      }

      // Simulate a delay for validation (e.g., after user finishes drawing)
      setTimeout(() => resolve(isValid), 500);
    });
  }

  // MARK: Draw letter boundaries
  private drawLetterWithBoundaries1(paths: { x: number; y: number }[][]): void {
    const offset = 1; // Offset distance for boundaries
    const scaleUp = 10;
    const boundingBox = this.calculateBoundingBox(paths);

    // Center the letter in the scene
    const sceneCenterX = this.cameras.main.width / 2;
    const sceneCenterY = this.cameras.main.height / 2;
    const offsetX =
      sceneCenterX -
      (boundingBox.width * scaleUp) / 2 -
      boundingBox.x * scaleUp;
    const offsetY =
      sceneCenterY -
      (boundingBox.height * scaleUp) / 2 -
      boundingBox.y * scaleUp;

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
          this.letterGraphics.moveTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        } else {
          this.letterGraphics.lineTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        }
      });
      this.letterGraphics.strokePath();

      // Draw the inner boundary
      this.letterGraphics.lineStyle(outlineThickness, 0x0000ff, 1); // Blue line, 3px thick
      this.letterGraphics.beginPath();
      innerPath.forEach((point, index) => {
        if (index === 0) {
          this.letterGraphics.moveTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        } else {
          this.letterGraphics.lineTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        }
      });
      this.letterGraphics.strokePath();

      // Draw the actual letter path
      this.drawDottedLineWithHand(path, scaleUp, 2000, offsetX, offsetY);
    });
  }

  private drawLetterWithBoundaries_v1(
    paths: { x: number; y: number }[][][],
    dims: {
      maxX: number;
      maxY: number;
      minX: number;
      minY: number;
      wid: number;
    }
  ): void {
    const scaleUp = 10;

    // Use dims directly for bounding box calculations
    const boundingBox = {
      minX: dims.minX,
      minY: dims.minY,
      maxX: dims.maxX,
      maxY: dims.maxY,
      width: dims.maxX - dims.minX,
      height: dims.maxY - dims.minY,
    };

    // Center the letter in the scene
    const sceneCenterX = this.cameras.main.width / 2;
    const sceneCenterY = this.cameras.main.height / 2;

    const offset = 1;
    const offsetX =
      sceneCenterX -
      (boundingBox.width * scaleUp) / 2 -
      boundingBox.minX * scaleUp;
    const offsetY =
      sceneCenterY -
      (boundingBox.height * scaleUp) / 2 -
      boundingBox.minY * scaleUp;

    console.log(paths);

    paths.forEach((path) => {
      path.forEach((path) => {
        // Calculate inner and outer paths
        const outerPath = this.calculateOffsetPath(path, offset);
        const innerPath = this.calculateOffsetPath(path, -offset);
        const outlineThickness = 3;

        // Draw the outer boundary
        this.letterGraphics.lineStyle(outlineThickness, 0xf000ff, 1); // Red line, 3px thick
        this.letterGraphics.beginPath();
        outerPath.forEach((point, index) => {
          if (index === 0) {
            this.letterGraphics.moveTo(
              point.x * scaleUp + offsetX,
              point.y * scaleUp + offsetY
            );
          } else {
            this.letterGraphics.lineTo(
              point.x * scaleUp + offsetX,
              point.y * scaleUp + offsetY
            );
          }
        });
        this.letterGraphics.strokePath();

        // Draw the inner boundary
        this.letterGraphics.lineStyle(outlineThickness, 0x00ffff, 1); // Blue line, 3px thick
        this.letterGraphics.beginPath();
        innerPath.forEach((point, index) => {
          if (index === 0) {
            this.letterGraphics.moveTo(
              point.x * scaleUp + offsetX,
              point.y * scaleUp + offsetY
            );
          } else {
            this.letterGraphics.lineTo(
              point.x * scaleUp + offsetX,
              point.y * scaleUp + offsetY
            );
          }
        });
        this.letterGraphics.strokePath();

        this.letterGraphics.lineStyle(2, 0x000000, 0.2); // Faint black line
        this.letterGraphics.beginPath();
        path.forEach((point, index) => {
          if (index === 0) {
            this.letterGraphics.moveTo(
              point.x * scaleUp + offsetX,
              point.y * scaleUp + offsetY
            );
          } else {
            this.letterGraphics.lineTo(
              point.x * scaleUp + offsetX,
              point.y * scaleUp + offsetY
            );
          }
        });
        this.letterGraphics.strokePath();

        // Draw the actual letter path
        // this.drawDottedLineWithHand(path, scaleUp, 2000, offsetX, offsetY);
      });
    });

    // Check if the current chunk index is valid
    if (this.currentChunkIndex >= paths[0].length) {
      console.log('All chunks completed!');
      return;
    }

    // Access the current chunk
    const currentChunk = paths[0][this.currentChunkIndex]; // First level (paths[0]) contains chunks
    console.log('Current Chunk:', currentChunk);

    // Animate the current chunk
    this.animateChunk(currentChunk, scaleUp, offsetX, offsetY).then(() => {
      console.log(
        `Chunk ${this.currentChunkIndex + 1
        } animation complete. Waiting for child to draw.`
      );
    });
  }

  private drawFullLetterDottedLineWithHand(
    path: { x: number; y: number }[],
    scaleUp: number,
    duration: number,
    offsetX: number,
    offsetY: number
  ): void {
    const dotRadius = 3; // Radius of each dot
    const dotSpacing = 10; // Spacing between each dot
    const totalDots = Math.floor(duration / 50); // Adjust based on animation speed
    const hand = this.add
      .sprite(0, 0, 'hand')
      .setOrigin(0.3, 0.2)
      .setScale(0.05)
      .setVisible(false)
      .setDepth(1);

    const dots: { x: number; y: number }[] = [];

    // Precompute all dot positions
    path.forEach((point, index) => {
      if (index < path.length - 1) {
        const start = path[index];
        const end = path[index + 1];

        const distance = Phaser.Math.Distance.Between(
          start.x * scaleUp + offsetX,
          start.y * scaleUp + offsetY,
          end.x * scaleUp + offsetX,
          end.y * scaleUp + offsetY
        );
        const direction = new Phaser.Math.Vector2(
          end.x - start.x,
          end.y - start.y
        ).normalize();

        let currentDistance = 0;
        while (currentDistance < distance) {
          dots.push({
            x: start.x * scaleUp + direction.x * currentDistance + offsetX,
            y: start.y * scaleUp + direction.y * currentDistance + offsetY,
          });
          currentDistance += dotSpacing;
        }
      }
    });

    let dotIndex = 0;
    const interval = setInterval(() => {
      if (dotIndex >= dots.length) {
        clearInterval(interval);

        const lastPoint = {
          x: path[path.length - 2].x * scaleUp + offsetX,
          y: path[path.length - 2].y * scaleUp + offsetY,
        };
        const arrowEnd = {
          x: path[path.length - 1].x * scaleUp + offsetX,
          y: path[path.length - 1].y * scaleUp + offsetY,
        };

        const angle = Phaser.Math.Angle.BetweenPoints(lastPoint, arrowEnd);

        this.letterGraphics.fillStyle(0xff0000, 1); // Red arrow
        this.letterGraphics.beginPath();
        this.letterGraphics.moveTo(arrowEnd.x, arrowEnd.y);
        this.letterGraphics.lineTo(
          arrowEnd.x - Math.cos(angle - Math.PI / 6) * 15,
          arrowEnd.y - Math.sin(angle - Math.PI / 6) * 15
        );
        this.letterGraphics.lineTo(
          arrowEnd.x - Math.cos(angle + Math.PI / 6) * 15,
          arrowEnd.y - Math.sin(angle + Math.PI / 6) * 15
        );
        this.letterGraphics.closePath();
        this.letterGraphics.fillPath();

        hand.destroy();
        return;
      }

      const dot = dots[dotIndex];
      this.letterGraphics.fillStyle(0xff0000, 1); // Red color for dots
      this.letterGraphics.fillCircle(dot.x, dot.y, dotRadius);

      hand.setPosition(Math.round(dot.x), Math.round(dot.y));
      hand.setVisible(true);

      dotIndex++;
    }, duration / totalDots);
  }

  private drawLetterWithBoundaries(
    paths: { x: number; y: number }[][][],
    dims: { maxX: number; maxY: number; minX: number; minY: number; wid: number; }
  ): void {
    // Calculate offsets to center the letter
    const { offsetX, offsetY } = this.calculateOffsets(dims, this.scaleUp);

    // Step 1: Draw the outer and inner boundaries for all paths
    paths.forEach((pathGroup) => {
      pathGroup.forEach((path) => {
        // Draw faint line for the actual letter path
        this.letterGraphics.lineStyle(20, 0x00f000, 0.5); // Faint black line
        this.letterGraphics.beginPath();
        path.forEach((point, index) => {
          if (index === 0) {
            this.letterGraphics.moveTo(
              point.x * this.scaleUp + offsetX,
              point.y * this.scaleUp + offsetY
            );
          } else {
            this.letterGraphics.lineTo(
              point.x * this.scaleUp + offsetX,
              point.y * this.scaleUp + offsetY
            );
          }
        });
        this.letterGraphics.strokePath();

        // Draw faint line for the actual letter path
        this.letterGraphics.lineStyle(2, 0x000000, 0.2); // Faint black line
        this.letterGraphics.beginPath();
        path.forEach((point, index) => {
          if (index === 0) {
            this.letterGraphics.moveTo(
              point.x * this.scaleUp + offsetX,
              point.y * this.scaleUp + offsetY
            );
          } else {
            this.letterGraphics.lineTo(
              point.x * this.scaleUp + offsetX,
              point.y * this.scaleUp + offsetY
            );
          }
        });
        this.letterGraphics.strokePath();
      });
    });

    // Create the mask for the letter area
    this.createLetterMask(paths[0], offsetX, offsetY); // Use the first level of paths for the mask

    // Step 2: Handle the current chunk animation
    if (this.currentChunkIndex >= paths[0].length) {
      console.log('All chunks completed!');
      return;
    }

    const currentChunk = paths[0][this.currentChunkIndex]; // First level (paths[0]) contains chunks
    console.log('Current Chunk:', currentChunk);

    let currentChunkIndex = this.currentChunkIndex - 1;

    // Animate the current chunk
    this.animateChunk(currentChunk, this.scaleUp, offsetX, offsetY).then(() => {
      // Step 3: Wait for the child to draw the chunk
      this.waitForChildToDraw(currentChunk, this.scaleUp, offsetX, offsetY).then(() => {
        // Check if all chunks are completed
        if (currentChunkIndex >= paths.length - 1) {
          return; // Stop if all chunks are done
        }

        if (currentChunkIndex >= 0) {
          // Validate the child's drawing
          const isValid = this.checkValidChunkDraw(
            this.drawnPoints.map(point => new Phaser.Geom.Point(point.x, point.y)),
            currentChunk,
            50 // Tolerance
          );

          if (isValid) {
            // Move to the next chunk
            currentChunkIndex++;
            this.currentChunkIndex = currentChunkIndex; // Update the class property

            // Reset drawnPoints for the next chunk
            this.drawnPoints = [];

            // Draw the next chunk
            this.drawLetterWithBoundaries(paths, dims);
          } else {
            // Encourage the child to try again
            // Replay the current chunk animation
            this.animateChunk(currentChunk, this.scaleUp, offsetX, offsetY).then(() => {
              // Wait for the child to draw again
              this.waitForChildToDraw(currentChunk, this.scaleUp, offsetX, offsetY);
            });
          }
        } else {
          // Show the first chunk
          currentChunkIndex++;
          this.currentChunkIndex = currentChunkIndex; // Update the class property
        }
      });
    });
  }

  // MARK: drawDottedLineWithHand
  private drawDottedLineWithHand(
    path: { x: number; y: number }[],
    scaleUp: number,
    duration: number,
    offsetX: number,
    offsetY: number
  ): void {
    // Ensure graphics context exists
    if (!this.letterGraphics) {
      this.letterGraphics = this.add.graphics();
    }

    const dotRadius = 3; // Radius of each dot
    const dotSpacing = 15; // Spacing between each dot
    const arrowScale = 0.5; // Adjusted scale for the arrow image
    const totalDots = Math.floor(duration / 50); // Adjust based on animation speed

    // Add a hand sprite to guide the drawing
    const hand = this.add
      .sprite(0, 0, 'hand')
      .setOrigin(0.5, 0.5)
      .setScale(0.05)
      .setVisible(false)
      .setDepth(1);

    const dots: { x: number; y: number; angle: number }[] = [];

    // Precompute all dot positions and their angles
    path.forEach((point, index) => {
      if (index < path.length - 1) {
        const start = path[index];
        const end = path[index + 1];

        const distance = Phaser.Math.Distance.Between(
          start.x * scaleUp + offsetX,
          start.y * scaleUp + offsetY,
          end.x * scaleUp + offsetX,
          end.y * scaleUp + offsetY
        );
        const direction = new Phaser.Math.Vector2(
          end.x - start.x,
          end.y - start.y
        ).normalize();

        const angle = Phaser.Math.Angle.Between(
          start.x * scaleUp + offsetX,
          start.y * scaleUp + offsetY,
          end.x * scaleUp + offsetX,
          end.y * scaleUp + offsetY
        );

        let currentDistance = 0;
        while (currentDistance < distance) {
          dots.push({
            x: start.x * scaleUp + direction.x * currentDistance + offsetX,
            y: start.y * scaleUp + direction.y * currentDistance + offsetY,
            angle: angle, // Save the angle for the arrow
          });
          currentDistance += dotSpacing;
        }
      }
    });

    // Debug: Log computed dots
    // Step 1: Draw the faint line for the entire path
    this.letterGraphics.lineStyle(2, 0x000000, 0.2); // Black line with 20% opacity
    this.letterGraphics.beginPath();
    path.forEach((point, index) => {
      if (index === 0) {
        this.letterGraphics.moveTo(
          point.x * scaleUp + offsetX,
          point.y * scaleUp + offsetY
        );
      } else {
        this.letterGraphics.lineTo(
          point.x * scaleUp + offsetX,
          point.y * scaleUp + offsetY
        );
      }
    });
    this.letterGraphics.strokePath();

    // Step 2: Animate dots and hand along the path
    let dotIndex = 0;
    const interval = setInterval(() => {
      if (dotIndex >= dots.length) {
        clearInterval(interval);

        // Draw the final arrow with an image
        const arrowEnd = dots[dots.length - 1];
        this.add
          .image(arrowEnd.x, arrowEnd.y, 'arrow')
          .setOrigin(0.5, 0.5)
          .setScale(arrowScale)
          .setRotation(arrowEnd.angle + Math.PI / 2); // Adjust rotation for arrow direction


        hand.destroy();
        return;
      }

      const dot = dots[dotIndex];
      this.letterGraphics.fillStyle(0xff0000, 1); // Red color for dots
      this.letterGraphics.fillCircle(dot.x, dot.y, dotRadius);

      // Place arrow images at regular intervals
      if (dotIndex % Math.floor(dotSpacing * 2 / dotRadius) === 0) {
        const arrow = this.add
          .image(dot.x, dot.y, 'arrow')
          .setOrigin(0.5, 0.5)
          .setScale(arrowScale)
          .setRotation(dot.angle + Math.PI / 2); // Adjust rotation for arrow direction

      }

      // Move the hand
      hand.setPosition(Math.round(dot.x), Math.round(dot.y));
      hand.setVisible(true);

      dotIndex++;
    }, duration / dots.length);
  }


  // MARK: animateChunk
  private animateChunk(
    chunk: { x: number; y: number }[],
    scaleUp: number,
    offsetX: number,
    offsetY: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const dotRadius = 3; // Radius of each dot
      const dotSpacing = 10; // Spacing between each dot
      const arrowSpacing = 25; // Spacing between arrows (larger than dotSpacing)
      const duration = 2000; // Total duration for the chunk animation
      const arrowScale = 0.05; // Scale for the arrow image
      const dots: { x: number; y: number; angle?: number }[] = [];

      const hand = this.add
        .sprite(0, 0, 'hand')
        .setOrigin(0.3, 0.2)
        .setScale(0.05)
        .setVisible(false)
        .setDepth(1);

      // Precompute dots for the entire chunk (single path)
      chunk.forEach((point, index) => {
        if (index < chunk.length - 1) {
          const start = chunk[index];
          const end = chunk[index + 1];

          const distance = Phaser.Math.Distance.Between(
            start.x * scaleUp + offsetX,
            start.y * scaleUp + offsetY,
            end.x * scaleUp + offsetX,
            end.y * scaleUp + offsetY
          );

          const direction = new Phaser.Math.Vector2(
            end.x - start.x,
            end.y - start.y
          ).normalize();

          const angle = Phaser.Math.Angle.Between(
            start.x * scaleUp + offsetX,
            start.y * scaleUp + offsetY,
            end.x * scaleUp + offsetX,
            end.y * scaleUp + offsetY
          );

          let currentDistance = 0;
          while (currentDistance < distance) {
            dots.push({
              x: start.x * scaleUp + direction.x * currentDistance + offsetX,
              y: start.y * scaleUp + direction.y * currentDistance + offsetY,
              angle: angle, // Save the angle for the arrow
            });
            currentDistance += dotSpacing;
          }
        }
      });

      // Step 1: Draw a faint line for the path
      this.letterGraphics.lineStyle(2, 0x000000, 0.2); // Black line with 20% opacity
      this.letterGraphics.beginPath();
      chunk.forEach((point, index) => {
        if (index === 0) {
          this.letterGraphics.moveTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        } else {
          this.letterGraphics.lineTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        }
      });
      this.letterGraphics.strokePath();

      // Step 2: Animate dots, hand, and arrows along the path
      let dotIndex = 0;
      const totalDots = dots.length;
      const dotDuration = duration / totalDots;

      const interval = setInterval(() => {
        if (dotIndex >= dots.length) {
          clearInterval(interval);
          hand.destroy(); // Remove the hand after animation

          // Draw the final arrow at the end of the path
          const finalDot = dots[dots.length - 1];
          if (finalDot.angle !== undefined) {
            if (dotIndex < dots.length - 2) {
              this.add
                .image(finalDot.x, finalDot.y, 'arrow')
                .setOrigin(0.5, 0.5)
                .setScale(arrowScale)
                .setRotation(finalDot.angle + Math.PI / 2);
            }
          } // Adjust rotation for arrow direction

          resolve(); // Signal animation completion
          return;
        }

        const dot = dots[dotIndex];

        // Draw dots at regular intervals
        if (dotIndex % Math.floor(dotSpacing / dotRadius) === 0) {
          this.letterGraphics.fillStyle(0xff0000, 1); // Red color for dots
          this.letterGraphics.fillCircle(dot.x, dot.y, dotRadius);
        }

        // Draw arrows at larger intervals
        if (dotIndex % Math.floor(arrowSpacing / dotRadius) === 0 && dot.angle !== undefined) {
          this.add
            .image(dot.x, dot.y, 'arrow')
            .setOrigin(0.5, 0.5)
            .setScale(arrowScale)
            .setRotation(dot.angle + Math.PI / 2); // Adjust rotation for arrow direction
        }

        // Move the hand
        hand.setPosition(Math.round(dot.x), Math.round(dot.y));
        hand.setVisible(true);

        dotIndex++;
      }, dotDuration);
    });
  }

  private waitForChildToDraw(
    chunk: { x: number; y: number }[],
    scaleUp: number,
    offsetX: number,
    offsetY: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // Add logic to validate the child's drawing
      // For example, check if the child's drawing matches the chunk
      // Once validated, resolve the promise
      resolve();
    });
  }

  private checkValidChunkDraw(
    playerPoints: Phaser.Geom.Point[], // The points drawn by the player
    segmentPoints: { x: number; y: number }[], // The points of the current segment
    tolerance: number = 20 // How close the drawing needs to be to the segment
  ): boolean {
    // Generate outer points for the segment (to account for thickness)
    const outerPoints = this.generateOuterPoints(segmentPoints, 10);

    // Count how many player points are close to the segment
    let correctPoints = 0;
    playerPoints.forEach((playerPoint) => {
      const nearestPoint = this.findNearestPointOnPath(playerPoint, outerPoints);
      if (
        Phaser.Math.Distance.Between(playerPoint.x, playerPoint.y, nearestPoint.x, nearestPoint.y) <
        tolerance
      ) {
        correctPoints++;
      }
    });

    // Calculate accuracy
    const accuracy = (correctPoints / outerPoints.length) * 100;

    // Return true if accuracy is above a threshold (e.g., 80%)
    return accuracy > 80;
  }

  private generateOuterPoints(
    path: { x: number; y: number }[],
    thickness: number
  ): { x: number; y: number }[] {
    const outerPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      const prevPoint = path[i - 1] || point;
      const nextPoint = path[i + 1] || point;

      // Calculate the direction of the line
      const angle = Phaser.Math.Angle.BetweenPoints(prevPoint, nextPoint);
      const perpendicularAngle = angle + Math.PI / 2; // Perpendicular to the line

      // Calculate outer points
      const outerPoint1 = {
        x: point.x + Math.cos(perpendicularAngle) * thickness,
        y: point.y + Math.sin(perpendicularAngle) * thickness,
      };
      const outerPoint2 = {
        x: point.x - Math.cos(perpendicularAngle) * thickness,
        y: point.y - Math.sin(perpendicularAngle) * thickness,
      };

      outerPoints.push(outerPoint1, outerPoint2);
    }
    return outerPoints;
  }

  private findNearestPointOnPath(
    playerPoint: Phaser.Geom.Point,
    pathPoints: { x: number; y: number }[]
  ): { x: number; y: number } {
    let nearestPoint = pathPoints[0];
    let minDistance = Phaser.Math.Distance.Between(playerPoint.x, playerPoint.y, nearestPoint.x, nearestPoint.y);

    for (const point of pathPoints) {
      const distance = Phaser.Math.Distance.Between(playerPoint.x, playerPoint.y, point.x, point.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    return nearestPoint;
  }

  /**
   * !Determines if a given point is inside a polygon boundary.
   */
  private isPointInsideBoundary(
    point: Phaser.Geom.Point,
    boundaryPoints: Phaser.Geom.Point[]
  ): boolean {
    return Phaser.Geom.Polygon.Contains(
      new Phaser.Geom.Polygon(boundaryPoints),
      point.x,
      point.y
    );
  }

  // MARK: Drawing
  /* ------------------------------ drawind start ----------------------------- */
  private startDrawing(pointer: Phaser.Input.Pointer): void {
    this.isDrawing = true;

    // Clear previous drawing
    this.childDrawingGraphics.clear();

    // Apply the mask to the child's drawing
    if (this.letterMask) {
      this.childDrawingGraphics.setMask(this.letterMask);
    }

    this.childDrawingGraphics.lineStyle(50, 0x1f5a00, 1);
    this.childDrawingGraphics.beginPath();

    this.drawnPoints = [{ x: pointer.x, y: pointer.y }];
  }

  private continueDrawing(pointer: Phaser.Input.Pointer): void {
    if (this.isDrawing) {
      const currentPoint = new Phaser.Geom.Point(pointer.x, pointer.y);

      // Draw a line from the last point to the current point
      if (this.drawnPoints.length > 0) {
        const lastPoint = this.drawnPoints[this.drawnPoints.length - 1];
        this.childDrawingGraphics.lineTo(currentPoint.x, currentPoint.y);
        this.childDrawingGraphics.strokePath();
      }

      // Add the current point to the drawnPoints array
      this.drawnPoints.push({ x: pointer.x, y: pointer.y });
    }
  }

  private stopDrawing(): void {
    this.isDrawing = false;
    console.log('Stopped Drawing');
    // Clip the child's drawing to the visible area
    // this.clipDrawingToVisibleArea();
    // Optionally validate the tracing here
    // this.checkTracing();
  }

  private isPointInVisibleArea(point: Phaser.Geom.Point): boolean {
    const tolerance = 20; // Thickness of the visible area
    const pathPoints = this.letterData.paths; // The path of the letter

    // Check if the point is close to any point in the path
    for (const pathPoint of pathPoints) {
      // Apply scale and offset to the path point
      const scaledPathPoint = {
        x: pathPoint.x * this.scaleUp + this.offsetX,
        y: pathPoint.y * this.scaleUp + this.offsetY,
      };

      const distance = Phaser.Math.Distance.Between(
        point.x,
        point.y,
        scaledPathPoint.x,
        scaledPathPoint.y
      );

      if (distance <= tolerance) {
        return true; // The point is within the visible area
      }
    }

    return false; // The point is outside the visible area
  }

  // MARK: Letter Mask
  private createLetterMask(
    paths: { x: number; y: number }[][],
    offsetX: number,
    offsetY: number,
    thickness: number = 2 // Thickness of the letter path
  ): void {
    // Clear any existing mask
    if (this.letterMask) {
      this.letterMask.destroy();
    }

    // Create a new mask graphics object
    const maskGraphics = this.add.graphics();
    maskGraphics.fillStyle(0xff0000, 0); // Red mask
    maskGraphics.beginPath();

    paths.forEach((path) => {
      const outerPoints: { x: number; y: number }[] = [];
      const innerPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];

        // Calculate the direction and perpendicular vector
        const direction = new Phaser.Math.Vector2(
          end.x - start.x,
          end.y - start.y
        ).normalize();
        const perpendicular = new Phaser.Math.Vector2(
          -direction.y,
          direction.x
        ).normalize();

        // Calculate the corners for the thick line segment
        outerPoints.push({
          x: (start.x + perpendicular.x * thickness / 2) * this.scaleUp + offsetX,
          y: (start.y + perpendicular.y * thickness / 2) * this.scaleUp + offsetY,
        });
        innerPoints.push({
          x: (start.x - perpendicular.x * thickness / 2) * this.scaleUp + offsetX,
          y: (start.y - perpendicular.y * thickness / 2) * this.scaleUp + offsetY,
        });

        // Add the last segment end points
        if (i === path.length - 2) {
          outerPoints.push({
            x: (end.x + perpendicular.x * thickness / 2) * this.scaleUp + offsetX,
            y: (end.y + perpendicular.y * thickness / 2) * this.scaleUp + offsetY,
          });
          innerPoints.push({
            x: (end.x - perpendicular.x * thickness / 2) * this.scaleUp + offsetX,
            y: (end.y - perpendicular.y * thickness / 2) * this.scaleUp + offsetY,
          });
        }
      }

      // Draw the outer and inner path as a polygon
      outerPoints.forEach((point, index) => {
        if (index === 0) {
          maskGraphics.moveTo(point.x, point.y);
        } else {
          maskGraphics.lineTo(point.x, point.y);
        }
      });

      // Reverse the inner points and close the polygon
      innerPoints.reverse().forEach((point) => {
        maskGraphics.lineTo(point.x, point.y);
      });

      maskGraphics.closePath();
    });

    maskGraphics.fillPath();

    // Create a mask from the graphics object
    this.letterMask = maskGraphics.createGeometryMask();
  }

  private clipDrawingToVisibleArea(): void {
    // Create a mask for the visible area
    const mask = this.add.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.beginPath();

    // Calculate offsets to center the letter
    const { offsetX, offsetY } = this.calculateOffsets(this.letterData.dims, this.scaleUp);

    // Draw the thick path as the mask (with scale and offset)
    this.letterData.paths.forEach((point: { x: number; y: number }, index: number) => {
      const scaledPoint = {
        x: point.x * this.scaleUp + offsetX,
        y: point.y * this.scaleUp + offsetY,
      };

      if (index === 0) {
        mask.moveTo(scaledPoint.x, scaledPoint.y);
      } else {
        mask.lineTo(scaledPoint.x, scaledPoint.y);
      }
    });

    mask.closePath();
    mask.fillPath();

    // Apply the mask to the child's drawing
    this.childDrawingGraphics.setMask(mask.createGeometryMask());
  }

  private findIntersectionWithBoundary(
    startPoint: Phaser.Geom.Point,
    endPoint: Phaser.Geom.Point,
    boundaryPoints: Phaser.Geom.Point[]
  ): Phaser.Geom.Point | null {
    // Ensure boundaryPoints is not empty
    if (boundaryPoints.length === 0) {
      return null;
    }

    const boundaryPolygon = new Phaser.Geom.Polygon(boundaryPoints);
    const segment = new Phaser.Geom.Line(
      startPoint.x,
      startPoint.y,
      endPoint.x,
      endPoint.y
    );

    // Get the intersection result
    const intersectionResult = Phaser.Geom.Intersects.GetLineToPolygon(
      segment,
      boundaryPolygon
    );

    console.log(intersectionResult);

    // Check if the result is a Vector4 (Phaser 3.60+)
    if (intersectionResult && typeof intersectionResult.x === 'number') {
      // Return the intersection point as a Phaser.Geom.Point
      return new Phaser.Geom.Point(intersectionResult.x, intersectionResult.y);
    }

    // If no intersection, return null
    return null;
  }

  private isPointWithinPath(
    point: Phaser.Geom.Point,
    path: Phaser.Geom.Point[]
  ): boolean {
    const tolerance = 20; // Allowable distance from the path
    return path.some(
      (pathPoint) =>
        Phaser.Math.Distance.BetweenPoints(point, pathPoint) < tolerance
    );
  }

  // MARK: - Tracing check
  private checkTracing(): void {
    const tolerance = 20; // How close the drawing needs to be to the path
    let matchedPathPoints = 0; // Number of real path points covered
    const totalPathPoints = this.targetPath.length;

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

    // Calculate coverage as a percentage
    const coverage = (matchedPathPoints / totalPathPoints) * 100;
    console.log(`Path Coverage: ${coverage.toFixed(2)}%`);

    // Provide feedback
    if (coverage > 90) {
      this.add
        .text(400, 500, 'Great job!', { fontSize: '32px', color: '#0f0' })
        .setOrigin(0.5);
    } else {
      this.add
        .text(400, 500, 'Try again!', { fontSize: '32px', color: '#f00' })
        .setOrigin(0.5);
    }
  }

  /* ------------------------------ drawind End ----------------------------- */

  private checkTracing1(): void {
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

  // private findNearestPointOnPath(
  //   drawnPoint: Phaser.Geom.Point,
  //   pathPoints: Phaser.Geom.Point[]
  // ): Phaser.Geom.Point {
  //   let nearestPoint = pathPoints[0];
  //   let minDistance = Phaser.Math.Distance.Between(
  //     drawnPoint.x,
  //     drawnPoint.y,
  //     nearestPoint.x,
  //     nearestPoint.y
  //   );

  //   for (const point of pathPoints) {
  //     const distance = Phaser.Math.Distance.Between(
  //       drawnPoint.x,
  //       drawnPoint.y,
  //       point.x,
  //       point.y
  //     );
  //     if (distance < minDistance) {
  //       minDistance = distance;
  //       nearestPoint = point;
  //     }
  //   }

  //   return nearestPoint;
  // }

  // MARK: ANIMATIONS
  // private showHandAnimation(
  //   path: { x: number; y: number }[],
  //   scaleUp: number
  // ): void {
  //   if (!path || path.length < 2) return; // Ensure path has enough points to animate

  //   // Add the hand sprite
  //   const hand = this.add.sprite(
  //     path[0].x * scaleUp,
  //     path[0].y * scaleUp,
  //     'hand'
  //   );
  //   hand.setScale(0.06); // Adjust the size of the hand as needed

  //   // Create an array of tween targets from the path points
  //   const tweens = path.map((point) => ({
  //     x: point.x * scaleUp,
  //     y: point.y * scaleUp,
  //     duration: 200, // Duration for moving between points (adjust for speed)
  //   }));

  //   // Animate the hand along the path using the tweens
  //   this.tweens.timeline({
  //     targets: hand,
  //     tweens: tweens,
  //     ease: 'Linear', // Linear movement
  //     onComplete: () => {
  //       hand.destroy(); // Remove the hand after completing the animation
  //     },
  //   });
  // }

  override update() {
    // Optionally add any animations or real-time updates
  }

  generateWordASIICodes(word: string): number[] {
    const asciiCodes: number[] = [];
    for (let i = 0; i < word.length; i++) {
      asciiCodes.push(word.charCodeAt(i));
    }
    return asciiCodes;
  }

  private calculateBoundingBox(
    paths: { x: number; y: number }[][]
  ): Phaser.Geom.Rectangle {
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;

    paths.forEach((path) => {
      path.forEach((point) => {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
      });
    });

    return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  // MARK: OFFSETS
  private calculateOffsets(
    dims: { maxX: number; maxY: number; minX: number; minY: number; wid: number; },
    scaleUp: number
  ): { offsetX: number; offsetY: number } {
    // Calculate bounding box dimensions
    const boundingBox = {
      minX: dims.minX,
      minY: dims.minY,
      maxX: dims.maxX,
      maxY: dims.maxY,
      width: dims.maxX - dims.minX,
      height: dims.maxY - dims.minY,
    };


    // Center the letter in the scene
    const sceneCenterX = this.cameras.main.width / 2;
    const sceneCenterY = this.cameras.main.height / 2;

    // Calculate offsets to center the letter
    const offsetX =
      sceneCenterX -
      (boundingBox.width * scaleUp) / 2 -
      boundingBox.minX * scaleUp;
    const offsetY =
      sceneCenterY -
      (boundingBox.height * scaleUp) / 2 -
      boundingBox.minY * scaleUp;

    return { offsetX, offsetY };
  }
}
