import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonButtons } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { refresh } from 'ionicons/icons';

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Pin {
  x: number;
  y: number;
  width: number;
  height: number;
  fallen: boolean;
  fallingAngle: number;
  velocityX: number;
  velocityY: number;
}

interface Ball {
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  spinning: boolean;
  curve: number;
  trail: { x: number; y: number; alpha: number }[];
  distanceTraveled: number; // Track how far the ball has traveled
  curveStartDistance: number; // Distance at which curve starts to take effect
  inGutter: boolean; // Track if ball is in the gutter
}

interface Arrow {
  x: number;
  y: number;
  direction: number; // Angle in radians
  visible: boolean;
}

@Component({
  selector: 'app-bowling-minigame',
  templateUrl: './minigame.page.html',
  styleUrls: ['./minigame.page.scss'],
  imports: [IonButtons, CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon],
})
export class MinigamePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationId!: number;
  private gameState: 'ready' | 'aiming' | 'rolling' | 'finished' = 'ready';

  // Game objects
  private ball: Ball = {
    x: 0,
    y: 0,
    radius: 23, // Increased for better proportion
    velocityX: 0,
    velocityY: 0,
    spinning: false,
    curve: 0,
    trail: [],
    distanceTraveled: 0,
    curveStartDistance: 85, // Start curving earlier - after traveling 80 pixels
    inGutter: false,
  };

  private pins: Pin[] = [];
  private particles: Particle[] = [];
  private arrows: Arrow[] = [];

  // Game settings
  private readonly LANE_WIDTH = 280;
  private readonly LANE_HEIGHT = 600;
  private readonly PIN_WIDTH = 24;
  private readonly PIN_HEIGHT = 50;
  private readonly GRAVITY = 0.5;
  private readonly FRICTION = 0.98;
  private readonly CURVE_FORCE = 0.175; // 15% reduction from 0.25 (0.25 * 0.85)

  // Touch/mouse tracking
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private aimX = 0;
  private aimY = 0;

  score = 0;
  pinsKnocked = 0;

  constructor(private hapticService: HapticService) {
    addIcons({ refresh });
  }

  ngOnInit() {
    this.setupGame();
  }

  ngAfterViewInit() {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Set canvas size
    this.canvas.width = this.LANE_WIDTH;
    this.canvas.height = this.LANE_HEIGHT;

    this.setupEventListeners();
    this.gameLoop();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private setupGame() {
    this.setupPins();
    this.setupArrows();
    this.resetBall();
    this.particles = [];
    this.score = 0;
    this.pinsKnocked = 0;
    this.gameState = 'ready';
  }

  private setupPins() {
    this.pins = [];
    const pinPositions = [
      // Evenly spaced bowling pin formation - maximum even spacing for both X and Y
      [45, 25],
      [100, 25],
      [180, 25],
      [235, 25],
      [72, 50],
      [140, 50],
      [208, 50],
      [100, 75],
      [180, 75],
      [140, 100],
    ];

    pinPositions.forEach(([x, y]) => {
      this.pins.push({
        x,
        y,
        width: this.PIN_WIDTH,
        height: this.PIN_HEIGHT,
        fallen: false,
        fallingAngle: 0,
        velocityX: 0,
        velocityY: 0,
      });
    });
  }

  // Update the setupArrows() method to position arrows in triangular formation
  private setupArrows() {
    this.arrows = [];
    const arrowY = this.LANE_HEIGHT - 120; // Base position for arrows
    const centerX = this.LANE_WIDTH / 2;

    // Diagonal 7-arrow formation
    this.arrows = [
      // Top center (1 arrow)
      { x: centerX, y: arrowY - 60, direction: 0, visible: true },

      // Second row (2 arrows)
      { x: centerX - 30, y: arrowY - 40, direction: 0, visible: true },
      { x: centerX + 30, y: arrowY - 40, direction: 0, visible: true },

      // Third row (2 arrows - wider spread)
      { x: centerX - 60, y: arrowY - 20, direction: 0, visible: true },
      { x: centerX + 60, y: arrowY - 20, direction: 0, visible: true },

      // Bottom row (2 arrows - widest spread)
      { x: centerX - 90, y: arrowY, direction: 0, visible: true },
      { x: centerX + 90, y: arrowY, direction: 0, visible: true },
    ];
  }

  // Update the renderArrows() method to make them black and arrow-shaped
  private renderArrows() {
    this.arrows.forEach((arrow) => {
      if (!arrow.visible) return;

      this.ctx.save();
      this.ctx.translate(arrow.x, arrow.y);
      this.ctx.rotate(arrow.direction);

      // Arrow color - black like in real bowling lanes
      this.ctx.fillStyle = '#000000';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 1;

      // Classic bowling arrow shape (pointing toward pins)
      this.ctx.beginPath();
      this.ctx.moveTo(0, -15); // Arrow tip (pointing up toward pins)
      this.ctx.lineTo(-6, -5); // Left wing
      this.ctx.lineTo(-2, -5); // Left inner
      this.ctx.lineTo(-2, 8); // Left stem
      this.ctx.lineTo(2, 8); // Right stem
      this.ctx.lineTo(2, -5); // Right inner
      this.ctx.lineTo(6, -5); // Right wing
      this.ctx.closePath();

      this.ctx.fill();

      this.ctx.restore();
    });
  }

  private resetBall() {
    this.ball = {
      x: this.LANE_WIDTH / 2,
      y: this.LANE_HEIGHT - 50,
      radius: 23, // Increased from 15 for better proportion with larger pins
      velocityX: 0,
      velocityY: 0,
      spinning: false,
      curve: 0,
      trail: [],
      distanceTraveled: 0,
      curveStartDistance: 90, // Start curving earlier - after traveling 80 pixels
      inGutter: false,
    };
  }

  private setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleStart(e.offsetX, e.offsetY));
    this.canvas.addEventListener('mousemove', (e) => this.handleMove(e.offsetX, e.offsetY));
    this.canvas.addEventListener('mouseup', () => this.handleEnd());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.handleStart(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.handleMove(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleEnd();
    });
  }

  private handleStart(x: number, y: number) {
    if (this.gameState !== 'ready') return;

    this.isDragging = true;
    this.startX = x;
    this.startY = y;
    this.gameState = 'aiming';
    this.hapticService.vibrate(ImpactStyle.Light);
  }

  private handleMove(x: number, y: number) {
    if (!this.isDragging || this.gameState !== 'aiming') return;

    this.aimX = x;
    this.aimY = y;
  }

  private handleEnd() {
    if (!this.isDragging || this.gameState !== 'aiming') return;

    this.isDragging = false;
    this.throwBallFromSwipe();
    this.gameState = 'rolling';
    this.hapticService.vibrate(ImpactStyle.Medium);
  }

  private throwBallFromSwipe() {
    const deltaX = this.aimX - this.startX;
    const deltaY = this.aimY - this.startY;
    const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 15% reduction in speed for more controlled movement
    const speedMultiplier = 0.068; // Reduced from 0.08 by 15% (0.08 * 0.85 = 0.068)

    // Direct mapping of finger movement to ball velocity
    this.ball.velocityX = deltaX * speedMultiplier;
    this.ball.velocityY = deltaY * speedMultiplier;

    // Ensure minimum forward speed if user swipes mostly horizontally
    if (Math.abs(this.ball.velocityY) < 0.85) {
      this.ball.velocityY = -0.85; // Reduced minimum forward movement (15% less)
    }

    // Improved curve detection - only curve if gesture shows actual curvature
    let curveAmount = 0;

    if (totalDistance > 25) {
      // Require meaningful gesture length
      // Only apply curve if there's significant horizontal movement AND it's not a straight horizontal swipe
      const minHorizontalMovement = 15;
      const verticalComponent = Math.abs(deltaY);

      // Check if this is actually a curved gesture, not just horizontal movement
      if (Math.abs(deltaX) > minHorizontalMovement && verticalComponent > Math.abs(deltaX) * 0.3) {
        // This gesture has both horizontal and sufficient vertical movement - could be curved
        const curveSensitivity = 0.017; // 15% reduction from 0.02 (0.02 * 0.85 = 0.017)
        curveAmount = deltaX * curveSensitivity;
      }
      // If it's mostly horizontal (low vertical component), no curve is applied
    }

    this.ball.curve = curveAmount;
    this.ball.spinning = Math.abs(curveAmount) > 0.01; // Only spin if there's meaningful curve

    // Reset distance tracking for new throw
    this.ball.distanceTraveled = 0;
  }

  private gameLoop() {
    this.update();
    this.render();
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  private update() {
    if (this.gameState === 'rolling') {
      this.updateBall();
      this.updatePins();
      this.updateParticles();
      this.checkCollisions();

      // TODO 2 second timer after ball reaches certain Y then finish, state not setting
      // need to adjust pin fall for this
      // Check if ball has passed the pins (y < 0) or gone off screen
      if (
        this.ball.y < -100 ||
        this.ball.y > this.LANE_HEIGHT + 50 ||
        (Math.abs(this.ball.velocityX) < 0.015 && Math.abs(this.ball.velocityY) < 0.015)
      ) {
        this.gameState = 'finished';
        this.calculateScore();

        // Auto-reset after 2 seconds
        setTimeout(() => {
          this.resetGame();
        }, 2000);
      }
    }
  }

  private updateBall() {
    // Calculate distance traveled this frame
    const speed = Math.sqrt(this.ball.velocityX * this.ball.velocityX + this.ball.velocityY * this.ball.velocityY);
    this.ball.distanceTraveled += speed;

    // Add current position to trail
    if (this.ball.spinning) {
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y, alpha: 1.0 });

      // Limit trail length
      if (this.ball.trail.length > 15) {
        this.ball.trail.shift();
      }

      // Fade trail
      this.ball.trail.forEach((point, index) => {
        point.alpha = index / this.ball.trail.length;
      });
    }

    // Apply curve only after breakpoint distance - with good curve strength
    if (this.ball.spinning && this.ball.distanceTraveled > this.ball.curveStartDistance) {
      // Calculate curve intensity based on distance past breakpoint
      const curveProgress = Math.min((this.ball.distanceTraveled - this.ball.curveStartDistance) / 100, 1.0);
      // Good curve strength like before, but with slight speed dependency to prevent infinite curve
      const speedFactor = Math.max(speed / 4.0, 0.3); // Minimum 30% curve strength
      const curveMultiplier = curveProgress * 0.6 * speedFactor; // Restored good curve strength

      // Negative curve value for correct direction (left swipe = left curve)
      this.ball.velocityX += -this.ball.curve * this.CURVE_FORCE * curveMultiplier;
    }

    // Update position
    this.ball.x += this.ball.velocityX;
    this.ball.y += this.ball.velocityY;

    // Apply normal friction - not too strong
    this.ball.velocityX *= 0.996; // Reduced friction so curve works better
    this.ball.velocityY *= 0.997; // Light friction on forward movement

    // Curve effect decays very slowly so it continues working
    if (this.ball.spinning) {
      this.ball.curve *= 0.9995; // Very slow curve decay
    }

    // Gutter mechanics - realistic bowling lane behavior
    const gutterWidth = 18;
    const gutterBoundaryLeft = gutterWidth + this.ball.radius / 2; // Gutter starts when ball is halfway over
    const gutterBoundaryRight = this.LANE_WIDTH - gutterWidth - this.ball.radius / 2;

    if (!this.ball.inGutter) {
      // Check if ball is entering gutter (halfway over the boundary)
      if (this.ball.x < gutterBoundaryLeft || this.ball.x > gutterBoundaryRight) {
        this.ball.inGutter = true;
        this.hapticService.vibrate(ImpactStyle.Medium); // Gutter entry feedback

        // Position ball in center of gutter
        if (this.ball.x < gutterBoundaryLeft) {
          this.ball.x = gutterWidth / 2; // Left gutter center
        } else {
          this.ball.x = this.LANE_WIDTH - gutterWidth / 2; // Right gutter center
        }

        // Reduce horizontal velocity significantly when entering gutter
        this.ball.velocityX *= 0.3;
        // Stop curve when in gutter
        this.ball.curve = 0;
        this.ball.spinning = false;
      }
    } else {
      // Ball is in gutter - keep it there and let it roll to the end
      // Constrain ball to gutter bounds
      if (this.ball.x < gutterWidth / 2) {
        this.ball.x = gutterWidth / 2; // Left gutter
      } else if (this.ball.x > this.LANE_WIDTH - gutterWidth / 2) {
        this.ball.x = this.LANE_WIDTH - gutterWidth / 2; // Right gutter
      }

      // Very minimal horizontal movement in gutter
      this.ball.velocityX *= 0.95;
    }
  }

  private updatePins() {
    this.pins.forEach((pin, index) => {
      if (pin.fallen) {
        // Apply physics to fallen pins
        pin.x += pin.velocityX;
        pin.y += pin.velocityY;

        // Check for collisions with other pins during movement
        this.checkMovingPinCollisions(pin, index);

        // Apply friction - pins lose energy over time
        pin.velocityX *= this.FRICTION;
        pin.velocityY *= this.FRICTION;

        // Apply gravity effect (pins fall down)
        pin.velocityY += this.GRAVITY * 0.15;

        // Update falling animation with more realistic physics
        if (pin.fallingAngle < Math.PI / 2) {
          // Falling speed based on current velocity
          const fallingSpeed = Math.sqrt(pin.velocityX * pin.velocityX + pin.velocityY * pin.velocityY);
          pin.fallingAngle += 0.1 + fallingSpeed * 0.02; // Faster pins fall faster
        }

        // Keep pins within reasonable bounds
        if (pin.x < 0) {
          pin.x = 0;
          pin.velocityX = Math.abs(pin.velocityX) * 0.3; // Bounce off edges with energy loss
        }
        if (pin.x > this.LANE_WIDTH) {
          pin.x = this.LANE_WIDTH;
          pin.velocityX = -Math.abs(pin.velocityX) * 0.3;
        }
        if (pin.y > this.LANE_HEIGHT) {
          pin.y = this.LANE_HEIGHT;
          pin.velocityY = -Math.abs(pin.velocityY) * 0.2; // Less bouncy on lane surface
        }

        // Stop very slow pins to prevent infinite tiny movements
        if (Math.abs(pin.velocityX) < 0.1 && Math.abs(pin.velocityY) < 0.1) {
          pin.velocityX = 0;
          pin.velocityY = 0;
        }
      }
    });
  }

  private checkMovingPinCollisions(movingPin: Pin, movingPinIndex: number) {
    this.pins.forEach((otherPin, otherIndex) => {
      if (movingPinIndex === otherIndex) return; // Don't check collision with self

      const dx = otherPin.x - movingPin.x;
      const dy = otherPin.y - movingPin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const collisionDistance = this.PIN_WIDTH + 3; // Slightly larger collision area

      if (distance < collisionDistance && distance > 0) {
        // Collision detected!
        const movingSpeed = Math.sqrt(movingPin.velocityX * movingPin.velocityX + movingPin.velocityY * movingPin.velocityY);

        if (!otherPin.fallen && movingSpeed > 0.5) {
          // Moving pin knocks down standing pin
          otherPin.fallen = true;

          // Calculate collision angle and transfer momentum
          const collisionAngle = Math.atan2(dy, dx);
          const momentumTransfer = movingSpeed * 0.6;

          otherPin.velocityX = Math.cos(collisionAngle) * momentumTransfer + movingPin.velocityX * 0.3;
          otherPin.velocityY = Math.sin(collisionAngle) * momentumTransfer + movingPin.velocityY * 0.3;

          // Slow down the moving pin
          movingPin.velocityX *= 0.7;
          movingPin.velocityY *= 0.7;

          this.pinsKnocked++;
          this.hapticService.vibrate(ImpactStyle.Light);
          this.createParticles(otherPin.x, otherPin.y);
        } else if (otherPin.fallen) {
          // Both pins are fallen - prevent overlap by pushing them apart
          const overlap = collisionDistance - distance;
          if (overlap > 0) {
            const separationX = (dx / distance) * overlap * 0.5;
            const separationY = (dy / distance) * overlap * 0.5;

            // Push pins apart
            movingPin.x -= separationX;
            movingPin.y -= separationY;
            otherPin.x += separationX;
            otherPin.y += separationY;

            // Exchange some momentum for realistic collision
            const tempVelX = movingPin.velocityX * 0.4;
            const tempVelY = movingPin.velocityY * 0.4;
            movingPin.velocityX += otherPin.velocityX * 0.2 - tempVelX;
            movingPin.velocityY += otherPin.velocityY * 0.2 - tempVelY;
            otherPin.velocityX += tempVelX;
            otherPin.velocityY += tempVelY;
          }
        } else {
          // Moving pin hits standing pin but not enough speed to knock it down
          // Just push the moving pin back slightly to prevent overlap
          const pushBackX = (dx / distance) * (collisionDistance - distance) * 0.5;
          const pushBackY = (dy / distance) * (collisionDistance - distance) * 0.5;
          movingPin.x -= pushBackX;
          movingPin.y -= pushBackY;

          // Reduce moving pin's velocity
          movingPin.velocityX *= 0.8;
          movingPin.velocityY *= 0.8;
        }
      }
    });
  }

  private checkCollisions() {
    // Only check pin collisions if ball is not in gutter
    if (this.ball.inGutter) {
      return; // Balls in gutter don't hit pins
    }

    this.pins.forEach((pin) => {
      if (!pin.fallen) {
        const dx = this.ball.x - pin.x;
        const dy = this.ball.y - pin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.ball.radius + pin.width / 2) {
          // Pin hit!
          this.hitPin(pin, dx, dy, distance);
        }
      }
    });

    // Check pin-to-pin collisions
    this.checkPinToPinCollisions();
  }

  private hitPin(pin: Pin, dx: number, dy: number, distance: number) {
    pin.fallen = true;

    // Calculate ball's momentum and entry angle
    const ballSpeed = Math.sqrt(this.ball.velocityX * this.ball.velocityX + this.ball.velocityY * this.ball.velocityY);

    // Calculate impact angle (angle from pin to ball)
    const impactAngle = Math.atan2(-dy, -dx);

    // Transfer momentum based on entry angle and ball speed
    const momentumTransfer = ballSpeed * 0.6; // 60% of ball momentum transfers
    const angleInfluence = 0.8; // How much impact angle affects direction

    // Pin velocity based on impact angle and ball momentum
    pin.velocityX = Math.cos(impactAngle) * momentumTransfer * angleInfluence + this.ball.velocityX * 0.4; // 40% from ball's actual velocity
    pin.velocityY = Math.sin(impactAngle) * momentumTransfer * angleInfluence + this.ball.velocityY * 0.4;

    // Add some controlled randomness for realism (less than before)
    pin.velocityX += (Math.random() - 0.5) * 1.5;
    pin.velocityY += (Math.random() - 0.5) * 1.5;

    // Calculate ball deflection based on collision physics
    const ballMass = 16; // Standard bowling ball weight
    const pinMass = 3.5; // Standard pin weight
    const totalMass = ballMass + pinMass;

    // Conservation of momentum - ball deflection
    const deflectionFactor = pinMass / totalMass;
    const normalX = dx / distance;
    const normalY = dy / distance;

    // Apply deflection to ball
    this.ball.velocityX += normalX * ballSpeed * deflectionFactor * 0.3;
    this.ball.velocityY += normalY * ballSpeed * deflectionFactor * 0.3;

    // Ball loses some energy in the collision but maintains most of its momentum
    this.ball.velocityX *= 0.88; // Less energy loss for more realistic carry
    this.ball.velocityY *= 0.92;
    this.ball.curve *= 0.95; // Slight curve reduction

    this.hapticService.vibrate(ImpactStyle.Heavy);
    this.pinsKnocked++;
    this.createParticles(pin.x, pin.y);
  }

  private checkPinToPinCollisions() {
    for (let i = 0; i < this.pins.length; i++) {
      const pin1 = this.pins[i];
      if (!pin1.fallen) continue;

      for (let j = i + 1; j < this.pins.length; j++) {
        const pin2 = this.pins[j];

        // Check collision between moving pin and standing pin
        if (pin1.fallen && !pin2.fallen) {
          this.checkPinCollision(pin1, pin2);
        } else if (!pin1.fallen && pin2.fallen) {
          this.checkPinCollision(pin2, pin1);
        }
        // Also check fallen pin to fallen pin collisions for realistic pile-up
        else if (pin1.fallen && pin2.fallen) {
          this.checkFallenPinCollision(pin1, pin2);
        }
      }
    }
  }

  private checkPinCollision(movingPin: Pin, standingPin: Pin) {
    const dx = standingPin.x - movingPin.x;
    const dy = standingPin.y - movingPin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = this.PIN_WIDTH + 2;

    if (distance < minDistance && distance > 0) {
      const movingPinSpeed = Math.sqrt(movingPin.velocityX * movingPin.velocityX + movingPin.velocityY * movingPin.velocityY);

      // Only knock down if moving pin has sufficient speed
      if (movingPinSpeed > 0.8) {
        standingPin.fallen = true;

        // Calculate collision angle
        const collisionAngle = Math.atan2(dy, dx);

        // Transfer momentum based on collision physics
        const momentumTransfer = movingPinSpeed * 0.7;
        standingPin.velocityX = Math.cos(collisionAngle) * momentumTransfer;
        standingPin.velocityY = Math.sin(collisionAngle) * momentumTransfer;

        // Add some spin effect from the moving pin
        standingPin.velocityX += movingPin.velocityX * 0.3;
        standingPin.velocityY += movingPin.velocityY * 0.3;

        // Slow down the moving pin
        movingPin.velocityX *= 0.7;
        movingPin.velocityY *= 0.7;

        this.pinsKnocked++;
        this.hapticService.vibrate(ImpactStyle.Light);
        this.createParticles(standingPin.x, standingPin.y);
      }
    }
  }

  private checkFallenPinCollision(pin1: Pin, pin2: Pin) {
    const dx = pin2.x - pin1.x;
    const dy = pin2.y - pin1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = this.PIN_WIDTH + 1;

    if (distance < minDistance && distance > 0) {
      // Simple elastic collision between fallen pins
      const overlap = minDistance - distance;
      const separationX = (dx / distance) * overlap * 0.5;
      const separationY = (dy / distance) * overlap * 0.5;

      // Separate the pins
      pin1.x -= separationX;
      pin1.y -= separationY;
      pin2.x += separationX;
      pin2.y += separationY;

      // Exchange some velocity for realistic bouncing
      const tempX = pin1.velocityX * 0.3;
      const tempY = pin1.velocityY * 0.3;
      pin1.velocityX += pin2.velocityX * 0.3 - tempX;
      pin1.velocityY += pin2.velocityY * 0.3 - tempY;
      pin2.velocityX += tempX - pin2.velocityX * 0.3;
      pin2.velocityY += tempY - pin2.velocityY * 0.3;
    }
  }

  private render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.LANE_WIDTH, this.LANE_HEIGHT);

    this.renderLane();
    this.renderArrows();
    this.renderPins();
    this.renderBall();
    this.renderParticles();
  }

  private renderLane() {
    // Lane background
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(0, 0, this.LANE_WIDTH, this.LANE_HEIGHT);

    // Lane wood texture (39 vertical lines) - adjusted spacing for smaller lane
    this.ctx.strokeStyle = '#654321';
    this.ctx.lineWidth = 1;
    const lineSpacing = this.LANE_WIDTH / 39; // Calculate spacing for 39 vertical lines
    for (let i = 0; i < 39; i++) {
      const x = i * lineSpacing;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.LANE_HEIGHT);
      this.ctx.stroke();
    }

    // Lane gutters - slightly smaller
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(0, 0, 18, this.LANE_HEIGHT);
    this.ctx.fillRect(this.LANE_WIDTH - 18, 0, 18, this.LANE_HEIGHT);
  }

  private renderPins() {
    this.pins.forEach((pin) => {
      this.ctx.save();

      if (pin.fallen) {
        // Render fallen pin with rotation
        this.ctx.translate(pin.x, pin.y);
        this.ctx.rotate(pin.fallingAngle);

        // Pin shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.drawRoundedRect(-pin.width / 2 + 2, -pin.height / 2 + 2, pin.width, pin.height, 6);
        this.ctx.fill();

        // Pin body with classic bowling pin shape
        this.drawPinShape(-pin.width / 2, -pin.height / 2, pin.width, pin.height);
      } else {
        // Render standing pin
        const pinX = pin.x - pin.width / 2;
        const pinY = pin.y - pin.height / 2;

        // Pin shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.drawRoundedRect(pinX + 3, pinY + 3, pin.width, pin.height, 6); // 6px radius on top corners
        this.ctx.fill();

        // Pin body with shape
        this.drawPinShape(pinX, pinY, pin.width, pin.height);
      }

      this.ctx.restore();
    });
  }
  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius); // Top-right corner
    this.ctx.lineTo(x + width, y + height);
    this.ctx.lineTo(x, y + height);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y); // Top-left corner
    this.ctx.closePath();
  }
  private drawPinShape(x: number, y: number, width: number, height: number) {
    // Pin shadow/depth
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.drawPinOutline(x + 2, y + 2, width, height);
    this.ctx.fill();

    // Pin body (main white area with better gradient)
    const gradient = this.ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.2, '#F5F5F5');
    gradient.addColorStop(0.5, '#EEEEEE');
    gradient.addColorStop(0.8, '#E0E0E0');
    gradient.addColorStop(1, '#CCCCCC');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.drawPinOutline(x, y, width, height);
    this.ctx.fill();

    // Pin outline for definition
    this.ctx.strokeStyle = '#B0B0B0';
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    this.drawPinOutline(x, y, width, height);
    this.ctx.stroke();

    // Red stripes (two stripes like real bowling pins)
    this.ctx.fillStyle = '#DC143C';
    // Upper stripe with slight curve following pin shape
    this.ctx.fillRect(x + width * 0.22, y + height * 0.35, width * 0.55, 3);
    // Lower stripe
    this.ctx.fillRect(x + width * 0.035, y + height * 0.6, width * 0.93, 3);

    // Secondary highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + width * 0.4, y + height * 0.45, width * 0.08, height * 0.06, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private drawPinOutline(x: number, y: number, width: number, height: number) {
    // Draw pin with more realistic curved shape
    // Bottom (wider base)
    this.ctx.moveTo(x, y + height);
    this.ctx.lineTo(x + width, y + height);
    // Right side with smoother curves
    this.ctx.quadraticCurveTo(x + width * 1.1, y + height * 0.7, x + width * 0.85, y + height * 0.5);
    this.ctx.quadraticCurveTo(x + width * 0.7, y + height * 0.3, x + width * 0.75, y + height * 0.15);
    this.ctx.quadraticCurveTo(x + width * 0.8, y + height * 0.05, x + width * 0.7, y);
    // Top (neck area)
    this.ctx.lineTo(x + width * 0.3, y);
    // Left side with curves
    this.ctx.quadraticCurveTo(x + width * 0.2, y + height * 0.05, x + width * 0.25, y + height * 0.15);
    this.ctx.quadraticCurveTo(x + width * 0.3, y + height * 0.3, x + width * 0.15, y + height * 0.5);
    this.ctx.quadraticCurveTo(x - width * 0.1, y + height * 0.7, x, y + height);
  }

  private renderBall() {
    this.ctx.save();

    // Render ball trail
    this.ball.trail.forEach((point, index) => {
      if (index > 0) {
        this.ctx.globalAlpha = point.alpha * 0.3;
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, this.ball.radius * (0.5 + point.alpha * 0.5), 0, 2 * Math.PI);
        this.ctx.fill();
      }
    });

    // Reset alpha for main ball
    this.ctx.globalAlpha = 1;

    // Ball shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x + 2, this.ball.y + 2, this.ball.radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Ball - different color if in gutter
    if (this.ball.inGutter) {
      // Gutter ball - slightly dimmed/different appearance
      this.ctx.fillStyle = '#1a1a1a'; // Darker than normal ball
    } else {
      // Normal ball
      this.ctx.fillStyle = '#000';
    }
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Ball highlight
    this.ctx.fillStyle = this.ball.inGutter ? '#333' : '#444';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x - 5, this.ball.y - 5, this.ball.radius * 0.3, 0, 2 * Math.PI);
    this.ctx.fill();

    // Finger holes
    this.ctx.fillStyle = '#222';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x - 3, this.ball.y, 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(this.ball.x + 3, this.ball.y, 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y + 5, 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.restore();
  }

  private createParticles(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x,
        y,
        velocityX: (Math.random() - 0.5) * 8,
        velocityY: (Math.random() - 0.5) * 8,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color: `hsl(${Math.random() * 60 + 15}, 80%, 60%)`, // Random warm colors
      });
    }
  }

  private updateParticles() {
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.velocityX *= 0.95;
      particle.velocityY *= 0.95;
      particle.life--;

      return particle.life > 0;
    });
  }

  private renderParticles() {
    this.particles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife;
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, 3, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private calculateScore() {
    this.score = this.pinsKnocked * 10;
    if (this.pinsKnocked === 10) {
      this.score += 20; // Strike bonus
    }
  }

  resetGame() {
    this.setupGame();
  }

  get gameStatus(): string {
    switch (this.gameState) {
      case 'ready':
        return 'Swipe to throw the ball!';
      case 'aiming':
        return 'Keep swiping...';
      case 'rolling':
        return 'Ball is rolling...';
      case 'finished':
        if (this.pinsKnocked === 10) {
          return '🎉 STRIKE! Auto-resetting in 2 seconds...';
        }
        return `${this.pinsKnocked}/10 pins down! Resetting in 2 seconds...`;
      default:
        return '';
    }
  }
}
