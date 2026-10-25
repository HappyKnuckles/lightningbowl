import { inject, Injectable } from '@angular/core';
import {
  BALL_BRAND_TYPEAHEAD_CONFIG,
  BALL_CORE_TYPEAHEAD_CONFIG,
  BALL_COVERSTOCK_TYPEAHEAD_CONFIG,
  createBallTypeaheadConfig,
} from '../../configs/typeahead/ball.config';
import { createPartialPatternTypeaheadConfig, createPatternTypeaheadConfig } from '../../configs/typeahead/pattern.config';
import { BallFilterService } from '../ball-filter/ball-filter.service';
import { BallService } from '../ball/ball.service';
import { PatternService } from '../pattern/pattern.service';

@Injectable({
  providedIn: 'root',
})
export class TypeaheadConfigService {
  private patternService = inject(PatternService);
  private ballService = inject(BallService);
  private ballFilterService = inject(BallFilterService);

  readonly brand = BALL_BRAND_TYPEAHEAD_CONFIG;
  readonly core = BALL_CORE_TYPEAHEAD_CONFIG;
  readonly coverstock = BALL_COVERSTOCK_TYPEAHEAD_CONFIG;
  // Searches the ball API in the weight set in the ball filter (default 15 lb).
  readonly ball = createBallTypeaheadConfig(
    (term) => this.ballService.findBallsByText(term, this.ballFilterService.filters().weight),
    (term, page) => this.ballService.findBallsPage(term, page, this.ballFilterService.filters().weight),
  );
  // readonly league = LEAGUE_TYPEAHEAD_CONFIG;

  readonly pattern = createPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
  readonly partialPattern = createPartialPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
}
