import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { BallPage } from 'src/app/core/models/ball.model';
import { environment } from 'src/environments/environment';
import { makeBall } from 'src/testing/fixtures';
import { BallService } from './ball.service';

describe('BallService', () => {
  let service: BallService;
  let http: HttpTestingController;
  const api = environment.ballApiEndpoint;

  const pageOf = (content = [makeBall()]): BallPage => ({ content, page: { number: 0, size: 100, totalElements: content.length, totalPages: 1 } });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BallService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches balls with the given query parameters', async () => {
    const result = service.searchBalls({ page: '1', brand: ['Storm', 'Hammer'] });

    const req = http.expectOne((r) => r.url === `${api}balls`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.getAll('brand')).toEqual(['Storm', 'Hammer']);
    req.flush(pageOf());

    expect((await result).content.length).toBe(1);
  });

  it('finds balls with the same core at the same weight, excluding the ball itself', async () => {
    const ball = makeBall({ ball_id: '7', core_name: 'Velocity', core_weight: '15' });
    const result = service.getBallsByCore(ball);

    const req = http.expectOne((r) => r.url === `${api}balls`);
    expect(req.request.params.get('core')).toBe('Velocity');
    expect(req.request.params.get('excludeId')).toBe('7');
    expect(req.request.params.get('weight')).toBe('15');
    req.flush(pageOf([makeBall({ ball_id: '8' })]));

    expect((await result).map((b) => b.ball_id)).toEqual(['8']);
  });

  it('finds balls with the same coverstock', async () => {
    const result = service.getBallsByCoverstock(makeBall({ ball_id: '7', coverstock_name: 'TX-16' }));

    const req = http.expectOne((r) => r.url === `${api}balls`);
    expect(req.request.params.get('coverstock')).toBe('TX-16');
    req.flush(pageOf([]));

    expect(await result).toEqual([]);
  });

  it('asks the API for similar balls and puts the original first', async () => {
    const ball = makeBall({ ball_id: '7', core_weight: '15' });
    const result = service.getBallsByMovementPattern(ball);

    const req = http.expectOne((r) => r.url.startsWith(api) && r.url.includes('similar'));
    expect(req.request.params.get('weight')).toBe('15');
    req.flush([makeBall({ ball_id: '9' })]);

    expect((await result).map((b) => b.ball_id)).toEqual(['7', '9']);
  });

  it('returns nothing when there are no similar balls', async () => {
    const result = service.getBallsByMovementPattern(makeBall({ ball_id: '7' }));
    http.expectOne((r) => r.url.includes('similar')).flush([]);

    expect(await result).toEqual([]);
  });
});
