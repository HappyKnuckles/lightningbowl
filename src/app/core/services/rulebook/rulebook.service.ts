import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Association, Rulebook, RuleHitPage } from '../../models/rulebook.model';
import { CacheService } from '../cache/cache.service';

/** Rulebooks change a few times a year; cached copies are used when the API can't be reached. */
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
export const RULE_PAGE_SIZE = 30;

/**
 * Talks to the rulebooks API: associations with their rulebooks, a rulebook's table of contents, and
 * the rule search. Associations and tables of contents are cached for offline use; search needs the API.
 */
@Injectable({ providedIn: 'root' })
export class RulebookService {
  readonly #http = inject(HttpClient);
  readonly #cache = inject(CacheService);
  readonly #endpoint = environment.rulebookApiEndpoint;

  getAssociations(): Promise<Association[]> {
    return this.#cachedGet<Association[]>('associations', 'rulebook_associations');
  }

  getRulebook(id: string): Promise<Rulebook> {
    return this.#cachedGet<Rulebook>(`rulebooks/${encodeURIComponent(id)}`, `rulebook_${id}`);
  }

  /** One page (from 0) of rules matching `search`, optionally within one association or rulebook. */
  searchRules(search: string, filters: { association?: string; rulebook?: string } = {}, page = 0): Promise<RuleHitPage> {
    let params = new HttpParams().set('search', search).set('page', page).set('size', RULE_PAGE_SIZE);
    if (filters.association) params = params.set('association', filters.association);
    if (filters.rulebook) params = params.set('rulebook', filters.rulebook);
    return firstValueFrom(this.#http.get<RuleHitPage>(`${this.#endpoint}rules`, { params }));
  }

  /** Opens the official document (at a rule's page when the link has `#page=`). */
  openDocument(url: string): void {
    if (Capacitor.isNativePlatform()) {
      void Browser.open({ url });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  /** Fresh from the API when it answers (and cached), otherwise the cached copy; throws if there is neither. */
  async #cachedGet<T>(path: string, cacheKey: string): Promise<T> {
    try {
      const data = await firstValueFrom(this.#http.get<T>(`${this.#endpoint}${path}`));
      await this.#cache.set(cacheKey, data, CACHE_TTL);
      return data;
    } catch (error) {
      const cached = await this.#cache.get<T>(cacheKey);
      if (cached) return cached;
      throw error;
    }
  }
}
