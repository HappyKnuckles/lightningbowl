import { inject, Injectable } from '@angular/core';
import {
  createBallTypeaheadConfig,
  createBrandTypeaheadConfig,
  createCoreTypeaheadConfig,
  createCoverstockTypeaheadConfig,
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

  readonly brand = createBrandTypeaheadConfig();
  readonly core = createCoreTypeaheadConfig();
  readonly coverstock = createCoverstockTypeaheadConfig();
  readonly ball = createBallTypeaheadConfig((term, page) => this.ballService.findBallsPage(term, page, this.ballFilterService.filters().weight));
  // readonly league = LEAGUE_TYPEAHEAD_CONFIG;

  readonly pattern = createPatternTypeaheadConfig((term) => this.patternService.searchPattern(term));
  readonly partialPattern = createPartialPatternTypeaheadConfig((term, page) => this.patternService.findPatternsPage(term, page));
}
