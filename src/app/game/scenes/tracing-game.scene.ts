import { OnInit } from "@angular/core";
import { getTransformedChunk } from "../utils/tracing-game.utils";

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

type LetterSegment = {
  start: Phaser.Geom.Point;
  end: Phaser.Geom.Point;
  bounds: Phaser.Geom.Rectangle;
  angle: number; // Angle of the segment
  completed: boolean; // Indicates if the segment is completed
};

export class TracingGameScene extends Phaser.Scene {
  private letterData!: any; // Holds the loaded letter data
  private letterGraphics: Phaser.GameObjects.Graphics[] = [];

  private childDrawingGraphics!: Phaser.GameObjects.Graphics; // Graphics for the child's drawing
  private isDrawing: boolean = false; // To track if the child is currently drawing
  private drawnPoints: { x: number; y: number }[] = []; // Store the points the child draws
  private targetPath: Phaser.Geom.Point[] = []; // The targetPath
  private outerPoints: Phaser.Geom.Point[] = []; // The targetPath
  private innerPoints: Phaser.Geom.Point[] = []; // The targetPath
  private lastValidPoint: Phaser.Geom.Point | null = null;

  private letterMask: any;

  private scaleUp: number = 10;
  private offsetX: number = 10;
  private offsetY: number = 10;

  private currentLetterIndex: number = 0; // Stores the index of the current chunk being processed
  private currentChunkIndex: number = 0; // Stores the index of the current chunk being processed
  private currentChunk: { x: number; y: number }[] = [];

  private segmentVisuals: Phaser.GameObjects.Graphics[][] = [];
  private hitsPerSegment: number[] = [];
  private minHitsPerSegment = 5; // Points needed to "complete" a segment
  // private segments: { start: Phaser.Geom.Point; end: Phaser.Geom.Point; bounds: Phaser.Geom.Rectangle }[] = [];
  private segments: LetterSegment[][] = [];
  private drawnSegments!: LetterSegment[];

  private currentSegmentIndex: number = 0;
  private segmentStates: ('pending' | 'active' | 'completed' | 'error')[] = [];
  private lastValidPosition: Phaser.Geom.Point | null = null;

  // ANIMATION
  private animationInterval: number | null = null;
  private isAnimating: boolean = false;

  // COLORS
  private currentSegmentColor: number = 0xffff00; // Yellow for current segment
  private completedSegmentColor: number = 0x019295; // Green for completed segments
  private drawingChunkColor: number = 0x27AFEF; // Blue for the current chunk
  private currentChunkColor: number = 0x000; // Blue for the current chunk
  // private currentChunkColor: number = 0xF48E07; // Blue for the current chunk
  private defaultLetterColor: number = 0xd3d3d3; // Blue for the current chunk
  private arrowColor: number = 0xffff00; // Black for the arrow

  private firstDotColor: number = 0xDD5746; // Green for the first dot
  private dotsColor: number = 0xffffff; // Red for the dots

  // CHUNKS
  // This array stores the elements for each chunk
  private chunkElements: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Image)[] = [];
  // This array stores the elements for each chunk in the initial animation for the full letter
  private initialAnimationElements: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Image)[] = [];

  private completedChunks: Set<number> = new Set(); // Stores indices of completed chunks
  private segmentDrawSuccessRate: number = 95; // Minimum completion rate to move to the next chunk


  // OBJECTS DEPTHS
  private handDepth = 1;
  private readonly chunkFinishedDepth = 1;
  private readonly chunkUnfinishedDepth = 1;
  private readonly letterDepth = 1;

  private drawingTimeout: any;

  constructor() {
    super({ key: 'TracingGameScene' });
  }

  // MARK: Preload
  preload() {
    // Load the JSON file containing the letter paths
    this.load.json('letters', 'assets/letters.json');
    this.load.image('arrow', 'assets/arrows/arrow-sm-up.svg');
    this.load.image('arrow-up', 'assets/arrows/arrow-sm-up.svg');
    this.load.image('arrow-down', 'assets/arrows/arrow-sm-down.svg');
    this.load.image('arrow-left', 'assets/arrows/arrow-sm-left.svg');
    this.load.image('arrow-right', 'assets/arrows/arrow-sm-right.svg');
    this.load.image('hand', 'assets/hands/hand.png'); // Replace with your hand image path
  }

  // MARK: Create
  create() {
    this.letterData = this.cache.json.get('letters').siin;

    // Initialize graphics object for drawing
    this.letterGraphics[this.currentChunkIndex] = this.add.graphics();
    this.childDrawingGraphics = this.add.graphics();

    // Draw the letter path
    // console.log(this.letterData.chunks);

    // Setup input and button functionality
    this.setupInputAndButton();

    // this.drawLetter(this.letterData.chunks);

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
      this.letterGraphics[this.currentChunkIndex].clear();
      this.childDrawingGraphics.clear();

      // Draw the new letter
      this.letterData.forEach(async (letter: Letter) => {
        this.drawLetterWithBoundaries([letter.paths], letter.dims);
      });
    } catch (error: any) {
      console.error(`Error fetching letter data: ${error.message}`);
    }
  }

  /**
 * Draws faint lines for the letter's outer and inner boundaries.
 * @param paths - The letter's path data.
 * @param offsetX - The X offset for centering.
 * @param offsetY - The Y offset for centering.
 */
  private drawFaintLetterPaths(paths: { x: number; y: number }[][][], offsetX: number, offsetY: number): void {
    console.log(paths);

    paths.forEach((pathGroup) => {
      pathGroup.forEach((path) => {
        // Draw faint line for the actual letter path
        this.letterGraphics[this.currentChunkIndex].lineStyle(20, this.defaultLetterColor, 0.5); // Faint gray line
        this.letterGraphics[this.currentChunkIndex].beginPath();
        path.forEach((point, index) => {
          const x = point.x * this.scaleUp + offsetX;
          const y = point.y * this.scaleUp + offsetY;
          index === 0 ? this.letterGraphics[this.currentChunkIndex].moveTo(x, y) : this.letterGraphics[this.currentChunkIndex].lineTo(x, y);
        });
        this.letterGraphics[this.currentChunkIndex].strokePath();

      });
    });
  }

  /**
 * Animates the current chunk and waits for the child to draw.
 * @param currentChunk - The current chunk to animate.
 * @param scaleUp - The scaling factor.
 * @param offsetX - The X offset for centering.
 * @param offsetY - The Y offset for centering.
 */
  private animateAndWaitForChunk(
    currentChunk: { x: number; y: number }[],
    scaleUp: number,
    offsetX: number,
    offsetY: number
  ): Promise<void> {
    return this.animateChunk(currentChunk, scaleUp, offsetX, offsetY).then(() => {
      return this.waitForChildToDraw(currentChunk, scaleUp, offsetX, offsetY);
    });
  }

  /**
 * Validates the child's drawing and moves to the next chunk if valid.
 * @param paths - The letter's path data.
 * @param dims - The dimensions of the letter.
 * @param segments - The segments of the current chunk.
 */


  // MARK: Draw letter boundaries
  private drawLetterWithBoundaries(
    paths: { x: number; y: number }[][][],
    dims: { maxX: number; maxY: number; minX: number; minY: number; wid: number; }
  ): void {
    // Reset state variables if not reinitializing a completed chunk
    if (!this.completedChunks.has(this.currentChunkIndex)) {
      this.currentChunk = [];
      this.drawnPoints = [];
    }

    // Step 1: Calculate offsets to center the letter
    const offsets = this.calculateOffsets(dims, this.scaleUp);
    this.offsetX = offsets.offsetX;
    this.offsetY = offsets.offsetY;

    // Step 2: Clear previous segments
    // this.segmentVisuals[this.currentChunkIndex].forEach(g => g.destroy());
    this.segmentVisuals[this.currentChunkIndex] = [];

    // Step 3: Draw faint letter paths
    // check here if already a chunk is drawn
    if (this.currentChunkIndex <= 0) {
      this.drawFaintLetterPaths(paths, this.offsetX, this.offsetY);
    }

    // Step 4: Create the mask for the letter area
    // this.createLetterMask(paths[this.currentLetterIndex], this.offsetX, this.offsetY);

    // Step 5: Stop if all chunks are completed
    if (this.currentChunkIndex >= paths[this.currentLetterIndex].length) {
      this.onLetterCompleted(); // Handle full completion (custom logic)
      return;
    }

    // Step 6: Get and transform current chunk data
    const transformedChunk = getTransformedChunk(
      paths,
      this.currentLetterIndex,
      this.currentChunkIndex,
      this.scaleUp,
      this.offsetX,
      this.offsetY
    );

    // Step 8: Initialize segments
    // this.segments[this.currentChunkIndex] = this.dividePathIntoSegments(transformedChunk);
    this.currentChunk = transformedChunk;

    // Step 9: Animate and handle drawing
    this.animateFullLetter(this.letterData.paths[this.currentLetterIndex], this.scaleUp, this.offsetX, this.offsetY)
      .then(() => {
        // After the full letter animation is complete, reset the initial animation elements
        // this.initialAnimationElements.forEach(element => element.destroy());
        console.log('Initial animation complete');
        console.log('Current Chunk Index:', this.currentChunkIndex);

        if (!this.letterGraphics[this.currentChunkIndex]) {
          this.letterGraphics[this.currentChunkIndex] = this.add.graphics();
        }
        this.drawFaintLetterPaths(paths, this.offsetX, this.offsetY);

        // and then draw the first chunk
        return this.animateChunk(this.letterData.paths[this.currentLetterIndex][0], this.scaleUp, this.offsetX, this.offsetY);
      })
      .then(() => {
        // Start the drawing timeout
        this.startDrawingTimeout();
        console.log('First chunk animation complete');
      });
  }

  private onLetterCompleted(): void {
    console.log('All chunks completed!');
    console.log('Letter drawing completed!');
    // Add logic to display success, transition to another activity, etc.

    alert('All chunks completed!, Letter drawing completed!');
  }

  // MARK: animateChunk
  private async animateChunk(
    chunk: { x: number; y: number }[],
    scaleUp: number,
    offsetX: number,
    offsetY: number
  ): Promise<void> {
    const dotRadius = 3; // Radius of each dot
    const dotSpacing = 10; // Spacing between each dot
    const dashSpacing = 10; // Spacing between dashes
    const duration = 2000; // Total duration for the chunk animation
    const arrowScale = 0.05; // Scale for the arrow image

    // Step 6: Get and transform current chunk data
    const transformedChunk = getTransformedChunk(
      this.letterData.paths,
      this.currentLetterIndex,
      this.currentChunkIndex,
      this.scaleUp,
      this.offsetX,
      this.offsetY
    );


    // Step 8: Initialize segments
    this.segments[this.currentChunkIndex] = this.dividePathIntoSegments(transformedChunk);

    // Initialize letterGraphics if it does not exist
    if (!this.letterGraphics[this.currentChunkIndex]) {
      this.letterGraphics[this.currentChunkIndex] = this.add.graphics();
      this.chunkElements.push(this.letterGraphics[this.currentChunkIndex]);

      // Change the chunk depth if the chunk index is greater than 0
      if (this.currentChunkIndex > 0) {
        this.letterGraphics[this.currentChunkIndex].setDepth(this.handDepth + 1);
        this.handDepth += this.currentChunkIndex * 3 + 1;
      }
    }

    // Clear any existing interval
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }

    // Add a hand sprite to guide the drawing
    const hand = this.add
      .sprite(0, 0, 'hand')
      .setOrigin(0.3, 0.2)
      .setScale(0.05)
      .setVisible(false)
      .setDepth(this.handDepth);

    console.log(this.handDepth);


    // Precompute dots for the entire chunk (single path)
    const dots = this.precomputeDots(chunk, scaleUp, offsetX, offsetY, dotSpacing);

    // Step 1: Draw the faint line for the chunk
    this.drawPath(this.letterGraphics[this.currentChunkIndex], [chunk], scaleUp, offsetX, offsetY);

    await this.animateDotsAndArrows(dots, dotRadius, dashSpacing, duration, arrowScale, hand);
  }

  private async animateFullLetter(
    letterData: { x: number; y: number }[][],
    scaleUp: number,
    offsetX: number,
    offsetY: number
  ): Promise<void> {
    const allDots: { x: number; y: number; angle?: number }[] = [];
    const dotSpacing = 10; // Spacing between each dot

    // Precompute dots for the entire letter (all chunks)
    letterData.forEach(chunk => {
      const chunkDots = this.precomputeDots(chunk, scaleUp, offsetX, offsetY, dotSpacing);
      allDots.push(...chunkDots);
    });

    if (!this.letterGraphics[this.currentChunkIndex]) {
      this.letterGraphics[this.currentChunkIndex] = this.add.graphics();
      this.chunkElements.push(this.letterGraphics[this.currentChunkIndex]);
    }

    // Step 1: Draw the faint line for the entire letter
    this.drawPath(this.letterGraphics[this.currentChunkIndex], letterData, scaleUp, offsetX, offsetY);

    // Add a hand sprite to guide the drawing
    const hand = this.add
      .sprite(0, 0, 'hand')
      .setOrigin(0.3, 0.2)
      .setScale(0.05)
      .setVisible(false)
      .setDepth(this.handDepth);

    // Step 2: Animate dots and arrows for the entire letter
    await this.animateDotsAndArrows(allDots, 3, 10, 5000, 0.05, hand);

    // sleep for 1 second
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Clear graphics and remove dots and arrows after animation is complete
    this.clearGraphics();
  }

  private clearGraphics(): void {
    this.letterGraphics.forEach(graphic => graphic.clear());
    this.chunkElements.forEach(element => element.destroy());
    this.letterGraphics = [];
    this.chunkElements = [];
    this.handDepth = 1;
  }

  private precomputeDots(
    chunk: { x: number; y: number }[],
    scaleUp: number,
    offsetX: number,
    offsetY: number,
    dotSpacing: number
  ): { x: number; y: number; angle?: number }[] {
    const dots: { x: number; y: number; angle?: number }[] = [];
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
    return dots;
  }

  private drawPath(
    graphics: Phaser.GameObjects.Graphics,
    chunks: { x: number; y: number }[][],
    scaleUp: number,
    offsetX: number,
    offsetY: number,
    color: number = this.currentChunkColor
  ): Phaser.GameObjects.Graphics {
    graphics.lineStyle(20, color, 1); // Black line with 50% opacity

    chunks.forEach(chunk => {
      graphics.beginPath();
      chunk.forEach((point, index) => {
        if (index === 0) {
          graphics.moveTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        } else {
          graphics.lineTo(
            point.x * scaleUp + offsetX,
            point.y * scaleUp + offsetY
          );
        }
      });
      graphics.strokePath();
    });

    return graphics;
  }

  private animateDotsAndArrows(
    dots: { x: number; y: number; angle?: number }[],
    dotRadius: number,
    dashSpacing: number,
    duration: number,
    arrowScale: number,
    hand: Phaser.GameObjects.Sprite
  ): Promise<void> {
    return new Promise((resolve) => {
      let dotIndex = 0;
      const totalDots = dots.length;
      const dotDuration = duration / totalDots;

      this.animationInterval = setInterval(() => {
        if (dotIndex >= dots.length) {
          clearInterval(this.animationInterval!);
          hand.destroy(); // Remove the hand after animation

          // Draw the final arrow at the end of the path
          const finalDot = dots[dots.length - 1];
          if (finalDot.angle !== undefined) {
            const adjustedAngle = finalDot.angle - Math.PI / 2; // Adjust the angle to point up
            const arrow = this.add
              .image(finalDot.x, finalDot.y, 'arrow')
              .setOrigin(0.5, 0.5)
              .setScale(arrowScale)
              .setRotation(adjustedAngle) // Rotate the arrow based on the angle
              .setDepth(this.handDepth); // Ensure arrow is above the hand

            this.chunkElements.push(arrow);
          }

          resolve(); // Signal animation completion
          return;
        }

        const dot = dots[dotIndex];

        if (dotIndex === 0) {
          this.letterGraphics[this.currentChunkIndex].fillStyle(this.firstDotColor, 1); // Green color for the starting dot
          this.letterGraphics[this.currentChunkIndex].fillCircle(dot.x, dot.y, dotRadius);
        } else if (dotIndex === dots.length - 1) {
          if (dot.angle !== undefined) {
            const adjustedAngle = dot.angle - Math.PI / 2; // Adjust the angle to point up
            const arrow = this.add
              .image(dot.x, dot.y, 'arrow')
              .setOrigin(0.5, 0.5)
              .setScale(arrowScale)
              .setRotation(adjustedAngle) // Rotate the arrow based on the angle
              .setDepth(this.handDepth); // Ensure arrow is above the hand

            this.chunkElements.push(arrow);
          }
        } else {
          if (dotIndex % Math.floor(dashSpacing / dashSpacing + 1) === 0) {
            const nextDot = dots[dotIndex + 2];
            if (nextDot && dotIndex < dots.length - 4) {
              this.letterGraphics[this.currentChunkIndex].fillStyle(this.dotsColor, 1); // Red color for dashes
              this.letterGraphics[this.currentChunkIndex].fillCircle(dot.x, dot.y, dotRadius);
            }
          }
        }

        hand.setPosition(Math.round(dot.x), Math.round(dot.y));
        hand.setVisible(true);

        dotIndex++;
      }, dotDuration);
    });
  }

  // MARK: waitForChildToDraw
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


  // MARK: Drawing
  /* ------------------------------ drawind start ----------------------------- */
  private startDrawing(pointer: Phaser.Input.Pointer): void {
    this.isDrawing = true;

    // Clear previous drawing
    this.childDrawingGraphics.clear();

    // Apply the mask to the child's drawing
    // if (this.letterMask) {
    //   this.childDrawingGraphics.setMask(this.letterMask);
    // }

    this.childDrawingGraphics.alpha = 0;

    const startPoint = new Phaser.Geom.Point(pointer.x, pointer.y);
    const isValidStart = this.segments.some(segment =>
      Phaser.Geom.Rectangle.ContainsPoint(segment[this.currentChunkIndex].bounds, startPoint)
    );

    if (!isValidStart) {
      this.resetCurrentDrawing(); // Reset if starting from an invalid position
      console.log('Invalid start position, resetting current drawing. Total segments:', this.segments[this.currentChunkIndex].length);

      return;
    }

    // Allow restarting from the last valid position or beginning
    if (!this.lastValidPosition) {
      this.drawnPoints = [];
      this.currentSegmentIndex = 0;
    } else {

      // Start from the last valid position
      this.drawnPoints.push(this.lastValidPosition);

    }

    this.clearDrawingTimeout();

  }

  private startDrawingTimeout(): void {
    this.clearDrawingTimeout();
    this.drawingTimeout = setTimeout(() => {
      this.showPenAndAnimateDots();
    }, 3000); // 3 seconds of inactivity
  }

  private clearDrawingTimeout(): void {
    if (this.drawingTimeout) {
      clearTimeout(this.drawingTimeout);
      this.drawingTimeout = null;
    }
  }

  private showPenAndAnimateDots(): void {
    const currentChunk = this.letterData.paths[this.currentLetterIndex][this.currentChunkIndex];
    const dots = this.precomputeDots(currentChunk, this.scaleUp, this.offsetX, this.offsetY, 10);

    // Add a hand sprite to guide the drawing
    const hand = this.add
      .sprite(0, 0, 'hand')
      .setOrigin(0.3, 0.2)
      .setScale(0.05)
      .setVisible(false)
      .setDepth(this.handDepth);

    this.animateDotsAndArrows(dots, 3, 10, 2000, 0.05, hand);
  }

  private continueDrawing(pointer: Phaser.Input.Pointer): void {
    if (!this.isDrawing) return;

    const point = new Phaser.Geom.Point(pointer.x, pointer.y);
    let isOnPath = false;
    const tolerance = 10; // Allow a margin of error around the segment bounds

    // Iterate through segments to check containment and update
    this.segments[this.currentChunkIndex].forEach((segment, index) => {
      // Expand the segment bounds by the tolerance
      const expandedBounds = Phaser.Geom.Rectangle.Clone(segment.bounds);
      expandedBounds.x -= tolerance;
      expandedBounds.y -= tolerance;
      expandedBounds.width += tolerance * 2;
      expandedBounds.height += tolerance * 2;

      if (Phaser.Geom.Rectangle.ContainsPoint(expandedBounds, point)) {
        isOnPath = true;

        // Mark as active segment
        if (!segment.completed) {
          this.updateSegmentColor(index, this.drawingChunkColor); // Red for active segment
          this.hitsPerSegment[index] = (this.hitsPerSegment[index] || 0) + 1;

          // Check for completion
          if (this.hitsPerSegment[index] >= this.minHitsPerSegment) {
            // console.log(`Segment ${index} completed.`);
            segment.completed = true;
          }
        }
      }
    });

    // If the user goes off the path, reset the drawing
    if (!isOnPath) {
      console.log('User went off the path. Resetting progress.');
      this.resetCurrentDrawing();
      return;
    }

    // Add point to drawn path
    this.drawnPoints.push(point);
  }

  private stopDrawing(paths: { x: number; y: number }[][][]): void {
    this.isDrawing = false;
    console.log('Stopped Drawing');

    // Calculate the number of completed segments
    const completedSegments = this.segments[this.currentChunkIndex].filter(segment => segment.completed).length;
    const totalSegments = this.segments[this.currentChunkIndex].length;
    const completionRate = (completedSegments / totalSegments) * 100;

    console.log(`Completion Rate: ${completionRate}%`);

    // If at least 80% of the segments are completed, move to the next chunk
    if (completionRate >= this.segmentDrawSuccessRate) {
      this.completedChunks.add(this.currentChunkIndex); // Mark this chunk as completed
      this.chunkCompleted(this.segments[this.currentChunkIndex]);
      ++this.currentChunkIndex;
      this.segments[this.currentChunkIndex] = []
      this.segmentVisuals[this.currentChunkIndex] = []
      console.log('Chunk completed. Moving to the next chunk.');

      // clear the chunk elements
      this.chunkElements.forEach(element => element.destroy());

      // Draw the next chunk if it exists
      // Stop if all chunks are completed
      if (this.currentChunkIndex < this.letterData.paths[this.currentLetterIndex].length) {
        this.animateChunk(this.letterData.paths[this.currentLetterIndex][this.currentChunkIndex], this.scaleUp, this.offsetX, this.offsetY);
      } else {
        this.onLetterCompleted(); // Handle full completion (custom logic)
        return;
      }

    } else {
      console.log('Chunk not completed. Try again.');
      this.resetCurrentDrawing(); // Optionally reset the current chunk
    }

    // Start the drawing timeout
    this.startDrawingTimeout();
  }


  // MARK: Path Segments
  private dividePathIntoSegments(
    path: { x: number; y: number }[],
    segmentHeight: number = 5,    // Width across the path (thickness)
    segmentWidth: number = 20   // Length along the path
  ): LetterSegment[] {

    console.log('SEGMENTS FROM DIVIDE PATH INTO SEGMENTS', this.segments);

    const segments: LetterSegment[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const pathStart = new Phaser.Geom.Point(path[i].x, path[i].y);
      const pathEnd = new Phaser.Geom.Point(path[i + 1].x, path[i + 1].y);

      const distance = Phaser.Math.Distance.BetweenPoints(pathStart, pathEnd);
      const direction = new Phaser.Math.Vector2(pathEnd.x - pathStart.x, pathEnd.y - pathStart.y).normalize();
      const angle = Phaser.Math.Angle.BetweenPoints(pathStart, pathEnd);

      let currentDistance = 0;
      while (currentDistance < distance) {
        const segmentStart = new Phaser.Geom.Point(
          pathStart.x + direction.x * currentDistance,
          pathStart.y + direction.y * currentDistance
        );

        const segmentEnd = new Phaser.Geom.Point(
          pathStart.x + direction.x * (currentDistance + segmentHeight),
          pathStart.y + direction.y * (currentDistance + segmentHeight)
        );

        const center = new Phaser.Geom.Point(
          (segmentStart.x + segmentEnd.x) / 2,
          (segmentStart.y + segmentEnd.y) / 2
        );

        segments.push({
          start: segmentStart,
          end: segmentEnd,
          bounds: new Phaser.Geom.Rectangle(
            center.x - segmentHeight / 2,
            center.y - segmentWidth / 2,
            segmentHeight,
            segmentWidth
          ),
          angle: angle,
          completed: false
        });

        currentDistance += segmentHeight;
      }
    }

    // this.drawDebugSegments(segments);
    this.segments[this.currentChunkIndex] = segments;
    return segments;
  }

  private drawDebugSegments(segments: LetterSegment[]): void {
    segments.forEach((segment) => {
      const graphics = this.add.graphics();
      // graphics.lineStyle(1, 0xff0000, 1).setDepth(1);
      // graphics.fillStyle(0x00ff00, 1);

      // Get dimensions from bounds
      const rectWidth = segment.bounds.width;
      const rectHeight = segment.bounds.height;
      const centerX = segment.bounds.centerX;
      const centerY = segment.bounds.centerY;
      const angle = segment.angle;

      // Calculate corners relative to center
      const halfW = rectWidth / 2;
      const halfH = rectHeight / 2;
      const corners = [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH }
      ];

      // Rotate and translate corners
      const rotatedCorners = corners.map(p => ({
        x: centerX + (p.x * Math.cos(angle) - p.y * Math.sin(angle)),
        y: centerY + (p.x * Math.sin(angle) + p.y * Math.cos(angle))
      }));

      // Draw rotated rectangle
      graphics.beginPath();
      graphics.moveTo(rotatedCorners[0].x, rotatedCorners[0].y);
      rotatedCorners.forEach(p => graphics.lineTo(p.x, p.y));
      graphics.closePath();

      graphics.fillPath();
      graphics.strokePath();

      this.segmentVisuals[this.currentChunkIndex].push(graphics);
    });
  }
  private updateSegmentColor(segmentIndex: number, color: number): void {
    if (this.segmentVisuals[this.currentChunkIndex][segmentIndex]) {
      const graphics = this.segmentVisuals[this.currentChunkIndex][segmentIndex];
      const segment = this.segments[this.currentChunkIndex][segmentIndex];

      graphics.clear();

      // Calculate angle from segment direction
      const angle = Phaser.Math.Angle.BetweenPoints(segment.start, segment.end);

      // Get segment dimensions
      const centerX = segment.bounds.centerX;
      const centerY = segment.bounds.centerY;
      const halfWidth = segment.bounds.width / 2;
      const halfHeight = segment.bounds.height / 2;

      // Calculate rotated corners
      const corners = [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight }
      ].map(p => ({
        x: centerX + (p.x * Math.cos(angle) - p.y * Math.sin(angle)),
        y: centerY + (p.x * Math.sin(angle) + p.y * Math.cos(angle))
      }));

      // CHange the depth of the graphics according to the chunk index
      graphics.setDepth(this.handDepth + 1);

      // Redraw with new color
      graphics.fillStyle(color, 1); // Fill color with some transparency
      graphics.lineStyle(2, color, 1); // Border color



      graphics.beginPath();
      graphics.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach(p => graphics.lineTo(p.x, p.y));
      graphics.closePath();
      graphics.fillPath(); // Fill the segment
      graphics.strokePath(); // Draw the border
    }
  }

  // change the color of the chunk to green
  private chunkCompleted(segments: LetterSegment[]): void {
    segments.forEach((segment, index) => {
      this.updateSegmentColor(index, this.completedSegmentColor);
    });
  }

  private resetCurrentDrawing(): void {
    const currentChunkSegments = this.segments[this.currentChunkIndex];
    this.drawnPoints = []; // Clear drawn points
    this.currentSegmentIndex = 0; // Reset to the first segment
    this.segmentVisuals[this.currentChunkIndex].forEach(g => g.clear()); // Clear all segment visuals
    currentChunkSegments.forEach(segment => (segment.completed = false)); // Reset segment completion
    this.drawDebugSegments(currentChunkSegments); // Redraw the original segments
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

  private createArrowSVG(angle: number): string {
    const svg = `
          <?xml version="1.0" encoding="utf-8"?>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${angle} 12 12)"/>
          </svg>
      `;
    return svg;
  }

  private svgToTexture(scene: Phaser.Scene, svg: string, textureKey: string): void {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      scene.textures.addImage(textureKey, img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  private getArrowDirection(angle: number): string {
    const degrees = Phaser.Math.RadToDeg(angle);
    console.log('arrow angle', degrees);

    if (degrees >= -45 && degrees < 45) {
      return 'arrow-right';
    } else if (degrees >= 45 && degrees < 135) {
      return 'arrow-down';
    } else if (degrees >= -135 && degrees < -45) {
      return 'arrow-up';
    } else {
      return 'arrow-left';
    }
  }
}
