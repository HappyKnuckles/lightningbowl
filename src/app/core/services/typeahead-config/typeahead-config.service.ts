import { inject, Injectable } from '@angular/core';
import {
  ARSENAL_BALL_TYPEAHEAD_CONFIG,
  BALL_BRAND_TYPEAHEAD_CONFIG,
  BALL_CORE_TYPEAHEAD_CONFIG,
  BALL_COVERSTOCK_TYPEAHEAD_CONFIG,
  BALL_TYPEAHEAD_CONFIG,
} from '../../configs/typeahead/ball.config';
import { LEAGUE_FILTER_TYPEAHEAD_CONFIG, PATTERN_FILTER_TYPEAHEAD_CONFIG } from '../../configs/typeahead/game-filter.config';
import { createPartialPatternTypeaheadConfig, createPatternTypeaheadConfig } from '../../configs/typeahead/pattern.config';
import { PatternService } from '../pattern/pattern.service';

@Injectable({
  providedIn: 'root',
})
export class TypeaheadConfigService {
  private patternService = inject(PatternService);

  readonly brand = BALL_BRAND_TYPEAHEAD_CONFIG;
  readonly core = BALL_CORE_TYPEAHEAD_CONFIG;
  readonly coverstock = BALL_COVERSTOCK_TYPEAHEAD_CONFIG;
  readonly ball = BALL_TYPEAHEAD_CONFIG;
  readonly arsenalBall = ARSENAL_BALL_TYPEAHEAD_CONFIG;
  readonly leagueFilter = LEAGUE_FILTER_TYPEAHEAD_CONFIG;
  readonly patternFilter = PATTERN_FILTER_TYPEAHEAD_CONFIG;

  readonly pattern = createPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
  readonly partialPattern = createPartialPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
}
