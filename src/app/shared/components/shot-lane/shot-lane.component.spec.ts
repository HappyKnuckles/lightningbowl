import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';
import { ShotLaneComponent } from './shot-lane.component';

function result(overrides: Partial<ShotAnalysisResult> = {}): ShotAnalysisResult {
  return {
    handedness: 'right',
    fps: 60,
    framesProcessed: 300,
    trackedFromFt: 2,
    trackedToFt: 60,
    points: [],
    curve: [
      { distanceFt: 2, board: 20 },
      { distanceFt: 30, board: 12 },
      { distanceFt: 60, board: 17.5 },
    ],
    metrics: {
      arrowsBoard: 15.8,
      breakpoint: { distanceFt: 38, board: 11.3 },
      entryBoard: 17.5,
      entryBoardExtrapolated: false,
    },
    ...overrides,
  };
}

describe('ShotLaneComponent', () => {
  let fixture: ComponentFixture<ShotLaneComponent>;
  let component: ShotLaneComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(ShotLaneComponent);
    component = fixture.componentInstance;
  });

  const render = (value: ShotAnalysisResult) => {
    fixture.componentRef.setInput('result', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('draws the ball path through every curve point', () => {
    const el = render(result());

    const d = el.querySelector('.ball-path')?.getAttribute('d') ?? '';
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/L/g)?.length).toBe(2);
  });

  it('marks arrows, breakpoint and entry with their boards', () => {
    const el = render(result());

    const labels = [...el.querySelectorAll('.marker-label')].map((t) => t.textContent?.trim());
    expect(labels).toEqual(['15.8', 'BP 11.3', '17.5']);
  });

  it('leaves out markers the service could not measure', () => {
    const el = render(result({ metrics: { arrowsBoard: 14, entryBoardExtrapolated: false } }));

    expect(el.querySelectorAll('.marker').length).toBe(1);
  });

  it('mirrors the lane for left-handers', () => {
    render(result());
    const rightHanded = component.markers()[0].x;
    render(result({ handedness: 'left' }));
    const leftHanded = component.markers()[0].x;

    // board 15.8 sits right of centre for a right-hander (board 1 is the right gutter) and left of it for a left-hander
    expect(rightHanded).toBeGreaterThan(30 + 78);
    expect(leftHanded).toBeLessThan(30 + 78);
  });

  it('shows ten pins and the arrows', () => {
    const el = render(result());

    expect(el.querySelectorAll('.pin').length).toBe(10);
    expect(el.querySelectorAll('.arrow').length).toBe(7);
    expect(el.querySelectorAll('.range-finder').length).toBe(4);
  });
});
