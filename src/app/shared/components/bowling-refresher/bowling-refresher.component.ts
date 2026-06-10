import { Component, HostBinding, input } from '@angular/core';

interface Pin {
  x: number;
  y: number;
  fx: number;
  fy: number;
  r: number;
}

@Component({
  selector: 'app-bowling-refresher',
  standalone: true,
  imports: [],
  host: {
    '[class.refreshing]': 'refreshing()',
    '[class.align-middle]': "align() === 'middle'",
  },
  template: `
    <div class="frame">
      <div class="stage">
        <div class="lane"></div>

        <div class="pins">
          @for (p of pins; track $index) {
            <div
              class="pin"
              [style.left]="p.x - 15 + 'px'"
              [style.top]="p.y - 32 + 'px'"
              [style.--fx]="p.fx + 'px'"
              [style.--fy]="p.fy + 'px'"
              [style.--r]="p.r + 'deg'">
              <svg viewBox="0 0 28 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M14 3.5C17 3.5 19.3 5.8 19.3 8.7C19.3 10.4 18.6 11.8 17.4 12.9
                   C19.1 14.4 20.2 16.5 20.2 18.9C20.2 20.8 19.4 22.5 18.2 23.7
                   C20.7 26.3 22.3 30.8 22.3 37.5C22.3 47.5 18.6 55.5 14 55.5
                   C9.4 55.5 5.7 47.5 5.7 37.5C5.7 30.8 7.3 26.3 9.8 23.7
                   C8.6 22.5 7.8 20.8 7.8 18.9C7.8 16.5 8.9 14.4 10.6 12.9
                   C9.4 11.8 8.7 10.4 8.7 8.7C8.7 5.8 11 3.5 14 3.5Z"
                  fill="#0d1217"
                  stroke="#f4f1ea"
                  stroke-width="2.6"
                  stroke-linejoin="round" />
                <path d="M9.2 16.8C11 17.9 17 17.9 18.8 16.8" stroke="#e8453c" stroke-width="4" stroke-linecap="round" />
                <path d="M8.4 21.6C10.6 22.8 17.4 22.8 19.6 21.6" stroke="#e8453c" stroke-width="2.6" stroke-linecap="round" />
              </svg>
            </div>
          }
        </div>

        <svg class="burst" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#5cc6f2" stroke-width="5" stroke-linecap="round">
            <line x1="60" y1="60" x2="60" y2="20" />
            <line x1="60" y1="60" x2="92" y2="28" />
            <line x1="60" y1="60" x2="100" y2="60" />
            <line x1="60" y1="60" x2="92" y2="92" />
            <line x1="60" y1="60" x2="60" y2="100" />
            <line x1="60" y1="60" x2="28" y2="92" />
            <line x1="60" y1="60" x2="20" y2="60" />
            <line x1="60" y1="60" x2="28" y2="28" />
          </g>
          <g stroke="#f4f1ea" stroke-width="3.5" stroke-linecap="round" opacity=".9">
            <line x1="60" y1="60" x2="76" y2="44" />
            <line x1="60" y1="60" x2="44" y2="44" />
            <line x1="60" y1="60" x2="76" y2="76" />
            <line x1="60" y1="60" x2="44" y2="76" />
          </g>
        </svg>

        <div class="ball-wrap">
          <svg class="ball" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="36" cy="36" r="31" fill="#0d1217" stroke="#5cc6f2" stroke-width="5" />
            <circle cx="30" cy="26" r="3.4" fill="#5cc6f2" />
            <circle cx="42" cy="28" r="3.4" fill="#5cc6f2" />
            <circle cx="35" cy="38" r="3.8" fill="#5cc6f2" />
          </svg>
          <div class="speed"><i></i><i></i><i></i></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        --bowl-scale: 0.2;
        --frame-w: 100%;
        --frame-h: calc(650px * var(--bowl-scale));
        --dur: 2.6s;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
        padding-top: 6px;
        background: var(--ion-card-background);
      }
      .frame {
        position: relative;
        width: var(--frame-w);
        height: var(--frame-h);
        overflow: hidden;
      }
      .stage {
        position: absolute;
        left: calc((var(--frame-w) - 560px * var(--bowl-scale)) / 2);
        top: 0;
        width: 560px;
        height: 240px;
        transform: scale(var(--bowl-scale));
        transform-origin: top left;
      }
      :host(.align-middle) .stage {
        top: calc((var(--frame-h) - 240px * var(--bowl-scale)) / 2);
      }
      .lane {
        position: absolute;
        left: 30px;
        right: 40px;
        top: 50%;
        height: 0;
        border-top: 3px dashed rgba(244, 241, 234, 0.16);
        -webkit-mask: linear-gradient(90deg, transparent 1%, #000 12%);
        mask: linear-gradient(90deg, transparent 1%, #000 12%);
      }
      .pins {
        position: absolute;
        left: 60px;
        top: 0;
        width: 180px;
        height: 240px;
      }
      .pin {
        position: absolute;
        width: 30px;
        height: 64px;
        transform-origin: 50% 78%;
      }
      .pin svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .ball-wrap {
        position: absolute;
        left: 222px;
        top: 84px;
        width: 72px;
        height: 72px;
        opacity: 0;
      }
      .ball {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }

      .speed {
        position: absolute;
        left: 78px;
        top: 14px;
        width: 60px;
        height: 44px;
        opacity: 0;
      }
      .speed i {
        position: absolute;
        height: 4px;
        border-radius: 2px;
        background: #5cc6f2;
        right: 0;
      }
      .speed i:nth-child(1) {
        top: 6px;
        width: 46px;
        opacity: 0.9;
      }
      .speed i:nth-child(2) {
        top: 20px;
        width: 62px;
      }
      .speed i:nth-child(3) {
        top: 34px;
        width: 38px;
        opacity: 0.8;
      }

      .burst {
        position: absolute;
        left: 188px;
        top: 120px;
        width: 120px;
        height: 120px;
        transform: translate(-50%, -50%) scale(0.2);
        transform-origin: 50% 50%;
        opacity: 0;
        pointer-events: none;
      }

      :host(.refreshing) .pin {
        animation: bowlPinFly var(--dur) cubic-bezier(0.3, 0.55, 0.4, 1) both infinite running;
      }
      :host(.refreshing) .ball-wrap {
        animation: bowlBallMove var(--dur) cubic-bezier(0.42, 0.04, 0.5, 0.96) both infinite running;
      }
      :host(.refreshing) .ball {
        animation: bowlBallSpin var(--dur) cubic-bezier(0.42, 0.04, 0.5, 0.96) both infinite running;
      }
      :host(.refreshing) .speed {
        animation: bowlSpeed var(--dur) ease-in-out both infinite running;
      }
      :host(.refreshing) .burst {
        animation: bowlBurst var(--dur) ease-out both infinite running;
      }

      @keyframes bowlPinFly {
        0%,
        85% {
          transform: translate(0, 0) rotate(0);
          opacity: 1;
        }
        91% {
          transform: translate(var(--fx), var(--fy)) rotate(var(--r));
          opacity: 1;
        }
        94% {
          transform: translate(calc(var(--fx) * 1.25), calc(var(--fy) * 1.25)) rotate(var(--r));
          opacity: 0;
        }
        94.01%,
        97% {
          transform: translate(calc(var(--fx) * 1.25), calc(var(--fy) * 1.25)) rotate(var(--r));
          opacity: 0;
        }
        98% {
          transform: translate(0, 0) rotate(0);
          opacity: 0;
        }
        100% {
          transform: translate(0, 0) rotate(0);
          opacity: 1;
        }
      }
      @keyframes bowlBallMove {
        0% {
          transform: translateX(340px);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        85% {
          transform: translateX(0);
          opacity: 1;
        }
        89% {
          transform: translateX(-26px);
          opacity: 1;
        }
        93% {
          transform: translateX(-66px);
          opacity: 1;
        }
        96% {
          transform: translateX(-104px);
          opacity: 0;
        }
        96.01%,
        98% {
          transform: translateX(-104px);
          opacity: 0;
        }
        99%,
        100% {
          transform: translateX(340px);
          opacity: 0;
        }
      }
      @keyframes bowlBallSpin {
        0% {
          rotate: 0deg;
        }
        85% {
          rotate: 760deg;
        }
        96% {
          rotate: 1080deg;
        }
        98% {
          rotate: 1080deg;
        }
        99%,
        100% {
          rotate: 0deg;
        }
      }
      @keyframes bowlSpeed {
        0% {
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        82% {
          opacity: 1;
        }
        87% {
          opacity: 0;
        }
        100% {
          opacity: 0;
        }
      }
      @keyframes bowlBurst {
        0%,
        84% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.2) rotate(0);
        }
        88% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(0.85) rotate(8deg);
        }
        94% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(1.35) rotate(14deg);
        }
        100% {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host(.refreshing) .pin,
        :host(.refreshing) .ball-wrap,
        :host(.refreshing) .ball,
        :host(.refreshing) .speed,
        :host(.refreshing) .burst {
          animation: none;
        }
      }
    `,
  ],
})
export class BowlingRefresherComponent {
  size = input<number>(0.2);
  background = input<string>('var(--background-color)');
  refreshing = input<boolean>(false);
  align = input<'top' | 'middle'>('top');

  @HostBinding('style.--bowl-scale') get bowlScaleVar(): number {
    return this.size();
  }

  @HostBinding('style.background') get backgroundVar(): string {
    return this.background();
  }

  pins: Pin[] = [
    { x: 150, y: 120, fx: -200, fy: -18, r: -240 },
    { x: 112, y: 120 - 34, fx: -150, fy: -95, r: -280 },
    { x: 112, y: 120 + 34, fx: -150, fy: 95, r: 260 },
    { x: 74, y: 120 - 61, fx: -120, fy: -150, r: -320 },
    { x: 74, y: 120, fx: -215, fy: 5, r: 200 },
    { x: 74, y: 120 + 61, fx: -120, fy: 150, r: 320 },
    { x: 36, y: 120 - 85, fx: -95, fy: -185, r: -360 },
    { x: 36, y: 120 - 29, fx: -110, fy: -70, r: -220 },
    { x: 36, y: 120 + 29, fx: -110, fy: 70, r: 230 },
    { x: 36, y: 120 + 85, fx: -95, fy: 185, r: 360 },
  ];
}
