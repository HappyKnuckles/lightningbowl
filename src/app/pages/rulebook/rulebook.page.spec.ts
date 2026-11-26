import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';
import { Rulebook } from 'src/app/core/models/rulebook.model';
import { RulebookService } from 'src/app/core/services/rulebook/rulebook.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { RulebookPage } from './rulebook.page';

const link = (page: number) => `https://rules.test/usbc.pdf#page=${page}`;

const RULEBOOK = {
  id: 'usbc-playing-rules',
  association_id: 'usbc',
  title: 'USBC Playing Rules',
  language: 'en',
  page_url: 'https://bowl.test/rules',
  checked_at: null,
  association: { id: 'usbc', name: 'United States Bowling Congress', short_name: 'USBC' },
  edition: {
    id: '1',
    label: '2026-2027',
    document_url: 'https://rules.test/usbc.pdf',
    page_count: 80,
    rule_count: 3,
    structure: 'headings',
    fetched_at: '',
  },
  rules: [
    { key: 'chapter-2', number: 'Chapter 2', title: 'General Playing Rules', level: 1, parent_key: null, page: 12, link: link(12) },
    { key: '5', number: 'Rule 5', title: 'Fouls', level: 2, parent_key: 'chapter-2', page: 13, link: link(13) },
    { key: '5a', number: '5a', title: null, level: 3, parent_key: '5', page: 13, link: link(13) },
  ],
} as Rulebook;

describe('RulebookPage', () => {
  let fixture: ComponentFixture<RulebookPage>;
  let page: RulebookPage;
  let service: SpyObj<RulebookService>;

  const search = (value: string) => page.onSearchInput(new CustomEvent('ionInput', { detail: { value } }));

  beforeEach(async () => {
    service = createSpyObj<RulebookService>(['getRulebook', 'searchRules', 'openDocument']);
    service.getRulebook.mockResolvedValue(RULEBOOK);
    await TestBed.configureTestingModule({
      imports: [RulebookPage],
      providers: [
        { provide: RulebookService, useValue: service },
        { provide: ToastService, useValue: createSpyObj<ToastService>(['showToast']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'usbc-playing-rules' }) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RulebookPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the table of contents, indented by level', () => {
    expect(service.getRulebook).toHaveBeenCalledWith('usbc-playing-rules');
    expect(page.title()).toBe('USBC Playing Rules');
    expect(page.subtitle()).toBe('USBC · 2026-2027 · 80 pages');
    expect(page.rows().map((r) => [r.key, r.indent])).toEqual([
      ['chapter-2', 0],
      ['5', 16],
      ['5a', 32],
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Paragraph');
  });

  it('searches the rule texts within this rulebook', async () => {
    service.searchRules.mockResolvedValue({
      content: [{ ...RULEBOOK.rules[2]!, rulebook: {}, association: {}, edition: '', score: 1 }],
      page: {},
    } as never);
    await search('foul line');
    expect(service.searchRules).toHaveBeenCalledWith('foul line', { rulebook: 'usbc-playing-rules' });
    expect(page.rows().map((r) => r.key)).toEqual(['5a']);
    expect(page.listHeader()).toBe('1 rule');
  });

  it('filters the contents when the search API cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.searchRules.mockRejectedValue(new Error('offline'));
    await search('fouls');
    expect(page.rows().map((r) => r.key)).toEqual(['5']);
  });

  it('opens a rule, and the whole document', () => {
    page.openRule(page.rows()[1]!);
    expect(service.openDocument).toHaveBeenCalledWith(link(13));
    page.openDocument();
    expect(service.openDocument).toHaveBeenCalledWith('https://rules.test/usbc.pdf');
  });
});
