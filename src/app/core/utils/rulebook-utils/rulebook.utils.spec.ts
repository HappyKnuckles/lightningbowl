import { Association, Rule, RuleHit } from '../../models/rulebook.model';
import { editionSummary, filterRules, toRuleHitRow, toRuleRow, visibleAssociations } from './rulebook.utils';

const rule = (overrides: Partial<Rule> = {}): Rule => ({
  key: '5',
  number: 'Rule 5',
  title: 'Fouls',
  level: 2,
  parent_key: 'chapter-2',
  page: 13,
  link: 'https://rules.test/usbc.pdf#page=13',
  ...overrides,
});

describe('rulebook utils', () => {
  it('turns a rule into a row indented by its level', () => {
    expect(toRuleRow(rule())).toEqual({
      key: '5',
      number: 'Rule 5',
      title: 'Fouls',
      untitled: false,
      page: 'p. 13',
      indent: 16,
      link: 'https://rules.test/usbc.pdf#page=13',
    });
  });

  it('marks numbered paragraphs without a heading', () => {
    const row = toRuleRow(rule({ number: '2.1.1', title: null, level: 3 }));
    expect(row.title).toBe('Paragraph');
    expect(row.untitled).toBe(true);
  });

  it('names where a search hit is from', () => {
    const hit = {
      ...rule(),
      rulebook: { id: 'usbc-playing-rules', title: 'USBC Playing Rules', language: 'en' },
      association: { id: 'usbc', name: 'United States Bowling Congress', short_name: 'USBC' },
      edition: '2026-2027',
      score: 1,
    } as RuleHit;
    expect(toRuleHitRow(hit)).toEqual(expect.objectContaining({ source: 'USBC · USBC Playing Rules', indent: 0 }));
  });

  it('shows all associations with rulebooks, or the picked one', () => {
    const associations = [
      { id: 'usbc', rulebooks: [{}] },
      { id: 'dbu', rulebooks: [{}] },
      { id: 'empty', rulebooks: [] },
    ] as unknown as Association[];
    expect(visibleAssociations(associations, null).map((a) => a.id)).toEqual(['usbc', 'dbu']);
    expect(visibleAssociations(associations, 'dbu').map((a) => a.id)).toEqual(['dbu']);
  });

  it('summarises the edition', () => {
    expect(editionSummary({ edition: { label: '2026-2027', rule_count: 227 } })).toBe('2026-2027 · 227 rules');
    expect(editionSummary({ edition: null })).toBe('Not available yet');
  });

  it('filters a table of contents by number or title', () => {
    const rules = [rule(), rule({ key: '4', number: 'Rule 4', title: 'Delivering the Ball' }), rule({ key: '2.1.1', number: '2.1.1', title: null })];
    expect(filterRules(rules, 'foul').map((r) => r.key)).toEqual(['5']);
    expect(filterRules(rules, 'rule 4').map((r) => r.key)).toEqual(['4']);
    expect(filterRules(rules, '2.1').map((r) => r.key)).toEqual(['2.1.1']);
    expect(filterRules(rules, ' ')).toHaveLength(3);
  });
});
