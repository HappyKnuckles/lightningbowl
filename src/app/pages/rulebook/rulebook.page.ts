import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSearchbar,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { bookOutline, documentTextOutline, openOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Rulebook } from 'src/app/core/models/rulebook.model';
import { RulebookService } from 'src/app/core/services/rulebook/rulebook.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { filterRules, RuleRow, toRuleRow } from 'src/app/core/utils/rulebook-utils/rulebook.utils';

/** One rulebook's table of contents; a rule opens the official document at its page. */
@Component({
  selector: 'app-rulebook',
  templateUrl: './rulebook.page.html',
  styleUrls: ['./rulebook.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonSearchbar,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonButton,
    IonText,
    IonSkeletonText,
  ],
})
export class RulebookPage implements OnInit {
  readonly #route = inject(ActivatedRoute);
  readonly #rulebookService = inject(RulebookService);
  readonly #toastService = inject(ToastService);

  readonly rulebook = signal<Rulebook | null>(null);
  readonly title = computed(() => this.rulebook()?.title ?? 'Rulebook');
  readonly subtitle = computed(() => {
    const rulebook = this.rulebook();
    if (!rulebook?.edition) return '';
    return `${rulebook.association.short_name} · ${rulebook.edition.label} · ${rulebook.edition.page_count} pages`;
  });
  readonly searchTerm = signal('');
  readonly isSearchActive = computed(() => this.searchTerm().trim() !== '');
  /** Server search results (they also cover the rule texts); null while not searching or when the search failed. */
  readonly searchHits = signal<RuleRow[] | null>(null);

  readonly rows = computed<RuleRow[]>(() => {
    const rulebook = this.rulebook();
    if (!rulebook) return [];
    if (!this.isSearchActive()) return rulebook.rules.map(toRuleRow);
    // offline (or the search failed): match numbers and titles of the table of contents
    return this.searchHits() ?? filterRules(rulebook.rules, this.searchTerm()).map((rule) => ({ ...toRuleRow(rule), indent: 0 }));
  });
  readonly isSearching = signal(false);
  readonly listHeader = computed(() => {
    if (!this.isSearchActive()) return 'Contents';
    if (this.isSearching()) return 'Searching…';
    const count = this.rows().length;
    return `${count} ${count === 1 ? 'rule' : 'rules'}`;
  });
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);

  #searchRun = 0;

  constructor() {
    addIcons({ bookOutline, documentTextOutline, openOutline });
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const id = this.#route.snapshot.paramMap.get('id') ?? '';
    this.isLoading.set(true);
    try {
      this.rulebook.set(await this.#rulebookService.getRulebook(id));
      this.loadFailed.set(false);
    } catch (error) {
      console.error('Error loading rulebook:', error);
      this.loadFailed.set(true);
      this.#toastService.showToast(TOAST_MESSAGES.rulebooksLoadError, 'bug', true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSearchInput(event: CustomEvent): Promise<void> {
    const term = String((event.detail as { value?: string | null }).value ?? '');
    this.searchTerm.set(term);
    const run = ++this.#searchRun;
    this.searchHits.set(null);
    const rulebook = this.rulebook();
    if (!rulebook || term.trim() === '') return;

    this.isSearching.set(true);
    try {
      const result = await this.#rulebookService.searchRules(term.trim(), { rulebook: rulebook.id });
      if (run === this.#searchRun) this.searchHits.set(result.content.map((hit) => ({ ...toRuleRow(hit), indent: 0 })));
    } catch (error) {
      console.warn('Rule search failed, filtering the contents instead:', error);
    } finally {
      if (run === this.#searchRun) this.isSearching.set(false);
    }
  }

  openRule(row: RuleRow): void {
    this.#rulebookService.openDocument(row.link);
  }

  openDocument(): void {
    const url = this.rulebook()?.edition?.document_url;
    if (url) this.#rulebookService.openDocument(url);
  }
}
