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

  // Realistic physics constants
  private readonly GRAVITY = 0.35; // Realistic gravity for pin falling
  private readonly LANE_FRICTION = 0.985; // Realistic lane friction (wood surface)
  private readonly PIN_FRICTION = 0.95; // Pin-to-surface friction
  private readonly AIR_RESISTANCE = 0.998; // Minimal air resistance on ball
  private readonly CURVE_FORCE = 0.15; // Realistic hook potential

  // Realistic masses (for momentum calculations)
  private readonly BALL_MASS = 16; // Standard 16 lb bowling ball
  private readonly PIN_MASS = 3.6; // Standard pin weight (3 lbs 6 oz)

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

    // Realistic ball speed mapping - typical bowling ball travels 15-22 mph
    const speedMultiplier = 0.07; // Adjusted for realistic ball speed

    // Direct mapping of finger movement to ball velocity
    this.ball.velocityX = deltaX * speedMultiplier;
    this.ball.velocityY = deltaY * speedMultiplier;

    // Ensure realistic minimum forward speed (simulating a proper release)
    if (Math.abs(this.ball.velocityY) < 1.2) {
      this.ball.velocityY = -1.2; // Minimum forward momentum
    }

    // Realistic curve/hook mechanics - simulate rev rate and axis rotation
    let curveAmount = 0;

    if (totalDistance > 30) {
      // Require meaningful gesture length for hook
      const minHorizontalMovement = 20;
      const verticalComponent = Math.abs(deltaY);

      // Hook requires both lateral movement and forward motion (like real bowling release)
      if (Math.abs(deltaX) > minHorizontalMovement && verticalComponent > Math.abs(deltaX) * 0.5) {
        // Calculate hook based on release angle - more realistic
        const releaseAngle = Math.abs(deltaX) / verticalComponent;
        const curveSensitivity = 0.022; // Realistic hook sensitivity
        curveAmount = deltaX * curveSensitivity * (1 + releaseAngle * 0.3);
      }
    }

    this.ball.curve = curveAmount;
    this.ball.spinning = Math.abs(curveAmount) > 0.015; // Realistic spin threshold

    // Reset distance and state for new throw
    this.ball.distanceTraveled = 0;
    this.ball.inGutter = false;
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

      // Check if ball has passed the pins or stopped moving
      if (
        this.ball.y < -100 ||
        this.ball.y > this.LANE_HEIGHT + 50 ||
        (Math.abs(this.ball.velocityX) < 0.02 && Math.abs(this.ball.velocityY) < 0.02)
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
      if (this.ball.trail.length > 20) {
        this.ball.trail.shift();
      }

      // Fade trail
      this.ball.trail.forEach((point, index) => {
        point.alpha = index / this.ball.trail.length;
      });
    }

    // Realistic hook physics - ball hooks in the backend (after oil transition)
    // Oil pattern simulation: front part has less friction (oil), backend has more friction
    const oilTransitionDistance = 100; // Simulates oil pattern transition point

    if (this.ball.spinning && this.ball.distanceTraveled > this.ball.curveStartDistance) {
      // Calculate how far into the backend we are
      const backendDistance = this.ball.distanceTraveled - oilTransitionDistance;

      if (backendDistance > 0) {
        // In the backend (dry part) - hook intensifies
        const hookProgress = Math.min(backendDistance / 120, 1.0);

        // Hook strength depends on ball speed (slower = more hook, like real bowling)
        const speedFactor = Math.max(0.4, 1.0 - speed / 8.0); // Slower balls hook more

        // Rev rate simulation - spinning creates hook
        const revRateEffect = Math.abs(this.ball.curve) * 1.2;

        // Apply hook force (negative for proper direction)
        const hookForce = -this.ball.curve * this.CURVE_FORCE * hookProgress * speedFactor * revRateEffect;
        this.ball.velocityX += hookForce;
      }
    }

    // Update position
    this.ball.x += this.ball.velocityX;
    this.ball.y += this.ball.velocityY;

    // Realistic friction and air resistance
    this.ball.velocityX *= this.LANE_FRICTION; // Lane friction affects lateral movement
    this.ball.velocityY *= this.AIR_RESISTANCE; // Minimal air resistance on forward motion

    // Realistic lane behavior - lateral friction is higher than forward
    this.ball.velocityX *= 0.99; // Additional lateral friction

    // Rev rate decay (spin gradually decreases)
    if (this.ball.spinning) {
      this.ball.curve *= 0.997; // Gradual rev rate decay
    }

    // Gutter mechanics - realistic bowling lane behavior
    const gutterWidth = 18;
    const gutterBoundaryLeft = gutterWidth + this.ball.radius / 2;
    const gutterBoundaryRight = this.LANE_WIDTH - gutterWidth - this.ball.radius / 2;

    if (!this.ball.inGutter) {
      // Check if ball is entering gutter
      if (this.ball.x < gutterBoundaryLeft || this.ball.x > gutterBoundaryRight) {
        this.ball.inGutter = true;
        this.hapticService.vibrate(ImpactStyle.Medium);

        // Position ball in center of gutter
        if (this.ball.x < gutterBoundaryLeft) {
          this.ball.x = gutterWidth / 2;
        } else {
          this.ball.x = this.LANE_WIDTH - gutterWidth / 2;
        }

        // Realistic gutter entry - significant energy loss
        this.ball.velocityX *= 0.25;
        this.ball.velocityY *= 0.85; // Some forward momentum loss
        this.ball.curve = 0;
        this.ball.spinning = false;
      }
    } else {
      // Ball is in gutter - constrain and minimal movement
      if (this.ball.x < gutterWidth / 2) {
        this.ball.x = gutterWidth / 2;
      } else if (this.ball.x > this.LANE_WIDTH - gutterWidth / 2) {
        this.ball.x = this.LANE_WIDTH - gutterWidth / 2;
      }

      // Gutter friction
      this.ball.velocityX *= 0.93;
    }
  }

  private updatePins() {
    this.pins.forEach((pin, index) => {
      if (pin.fallen) {
        // Apply physics to fallen pins - they fly/tumble based on impact
        pin.x += pin.velocityX;
        pin.y += pin.velocityY;

        // Check for collisions with other pins during movement
        this.checkMovingPinCollisions(pin, index);

        // Realistic pin friction - wood on wood, pins slow down in all directions
        pin.velocityX *= this.PIN_FRICTION;
        pin.velocityY *= this.PIN_FRICTION;

        // Realistic falling animation - angular velocity based on linear velocity
        if (pin.fallingAngle < Math.PI / 1.8) {
          const angularMomentum = Math.sqrt(pin.velocityX * pin.velocityX + pin.velocityY * pin.velocityY);
          // Falling speed related to momentum
          pin.fallingAngle += 0.08 + angularMomentum * 0.025;
        }

        // Boundary constraints - pins bounce off lane edges and stay in pin deck area
        const gutterWidth = 18;
        const minX = gutterWidth;
        const maxX = this.LANE_WIDTH - gutterWidth;

        if (pin.x < minX) {
          pin.x = minX;
          pin.velocityX = Math.abs(pin.velocityX) * 0.3; // Bounce off left edge
        }
        if (pin.x > maxX) {
          pin.x = maxX;
          pin.velocityX = -Math.abs(pin.velocityX) * 0.3; // Bounce off right edge
        }

        // Keep pins in the pin deck area (top part of lane)
        // Pins fly around but don't go past the foul line
        if (pin.y < -20) {
          pin.y = -20;
          pin.velocityY = Math.abs(pin.velocityY) * 0.2; // Bounce back from back wall
        }
        if (pin.y > 200) {
          pin.y = 200;
          pin.velocityY = -Math.abs(pin.velocityY) * 0.2; // Bounce back toward pin area
        }

        // Stop nearly motionless pins
        if (Math.abs(pin.velocityX) < 0.05 && Math.abs(pin.velocityY) < 0.05) {
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
      const collisionDistance = this.PIN_WIDTH + 3;

      if (distance < collisionDistance && distance > 0) {
        // Collision detected!
        const movingSpeed = Math.sqrt(movingPin.velocityX * movingPin.velocityX + movingPin.velocityY * movingPin.velocityY);

        if (!otherPin.fallen && movingSpeed > 0.7) {
          // Moving pin knocks down standing pin
          otherPin.fallen = true;

          // Realistic collision physics with scatter
          const collisionAngle = Math.atan2(dy, dx);
          const momentumTransfer = movingSpeed * 0.75; // Increased for better pin action

          otherPin.velocityX = Math.cos(collisionAngle) * momentumTransfer + movingPin.velocityX * 0.4;
          otherPin.velocityY = Math.sin(collisionAngle) * momentumTransfer + movingPin.velocityY * 0.4;

          // Add scatter for realistic pin action
          const scatter = movingSpeed * 0.15;
          otherPin.velocityX += (Math.random() - 0.5) * scatter;
          otherPin.velocityY += (Math.random() - 0.5) * scatter;

          // Energy loss in collision
          movingPin.velocityX *= 0.65;
          movingPin.velocityY *= 0.65;

          this.pinsKnocked++;
          this.hapticService.vibrate(ImpactStyle.Light);
          this.createParticles(otherPin.x, otherPin.y);
        } else if (otherPin.fallen) {
          // Both pins fallen - elastic collision with scatter
          const overlap = collisionDistance - distance;
          if (overlap > 0) {
            const separationX = (dx / distance) * overlap * 0.5;
            const separationY = (dy / distance) * overlap * 0.5;

            // Separate pins
            movingPin.x -= separationX;
            movingPin.y -= separationY;
            otherPin.x += separationX;
            otherPin.y += separationY;

            // Realistic elastic collision - exchange momentum with variation
            const tempVelX = movingPin.velocityX * 0.4;
            const tempVelY = movingPin.velocityY * 0.4;
            movingPin.velocityX += otherPin.velocityX * 0.3 - tempVelX;
            movingPin.velocityY += otherPin.velocityY * 0.3 - tempVelY;
            otherPin.velocityX += tempVelX;
            otherPin.velocityY += tempVelY;
          }
        } else {
          // Insufficient speed - just prevent overlap
          const pushBackX = (dx / distance) * (collisionDistance - distance) * 0.5;
          const pushBackY = (dy / distance) * (collisionDistance - distance) * 0.5;
          movingPin.x -= pushBackX;
          movingPin.y -= pushBackY;

          // Friction effect
          movingPin.velocityX *= 0.75;
          movingPin.velocityY *= 0.75;
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

    // Calculate ball's momentum using realistic mass
    const ballSpeed = Math.sqrt(this.ball.velocityX * this.ball.velocityX + this.ball.velocityY * this.ball.velocityY);

    // Calculate impact angle (angle from pin to ball)
    const impactAngle = Math.atan2(-dy, -dx);

    // Realistic momentum transfer using conservation of momentum
    // Pins fly dramatically when hit by heavy ball
    const momentumRatio = this.BALL_MASS / (this.BALL_MASS + this.PIN_MASS);
    const energyTransfer = ballSpeed * momentumRatio * 0.85; // 85% efficiency - pins fly with force

    // Pin velocity based on impact angle and realistic physics
    const directionFactor = 0.9; // Strong directional impact
    pin.velocityX = Math.cos(impactAngle) * energyTransfer * directionFactor + this.ball.velocityX * 0.4;
    pin.velocityY = Math.sin(impactAngle) * energyTransfer * directionFactor + this.ball.velocityY * 0.4;

    // Add realistic scatter effect - pins fly in various directions
    const scatterAmount = ballSpeed * 0.25; // Increased scatter for dramatic pin action
    pin.velocityX += (Math.random() - 0.5) * scatterAmount;
    pin.velocityY += (Math.random() - 0.5) * scatterAmount;

    // Realistic ball deflection using conservation of momentum
    const deflectionRatio = this.PIN_MASS / (this.BALL_MASS + this.PIN_MASS);
    const normalX = dx / distance;
    const normalY = dy / distance;

    // Ball deflects based on mass ratio and impact
    this.ball.velocityX += normalX * ballSpeed * deflectionRatio * 0.4;
    this.ball.velocityY += normalY * ballSpeed * deflectionRatio * 0.4;

    // Ball maintains most momentum through the pins (realistic carry)
    this.ball.velocityX *= 0.9; // 10% energy loss
    this.ball.velocityY *= 0.93; // Less forward energy loss

    // Hook continues after pin impact (reduced but not eliminated)
    this.ball.curve *= 0.92;

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

      // Realistic pin knock-down threshold
      if (movingPinSpeed > 1.0) {
        standingPin.fallen = true;

        // Calculate collision angle
        const collisionAngle = Math.atan2(dy, dx);

        // Realistic momentum transfer - pins scatter when hit
        const momentumTransfer = movingPinSpeed * 0.75; // 75% transfer for dramatic pin action
        standingPin.velocityX = Math.cos(collisionAngle) * momentumTransfer;
        standingPin.velocityY = Math.sin(collisionAngle) * momentumTransfer;

        // Add component of moving pin's velocity for realistic scatter
        standingPin.velocityX += movingPin.velocityX * 0.4;
        standingPin.velocityY += movingPin.velocityY * 0.4;

        // Add scatter variation
        const pinScatter = movingPinSpeed * 0.15;
        standingPin.velocityX += (Math.random() - 0.5) * pinScatter;
        standingPin.velocityY += (Math.random() - 0.5) * pinScatter;

        // Moving pin loses energy in collision
        movingPin.velocityX *= 0.65;
        movingPin.velocityY *= 0.65;

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
    // Create more realistic pin impact particles
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;

      this.particles.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        life: 35 + Math.random() * 25,
        maxLife: 60,
        color: `hsl(${Math.random() * 40 + 10}, 75%, 65%)`, // Warm colors for wood impact
      });
    }
  }

  private updateParticles() {
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;

      // Realistic particle physics - gravity and air resistance
      particle.velocityX *= 0.96; // Air resistance
      particle.velocityY *= 0.96;
      particle.velocityY += 0.15; // Gravity pulls particles down

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
