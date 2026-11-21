import { NormalizedPoint } from 'src/app/core/models/shot-analysis.model';

import { Cv, loadOpenCv } from '../video/opencv.utils';
import { findLaneCorners } from './lane-detection.utils';

const W = 1080;
const H = 1920;
const VP: [number, number] = [600, 800];
const FOUL_Y = 1500;
/** Where the head pin stands on the bowler's lane. */
const HEAD_PIN_Y = 900;
/** Where the edges cross the foul line, left to right: the bowler's lane with its gutters, and the next lanes. */
const EDGES = { nextRight: 40, gutterLeftOuter: 250, laneLeft: 300, laneRight: 700, gutterRightOuter: 750, nextLeft: 960 };

const xAt = (footX: number, y: number) => VP[0] + ((footX - VP[0]) * (y - VP[1])) / (FOUL_Y - VP[1]);

/**
 * A lane seen from behind the bowler: bright wood between dark gutters, capping and the next lanes beside,
 * the approach below the foul line, and pins on the lane mirrored in its oil.
 */
function drawAlley(pins: 'reflected' | 'dry' | 'none' = 'reflected'): ImageData {
  const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = 'rgb(90, 90, 100)';
  ctx.fillRect(0, 0, W, H);
  const band = (fromX: number, toX: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(VP[0], VP[1]);
    ctx.lineTo(xAt(fromX, FOUL_Y), FOUL_Y);
    ctx.lineTo(xAt(toX, FOUL_Y), FOUL_Y);
    ctx.closePath();
    ctx.fill();
  };
  band(EDGES.nextRight - 300, EDGES.nextRight, 'rgb(205, 190, 160)');
  band(EDGES.nextRight, EDGES.gutterLeftOuter, 'rgb(130, 130, 135)');
  band(EDGES.gutterLeftOuter, EDGES.laneLeft, 'rgb(35, 35, 40)');
  band(EDGES.laneLeft, EDGES.laneRight, 'rgb(210, 195, 165)');
  band(EDGES.laneRight, EDGES.gutterRightOuter, 'rgb(35, 35, 40)');
  band(EDGES.gutterRightOuter, EDGES.nextLeft, 'rgb(130, 130, 135)');
  band(EDGES.nextLeft, EDGES.nextLeft + 300, 'rgb(205, 190, 160)');
  ctx.fillStyle = 'rgb(190, 175, 150)';
  ctx.fillRect(0, FOUL_Y, W, H - FOUL_Y);
  ctx.fillStyle = 'rgb(40, 30, 60)';
  ctx.fillRect(0, 0, W, VP[1] + 40);
  if (pins !== 'none') {
    // pin-shaped: head, neck, belly and foot, from the top; mirrored below its base in the oil, dimmer
    const SHAPE: [number, number][] = [
      [4, 4],
      [2, 3],
      [7, 8],
      [5, 3],
    ];
    const pin = (x: number, base: number) => {
      let y = base - SHAPE.reduce((sum, [, rows]) => sum + rows, 0);
      for (const [width, rows] of SHAPE) {
        ctx.fillStyle = 'rgb(250, 250, 248)';
        ctx.fillRect(x - width / 2, y, width, rows);
        if (pins === 'reflected') {
          ctx.fillStyle = 'rgb(242, 242, 240)';
          ctx.fillRect(x - width / 2, 2 * base - y - rows, width, rows);
        }
        y += rows;
      }
    };
    const middle = (xAt(EDGES.laneLeft, HEAD_PIN_Y) + xAt(EDGES.laneRight, HEAD_PIN_Y)) / 2;
    // the rows behind the head pin stand a pixel or two higher up in the picture (3 ft further at 60 ft)
    for (const [dx, lift] of [
      [-16, 2],
      [16, 2],
      [-8, 1],
      [8, 1],
    ]) {
      pin(middle + dx, HEAD_PIN_Y - lift);
    }
    pin(middle, HEAD_PIN_Y);
  }
  return ctx.getImageData(0, 0, W, H);
}

describe('lane-detection.utils', () => {
  let cv: Cv;

  const find = (image: ImageData) => {
    const rgba = cv.matFromImageData(image);
    try {
      return findLaneCorners(cv, rgba);
    } finally {
      rgba.delete();
    }
  };
  const expectNear = ([x, y]: NormalizedPoint, [ex, ey]: [number, number], tolerancePx: number) => {
    expect(Math.abs(x * W - ex)).toBeLessThan(tolerancePx);
    expect(Math.abs(y * H - ey)).toBeLessThan(tolerancePx);
  };

  beforeAll(async () => {
    cv = await loadOpenCv();
  }, 60_000);

  it("finds the bowler's lane: its edges, the foul line and the head pin", () => {
    const corners = find(drawAlley());

    expect(corners).not.toBeNull();
    const [foulLeft, foulRight, farLeft, farRight] = corners!;
    expectNear(foulLeft, [xAt(EDGES.laneLeft, FOUL_Y), FOUL_Y], 6);
    expectNear(foulRight, [xAt(EDGES.laneRight, FOUL_Y), FOUL_Y], 6);
    expectNear(farLeft, [xAt(EDGES.laneLeft, HEAD_PIN_Y), HEAD_PIN_Y], 4);
    expectNear(farRight, [xAt(EDGES.laneRight, HEAD_PIN_Y), HEAD_PIN_Y], 4);
  });

  it('finds the head pin on a dry lane too, where the pins have no reflection', () => {
    const corners = find(drawAlley('dry'));

    expect(corners).not.toBeNull();
    expectNear(corners![2], [xAt(EDGES.laneLeft, HEAD_PIN_Y), HEAD_PIN_Y], 4);
  });

  it('finds nothing without pins to measure the lane by', () => {
    expect(find(drawAlley('none'))).toBeNull();
  });

  it('finds nothing on a frame without a lane', () => {
    const ctx = new OffscreenCanvas(300, 400).getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = 'rgb(120, 120, 120)';
    ctx.fillRect(0, 0, 300, 400);

    expect(find(ctx.getImageData(0, 0, 300, 400))).toBeNull();
  });
});
