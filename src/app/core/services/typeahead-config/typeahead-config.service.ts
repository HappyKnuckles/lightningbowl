import { inject, Injectable } from '@angular/core';

import {
  BALL_BRAND_TYPEAHEAD_CONFIG,
  BALL_CORE_TYPEAHEAD_CONFIG,
  BALL_COVERSTOCK_TYPEAHEAD_CONFIG,
  BALL_TYPEAHEAD_CONFIG,
} from '../../configs/typeahead/ball.config';
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
  // readonly league = LEAGUE_TYPEAHEAD_CONFIG;

  readonly pattern = createPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
  readonly partialPattern = createPartialPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
}
