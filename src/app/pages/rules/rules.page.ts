import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/angular/lazy';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonRefresher,
  IonSearchbar,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { bookOutline, openOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Association } from 'src/app/core/models/rulebook.model';
import { RulebookService } from 'src/app/core/services/rulebook/rulebook.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { editionSummary, RuleHitRow, toRuleHitRow, visibleAssociations } from 'src/app/core/utils/rulebook-utils/rulebook.utils';
import { BowlingRefresherComponent } from 'src/app/shared/components/bowling-refresher/bowling-refresher.component';

/** Rulebooks of the bowling associations, and a search across all of their rules. */
@Component({
  selector: 'app-rules',
  templateUrl: './rules.page.html',
  styleUrls: ['./rules.page.scss'],
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonSearchbar,
    IonContent,
    IonRefresher,
    IonChip,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonBadge,
    IonIcon,
    IonButton,
    IonText,
    IonSkeletonText,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    BowlingRefresherComponent,
  ],
})
export class RulesPage implements OnInit {
  readonly #rulebookService = inject(RulebookService);
  readonly #toastService = inject(ToastService);

  readonly associations = signal<Association[]>([]);
  readonly chips = computed(() => this.associations().filter((a) => a.rulebooks.length > 0));
  /** Association picked in the chips; null for all. */
  readonly pickedAssociation = signal<string | null>(null);
  readonly sections = computed(() =>
    visibleAssociations(this.associations(), this.pickedAssociation()).map((association) => ({
      id: association.id,
      shortName: association.short_name,
      name: association.name,
      rulebooks: association.rulebooks.map((rulebook) => ({
        id: rulebook.id,
        title: rulebook.title,
        language: rulebook.language.toUpperCase(),
        summary: editionSummary(rulebook),
        available: rulebook.edition !== null,
      })),
    })),
  );
  readonly searchTerm = signal('');
  readonly isSearchActive = computed(() => this.searchTerm().trim() !== '');
  readonly hits = signal<RuleHitRow[]>([]);
  readonly totalHits = signal(0);

  readonly hasMoreHits = computed(() => this.hits().length < this.totalHits());
  readonly hitCount = computed(() => `${this.totalHits()} ${this.totalHits() === 1 ? 'rule' : 'rules'}`);
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly isSearching = signal(false);

  #searchPage = 0;
  /** Ignores answers to searches that were replaced by a newer one. */
  #searchRun = 0;

  constructor() {
    addIcons({ bookOutline, openOutline });
  }

  ngOnInit(): void {
    void this.loadAssociations();
  }

  async loadAssociations(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.associations.set(await this.#rulebookService.getAssociations());
      this.loadFailed.set(false);
    } catch (error) {
      console.error('Error loading rulebooks:', error);
      this.loadFailed.set(true);
      this.#toastService.showToast(TOAST_MESSAGES.rulebooksLoadError, 'bug', true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadAssociations();
    if (this.isSearchActive()) await this.search(this.searchTerm());
    await event.target.complete();
  }

  onSearchInput(event: CustomEvent): void {
    const term = String((event.detail as { value?: string | null }).value ?? '');
    this.searchTerm.set(term);
    void this.search(term);
  }

  pickAssociation(id: string | null): void {
    this.pickedAssociation.set(this.pickedAssociation() === id ? null : id);
    if (this.isSearchActive()) void this.search(this.searchTerm());
  }

  openRule(row: RuleHitRow): void {
    this.#rulebookService.openDocument(row.link);
  }

  async loadMoreHits(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.#fetchHits(this.searchTerm(), this.#searchPage + 1, this.#searchRun);
    await event.target.complete();
  }

  async search(term: string): Promise<void> {
    const run = ++this.#searchRun;
    if (term.trim() === '') {
      this.hits.set([]);
      this.totalHits.set(0);
      return;
    }
    this.isSearching.set(true);
    await this.#fetchHits(term, 0, run);
    if (run === this.#searchRun) this.isSearching.set(false);
  }

  async #fetchHits(term: string, page: number, run: number): Promise<void> {
    try {
      const result = await this.#rulebookService.searchRules(term.trim(), { association: this.pickedAssociation() ?? undefined }, page);
      if (run !== this.#searchRun) return;
      const rows = result.content.map(toRuleHitRow);
      this.hits.set(page === 0 ? rows : [...this.hits(), ...rows]);
      this.totalHits.set(result.page.totalElements);
      this.#searchPage = page;
    } catch (error) {
      if (run !== this.#searchRun) return;
      console.error('Error searching rules:', error);
      this.#toastService.showToast(TOAST_MESSAGES.rulebookSearchError, 'bug', true);
    }
  }
}
