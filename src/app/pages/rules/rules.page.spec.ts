import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Association, RuleHitPage } from 'src/app/core/models/rulebook.model';
import { RulebookService } from 'src/app/core/services/rulebook/rulebook.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { RulesPage } from './rules.page';

const ASSOCIATIONS = [
  {
    id: 'usbc',
    name: 'United States Bowling Congress',
    short_name: 'USBC',
    rulebooks: [{ id: 'usbc-playing-rules', title: 'Playing Rules', language: 'en', edition: { label: '2026-2027', rule_count: 227 } }],
  },
  {
    id: 'dbu',
    name: 'Deutsche Bowling Union',
    short_name: 'DBU',
    rulebooks: [{ id: 'dbu-sportordnung', title: 'Sportordnung', language: 'de', edition: null }],
  },
] as unknown as Association[];

const hits = (total: number, keys: string[]): RuleHitPage => ({
  content: keys.map((key) => ({
    key,
    number: `Rule ${key}`,
    title: 'Fouls',
    level: 2,
    parent_key: null,
    page: 13,
    link: `https://rules.test/usbc.pdf#page=13`,
    rulebook: { id: 'usbc-playing-rules', title: 'Playing Rules', language: 'en' },
    association: { id: 'usbc', name: 'United States Bowling Congress', short_name: 'USBC' },
    edition: '2026-2027',
    score: 1,
  })),
  page: { number: 0, size: 30, totalElements: total, totalPages: 1 },
});

describe('RulesPage', () => {
  let fixture: ComponentFixture<RulesPage>;
  let page: RulesPage;
  let service: SpyObj<RulebookService>;
  let toast: SpyObj<ToastService>;

  beforeEach(async () => {
    service = createSpyObj<RulebookService>(['getAssociations', 'searchRules', 'openDocument']);
    service.getAssociations.mockResolvedValue(ASSOCIATIONS);
    service.searchRules.mockResolvedValue(hits(2, ['5', '5a']));
    toast = createSpyObj<ToastService>(['showToast']);
    await TestBed.configureTestingModule({
      imports: [RulesPage],
      providers: [
        { provide: RulebookService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RulesPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('lists the rulebooks per association', () => {
    expect(page.sections().map((s) => s.shortName)).toEqual(['USBC', 'DBU']);
    expect(page.sections()[0]!.rulebooks[0]).toEqual({
      id: 'usbc-playing-rules',
      title: 'Playing Rules',
      language: 'EN',
      summary: '2026-2027 · 227 rules',
      available: true,
    });
    expect(page.sections()[1]!.rulebooks[0]!.available).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Deutsche Bowling Union');
  });

  it('narrows the list to the picked association, and back', () => {
    page.pickAssociation('dbu');
    expect(page.sections().map((s) => s.id)).toEqual(['dbu']);
    page.pickAssociation('dbu');
    expect(page.sections()).toHaveLength(2);
  });

  it('searches across rulebooks within the picked association', async () => {
    page.pickAssociation('usbc');
    await page.search('fouls');
    expect(service.searchRules).toHaveBeenCalledWith('fouls', { association: 'usbc' }, 0);
    expect(page.hits().map((h) => h.key)).toEqual(['5', '5a']);
    expect(page.hitCount()).toBe('2 rules');
    expect(page.hasMoreHits()).toBe(false);
  });

  it('keeps only the answer to the latest search', async () => {
    let answerFirst!: (value: RuleHitPage) => void;
    service.searchRules.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
    const first = page.search('foul');
    await page.search('fouls');
    answerFirst(hits(1, ['old']));
    await first;
    expect(page.hits().map((h) => h.key)).toEqual(['5', '5a']);
  });

  it('opens a hit in the official document', async () => {
    await page.search('fouls');
    page.openRule(page.hits()[0]!);
    expect(service.openDocument).toHaveBeenCalledWith('https://rules.test/usbc.pdf#page=13');
  });

  it('shows the empty state when the rulebooks cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.getAssociations.mockRejectedValue(new Error('offline'));
    page.associations.set([]);
    await page.loadAssociations();
    expect(page.loadFailed()).toBe(true);
    expect(toast.showToast).toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Rulebooks unavailable');
  });
});
