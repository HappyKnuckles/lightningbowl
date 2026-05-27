import { Injectable } from '@angular/core';
import { GameDraft } from '../../models/game.model';

@Injectable({ providedIn: 'root' })
export class GameDraftService {
  private readonly DRAFT_KEY = 'bowling_game_draft';
  private readonly DRAFT_TTL = 4 * 60 * 60 * 1000;

  save(draft: Omit<GameDraft, 'timestamp'>): void {
    const hasData = draft.games.some((game) => game.frames.some((f) => f.throws && f.throws.length > 0));

    if (!hasData) {
      this.clear();
      return;
    }

    const fullDraft: GameDraft = {
      ...draft,
      timestamp: Date.now(),
    };

    try {
      const tmpKey = this.DRAFT_KEY + '.tmp';
      const payload = JSON.stringify(fullDraft);
      localStorage.setItem(tmpKey, payload);
      localStorage.setItem(this.DRAFT_KEY, payload);
      localStorage.removeItem(tmpKey);
    } catch (err) {
      console.error('Failed to save draft', err);
    }
  }

  load(): GameDraft | null {
    const draftJson = localStorage.getItem(this.DRAFT_KEY);
    if (!draftJson) return null;

    try {
      const draft: GameDraft = JSON.parse(draftJson);
      const now = Date.now();

      if (now - draft.timestamp > this.DRAFT_TTL) {
        this.clear();
        return null;
      }

      return draft;
    } catch (e) {
      console.error('Error parsing draft', e);
      this.clear();
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(this.DRAFT_KEY);
  }
}
