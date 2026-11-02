import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, computed, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonMenuButton, IonToolbar, IonButton, IonIcon, IonButtons, IonRange } from '@ionic/angular/standalone';

import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { refresh } from 'ionicons/icons';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { SETTINGS_KEYS } from 'src/app/core/services/storage/storage-keys';
import { minigameDelivery, stepMinigamePhysics } from 'src/app/core/utils/game-utils/minigame-physics.utils';
import {
  dailyMinigameLane,
  minigameFrameComplete,
  minigameRackSize,
  minigameScores,
  minigameThrowLabels,
} from 'src/app/core/utils/game-utils/minigame.utils';

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
  inGutter: boolean; // Track if ball is in the gutter
}

interface Arrow {
  x: number;
  y: number;
  direction: number; // Angle in radians
  visible: boolean;
}

interface SavedMinigame {
  date: string;
  frames: number[][];
  pins: Pin[];
  gutters: number;
}

@Component({
  selector: 'app-bowling-minigame',
  templateUrl: './minigame.page.html',
  styleUrls: ['./minigame.page.scss'],
  imports: [IonButtons, IonContent, IonHeader, IonTitle, IonMenuButton, IonToolbar, IonButton, IonIcon, IonRange],
})
export class MinigamePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly mode = signal<'daily' | 'practice'>('daily');
  readonly date = signal(new Date().toISOString().slice(0, 10));
  private readonly practiceDate = signal('2026-01-01');
  readonly lane = computed(() => dailyMinigameLane(this.mode() === 'daily' ? this.date() : this.practiceDate()));
  readonly frames = signal<number[][]>([[]]);
  readonly frameIndex = computed(() => this.frames().length - 1);
  readonly ballNumber = computed(() => this.frames().at(-1)!.length + 1);
  readonly scores = computed(() => minigameScores(this.frames()));
  readonly score = computed(
    () =>
      this.scores()
        .filter((score) => score !== null)
        .at(-1) ?? 0,
  );
  readonly gameState = signal<'ready' | 'aiming' | 'rolling' | 'settling' | 'complete'>('ready');
  readonly scorecard = computed(() =>
    Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      throws: minigameThrowLabels(this.frames()[index] ?? [], index),
      score: this.scores()[index],
      active: index === this.frameIndex() && this.gameState() !== 'complete',
    })),
  );
  readonly loading = signal(true);
  readonly canRoll = computed(() => !this.loading() && (this.gameState() === 'ready' || this.gameState() === 'aiming'));
  readonly canChangeMode = computed(() => !this.loading() && ['ready', 'complete'].includes(this.gameState()));
  readonly hook = signal(0);
  readonly hookLabel = computed(() => (this.hook() === 0 ? 'Straight' : `Hooks ${this.hook() < 0 ? 'left' : 'right'} ${Math.abs(this.hook())}`));
  readonly aim = signal(0);
  readonly power = signal(0);
  readonly gutters = signal(0);
  readonly storageError = signal(false);
  readonly status = signal('Drag to line up, then swipe up to roll.');
  pinsKnocked = 0;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationId = 0;
  private dailySave: SavedMinigame | null = null;
  private settleTicks = 0;
  private rollTicks = 0;
  private lastTick = 0;
  private accumulator = 0;
  private chargeStart = 0;
  private pointerId: number | null = null;
  private startBallX = 0;
  private swipeStart = 0;

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

  // Touch/mouse tracking
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private aimX = 0;
  private aimY = 0;

  constructor(
    private hapticService: HapticService,
    private storage: StorageRepository,
  ) {
    addIcons({ refresh });
  }

  async ngOnInit() {
    this.setupGame();
    try {
      const saved = await this.storage.get<SavedMinigame>(SETTINGS_KEYS.dailyMinigame);
      if (saved?.date === this.date()) {
        this.dailySave = saved;
        this.restoreDaily();
      }
    } catch (error) {
      this.storageError.set(true);
      console.warn('Unable to load daily bowling game.', error);
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewInit() {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Set canvas size
    this.canvas.width = this.LANE_WIDTH;
    this.canvas.height = this.LANE_HEIGHT;

    this.gameLoop();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  ionViewDidEnter() {
    if (this.canvas && !this.animationId) this.gameLoop();
  }

  ionViewWillLeave() {
    cancelAnimationFrame(this.animationId);
    this.animationId = 0;
    this.lastTick = 0;
    this.accumulator = 0;
    this.cancelGesture();
  }

  pointerStart(event: PointerEvent) {
    if (!this.canRoll() || this.pointerId !== null || event.button !== 0 || this.chargeStart) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
    this.pointerId = event.pointerId;
    const { x, y } = this.pointerPosition(event);
    this.startX = this.aimX = x;
    this.startY = this.aimY = y;
    this.startBallX = this.ball.x;
    this.swipeStart = performance.now();
    this.isDragging = true;
    this.gameState.set('aiming');
  }

  pointerMove(event: PointerEvent) {
    if (event.pointerId !== this.pointerId || !this.isDragging) return;
    const { x, y } = this.pointerPosition(event);
    this.aimX = x;
    this.aimY = y;
    // Horizontal dragging moves the starting position; an upward flick supplies the delivery angle.
    if (this.startY - y < 24 && Math.abs(x - this.startX) > Math.abs(y - this.startY)) {
      this.ball.x = Math.max(34, Math.min(this.LANE_WIDTH - 34, this.startBallX + x - this.startX));
      this.startX = x;
      this.startY = y;
      this.startBallX = this.ball.x;
      this.swipeStart = performance.now();
    }
  }

  pointerEnd(event: PointerEvent) {
    if (event.pointerId !== this.pointerId) return;
    this.pointerMove(event);
    const up = this.startY - this.aimY;
    const sideways = this.aimX - this.startX;
    const elapsed = Math.max(80, performance.now() - this.swipeStart);
    this.cancelGesture();
    if (up >= 24) this.roll(Math.min(1, up / elapsed), Math.max(-0.45, Math.min(0.45, sideways / up)));
  }

  cancelGesture() {
    if (this.pointerId !== null && this.canvas?.hasPointerCapture(this.pointerId)) this.canvas.releasePointerCapture(this.pointerId);
    this.pointerId = null;
    this.isDragging = false;
    this.chargeStart = 0;
    this.power.set(0);
    if (this.gameState() === 'aiming') this.gameState.set('ready');
  }

  keyDown(event: KeyboardEvent) {
    if (!this.canRoll()) return;
    if (!['ArrowLeft', 'ArrowRight', 'a', 'd', '[', ']', ' '].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') this.ball.x = Math.max(34, this.ball.x - 6);
    if (event.key === 'ArrowRight') this.ball.x = Math.min(this.LANE_WIDTH - 34, this.ball.x + 6);
    if (event.key === 'a') this.aim.update((aim) => Math.max(-0.3, aim - 0.025));
    if (event.key === 'd') this.aim.update((aim) => Math.min(0.3, aim + 0.025));
    if (event.key === '[') this.hook.update((hook) => Math.max(-5, hook - 1));
    if (event.key === ']') this.hook.update((hook) => Math.min(5, hook + 1));
    if (event.key === ' ' && !event.repeat && !this.chargeStart) this.chargeStart = performance.now();
  }

  keyUp(event: KeyboardEvent) {
    if (event.key !== ' ' || !this.chargeStart) return;
    event.preventDefault();
    const power = this.power();
    this.chargeStart = 0;
    this.roll(power);
  }

  roll(power = 0.65, angle = this.aim()) {
    if (!this.canRoll()) return;
    this.cancelGesture();
    Object.assign(this.ball, minigameDelivery(power, angle, this.hook()));
    this.ball.spinning = this.hook() !== 0;
    this.gameState.set('rolling');
    this.status.set('Rolling…');
    this.rollTicks = 0;
    this.hapticService.vibrate(ImpactStyle.Medium);
  }

  selectMode(mode: 'daily' | 'practice') {
    if (!this.canChangeMode() || mode === this.mode()) return;
    this.cancelGesture();
    this.mode.set(mode);
    if (mode === 'daily') {
      this.date.set(new Date().toISOString().slice(0, 10));
      if (this.dailySave?.date !== this.date()) this.dailySave = null;
    }
    this.setupGame();
    if (mode === 'daily') this.restoreDaily();
  }

  resetGame() {
    if (this.mode() !== 'practice' || !this.canChangeMode()) return;
    this.practiceDate.update((date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10));
    this.setupGame();
  }

  private setupGame() {
    this.setupPins();
    this.setupArrows();
    this.resetBall();
    this.particles = [];
    this.pinsKnocked = 0;
    this.frames.set([[]]);
    this.gutters.set(0);
    this.gameState.set('ready');
    this.status.set('Drag to line up, then swipe up to roll.');
    this.chargeStart = 0;
    this.power.set(0);
  }

  private setupPins() {
    this.pins = [];
    const pinPositions = [
      // Evenly spaced bowling pin formation - maximum even spacing for both X and Y
      [62, 32],
      [114, 32],
      [166, 32],
      [218, 32],
      [88, 64],
      [140, 64],
      [192, 64],
      [114, 96],
      [166, 96],
      [140, 128],
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
      inGutter: false,
    };
  }

  private pointerPosition(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * this.LANE_WIDTH, y: ((event.clientY - rect.top) / rect.height) * this.LANE_HEIGHT };
  }

  private gameLoop(timestamp = performance.now()) {
    // Fixed physics steps make identical shots behave alike on 60/120 Hz screens.
    this.accumulator += Math.min(timestamp - (this.lastTick || timestamp), 100);
    this.lastTick = timestamp;
    while (this.accumulator >= 1000 / 60) {
      this.update();
      this.accumulator -= 1000 / 60;
    }
    if (this.chargeStart) this.power.set(Math.min(1, (performance.now() - this.chargeStart) / 1000));
    this.render();
    this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  private update() {
    if (this.gameState() === 'rolling') {
      this.stepPhysics(true);
      this.updateParticles();
      if (this.ball.y < -60 || ++this.rollTicks > 420) {
        this.gameState.set('settling');
        this.settleTicks = 90;
      }
    } else if (this.gameState() === 'settling') {
      this.stepPhysics(false);
      this.updateParticles();
      if (--this.settleTicks <= 0) this.finishShot();
    }
  }

  private stepPhysics(includeBall: boolean) {
    const wasInGutter = this.ball.inGutter;
    const knocked = stepMinigamePhysics(includeBall ? this.ball : null, this.pins, this.lane());
    this.pinsKnocked += knocked.length;
    knocked.forEach((pin) => this.createParticles(pin.x, pin.y));
    if (knocked.length) this.hapticService.vibrate(ImpactStyle.Light);
    if (!wasInGutter && this.ball.inGutter) this.hapticService.vibrate(ImpactStyle.Medium);
    if (!includeBall) return;
    this.ball.trail.push({ x: this.ball.x, y: this.ball.y, alpha: 1 });
    if (this.ball.trail.length > 12) this.ball.trail.shift();
    this.ball.trail.forEach((point, index) => (point.alpha = index / this.ball.trail.length));
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
    this.ctx.fillStyle = '#d5ae72';
    this.ctx.fillRect(0, 0, this.LANE_WIDTH, this.LANE_HEIGHT);

    // Lane wood texture (39 vertical lines) - adjusted spacing for smaller lane
    this.ctx.strokeStyle = 'rgba(100, 65, 30, 0.2)';
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
    const oilEnd = this.LANE_HEIGHT - 50 - (this.lane().oilLength / 60) * 420;
    const oil = this.ctx.createLinearGradient(0, oilEnd, 0, this.LANE_HEIGHT - 70);
    oil.addColorStop(0, 'rgba(120, 185, 210, 0.02)');
    oil.addColorStop(1, 'rgba(120, 185, 210, 0.24)');
    this.ctx.fillStyle = oil;
    this.ctx.fillRect(18, oilEnd, this.LANE_WIDTH - 36, this.LANE_HEIGHT - 70 - oilEnd);
    this.ctx.strokeStyle = 'rgba(80, 45, 20, 0.5)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(18, this.LANE_HEIGHT - 85);
    this.ctx.lineTo(this.LANE_WIDTH - 18, this.LANE_HEIGHT - 85);
    this.ctx.stroke();
    if (this.canRoll()) {
      this.ctx.save();
      this.ctx.setLineDash([6, 8]);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      const preview = { ...this.ball, ...minigameDelivery(this.chargeStart ? this.power() : 0.65, this.aim(), this.hook()) };
      this.ctx.moveTo(preview.x, preview.y);
      for (let tick = 0; tick < 80 && preview.y > 160 && !preview.inGutter; tick++) {
        stepMinigamePhysics(preview, [], this.lane());
        this.ctx.lineTo(preview.x, preview.y);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }
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
      const gradient = this.ctx.createRadialGradient(this.ball.x - 8, this.ball.y - 8, 2, this.ball.x, this.ball.y, this.ball.radius);
      gradient.addColorStop(0, '#9d8bd4');
      gradient.addColorStop(1, '#312350');
      this.ctx.fillStyle = gradient;
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

  private finishShot() {
    const index = this.frameIndex();
    const frame = [...this.frames()[index], this.pinsKnocked];
    const complete = minigameFrameComplete(frame, index);
    const frames = this.frames().map((previous, i) => (i === index ? frame : previous));
    const label = minigameThrowLabels(frame, index).at(-1);
    const gutter = this.ball.inGutter && this.pinsKnocked === 0;
    this.status.set(
      gutter
        ? 'Gutter ball. Adjust your line and try again.'
        : label === 'X'
          ? 'Strike! Beautiful shot.'
          : label === '/'
            ? 'Spare! Nicely picked up.'
            : `${this.pinsKnocked} pins down. Find your line.`,
    );
    if (gutter) this.gutters.update((count) => count + 1);
    if (complete && index < 9) frames.push([]);
    this.frames.set(frames);
    if (minigameRackSize(frame, index) === 10) this.setupPins();
    else this.pins = this.pins.filter((pin) => !pin.fallen);
    this.particles = [];
    this.pinsKnocked = 0;
    this.resetBall();
    this.gameState.set(complete && index === 9 ? 'complete' : 'ready');
    if (this.gameState() === 'complete') this.status.set(`Game complete! You scored ${this.score()}.`);
    if (this.mode() === 'daily') {
      this.dailySave = { date: this.date(), frames, pins: structuredClone(this.pins), gutters: this.gutters() };
      void this.storage.set(SETTINGS_KEYS.dailyMinigame, this.dailySave).catch((error: unknown) => {
        this.storageError.set(true);
        console.warn('Unable to save daily bowling game.', error);
      });
    }
  }

  private restoreDaily() {
    if (!this.dailySave) return;
    this.frames.set(structuredClone(this.dailySave.frames));
    this.pins = structuredClone(this.dailySave.pins);
    this.gutters.set(this.dailySave.gutters);
    const complete = this.frameIndex() === 9 && minigameFrameComplete(this.frames()[9], 9);
    this.gameState.set(complete ? 'complete' : 'ready');
    this.status.set(complete ? `Game complete! You scored ${this.score()}.` : 'Daily game resumed. Find your line.');
  }
}
