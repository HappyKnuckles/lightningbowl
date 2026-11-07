import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { vi } from 'vitest';
import { Ball } from 'src/app/core/models/ball.model';
import { makeBall } from 'src/testing/fixtures';
import { BallWeightPickerComponent } from './ball-weight-picker.component';

describe('BallWeightPickerComponent', () => {
  const phaze12 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '12' });
  const phaze15 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
  const zen14 = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '14' });
  const zen16 = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '16' });

  let fixture: ComponentFixture<BallWeightPickerComponent>;
  let component: BallWeightPickerComponent;
  let dismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dismiss = vi.fn(async () => true);
    TestBed.configureTestingModule({
      imports: [BallWeightPickerComponent],
      providers: [{ provide: ModalController, useValue: { dismiss } }],
    });
    fixture = TestBed.createComponent(BallWeightPickerComponent);
    component = fixture.componentInstance;
    component.questions = [
      { name: 'Phaze II', options: [phaze12, phaze15], owned: phaze15 },
      { name: 'Zen', options: [zen14, zen16] },
    ];
    component.confirmText = 'Import';
    fixture.detectChanges();
  });

  it('lists each ball with its weights, the arsenal weight picked to start with', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Phaze II');
    expect(text).toContain('16 lbs');
    expect(text).toContain('Import');
    expect(component.picked()).toEqual({ 'Phaze II': 'p-15' });
  });

  it('returns the picked weights; a ball left open is left out', async () => {
    component.pick('Phaze II', 'p-12');

    await component.confirm();

    expect(dismiss).toHaveBeenCalledWith(new Map<string, Ball>([['phaze ii', phaze12]]), 'confirm');
  });

  it('returns nothing when skipped', async () => {
    await component.skip();

    expect(dismiss).toHaveBeenCalledWith(new Map(), 'skip');
  });
});
