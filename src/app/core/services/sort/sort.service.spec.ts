import { TestBed } from '@angular/core/testing';
import { SortService } from './sort.service';
import { Ball } from '../../models/ball.model';
import { Pattern } from '../../models/pattern.model';
import { BallSortField, PatternSortField, SortDirection } from '../../models/sort.model';

describe('SortService', () => {
  let service: SortService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SortService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('sortBalls', () => {
    const mockBalls: Ball[] = [
      {
        ball_name: 'Ball C',
        brand_name: 'Brand B',
        core_rg: '2.55',
        core_diff: '0.045',
        release_date: '2022',
        core_type: 'Symmetric',
        coverstock_type: 'Reactive',
        ball_id: '1',
        ball_image: '',
        brand_id: '',
        core_id: '',
        core_image: '',
        core_int_diff: '',
        core_name: 'Core1',
        core_weight: '15',
        coverstock_id: '',
        coverstock_name: 'Cover1',
        factory_finish: '1500 Grit',
        last_update: '',
        thumbnail_image: '',
        us_int: 'US',
        availability: 'Available',
      } as Ball,
      {
        ball_name: 'Ball A',
        brand_name: 'Brand A',
        core_rg: '2.50',
        core_diff: '0.035',
        release_date: '2023',
        core_type: 'Asymmetric',
        coverstock_type: 'Pearl',
        ball_id: '2',
        ball_image: '',
        brand_id: '',
        core_id: '',
        core_image: '',
        core_int_diff: '',
        core_name: 'Core2',
        core_weight: '15',
        coverstock_id: '',
        coverstock_name: 'Cover2',
        factory_finish: '2000 Grit',
        last_update: '',
        thumbnail_image: '',
        us_int: 'US',
        availability: 'Available',
      } as Ball,
      {
        ball_name: 'Ball B',
        brand_name: 'Brand C',
        core_rg: '2.60',
        core_diff: '0.040',
        release_date: '2021',
        core_type: 'Symmetric',
        coverstock_type: 'Solid',
        ball_id: '3',
        ball_image: '',
        brand_id: '',
        core_id: '',
        core_image: '',
        core_int_diff: '',
        core_name: 'Core3',
        core_weight: '15',
        coverstock_id: '',
        coverstock_name: 'Cover3',
        factory_finish: '3000 Grit',
        last_update: '',
        thumbnail_image: '',
        us_int: 'US',
        availability: 'Available',
      } as Ball,
    ];

    it('should sort balls by name ascending', () => {
      const sorted = service.sortBalls(mockBalls, {
        field: BallSortField.BALL_NAME,
        direction: SortDirection.ASC,
        label: 'Name (A-Z)',
      });

      expect(sorted[0].ball_name).toBe('Ball A');
      expect(sorted[1].ball_name).toBe('Ball B');
      expect(sorted[2].ball_name).toBe('Ball C');
    });

    it('should sort balls by RG descending', () => {
      const sorted = service.sortBalls(mockBalls, {
        field: BallSortField.CORE_RG,
        direction: SortDirection.DESC,
        label: 'RG (High to Low)',
      });

      expect(sorted[0].core_rg).toBe('2.60');
      expect(sorted[1].core_rg).toBe('2.55');
      expect(sorted[2].core_rg).toBe('2.50');
    });

    it('should sort balls by release date newest first', () => {
      const sorted = service.sortBalls(mockBalls, {
        field: BallSortField.RELEASE_DATE,
        direction: SortDirection.DESC,
        label: 'Newest First',
      });

      expect(sorted[0].release_date).toBe('2023');
      expect(sorted[1].release_date).toBe('2022');
      expect(sorted[2].release_date).toBe('2021');
    });
  });

  describe('sortPatterns', () => {
    const mockPatterns: Pattern[] = [
      {
        title: 'Pattern C',
        category: 'Sport',
        distance: '39',
        volume: '25.5',
        ratio: '2.8:1',
        forward: '15.2',
        reverse: '10.3',
        pump: '1000',
        url: 'pattern-c',
        forwards_data: [],
        reverse_data: [],
      } as Pattern,
      {
        title: 'Pattern A',
        category: 'House',
        distance: '42',
        volume: '23.2',
        ratio: '4.2:1',
        forward: '13.8',
        reverse: '9.4',
        pump: '1200',
        url: 'pattern-a',
        forwards_data: [],
        reverse_data: [],
      } as Pattern,
      {
        title: 'Pattern B',
        category: 'Challenge',
        distance: '35',
        volume: '28.1',
        ratio: '3.5:1',
        forward: '16.5',
        reverse: '11.6',
        pump: '800',
        url: 'pattern-b',
        forwards_data: [],
        reverse_data: [],
      } as Pattern,
    ];

    it('should sort patterns by title ascending', () => {
      const sorted = service.sortPatterns(mockPatterns, {
        field: PatternSortField.TITLE,
        direction: SortDirection.ASC,
        label: 'Title (A-Z)',
      });

      expect(sorted[0].title).toBe('Pattern A');
      expect(sorted[1].title).toBe('Pattern B');
      expect(sorted[2].title).toBe('Pattern C');
    });

    it('should sort patterns by distance ascending', () => {
      const sorted = service.sortPatterns(mockPatterns, {
        field: PatternSortField.DISTANCE,
        direction: SortDirection.ASC,
        label: 'Distance (Low to High)',
      });

      expect(sorted[0].distance).toBe('35');
      expect(sorted[1].distance).toBe('39');
      expect(sorted[2].distance).toBe('42');
    });

    it('should sort patterns by ratio descending', () => {
      const sorted = service.sortPatterns(mockPatterns, {
        field: PatternSortField.RATIO,
        direction: SortDirection.DESC,
        label: 'Ratio (High to Low)',
      });

      expect(sorted[0].ratio).toBe('4.2:1');
      expect(sorted[1].ratio).toBe('3.5:1');
      expect(sorted[2].ratio).toBe('2.8:1');
    });
  });
});
