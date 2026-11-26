import { Association, Rule, RuleHit } from '../../models/rulebook.model';

/** A rule as a list shows it. */
export interface RuleRow {
  key: string;
  /** "Rule 4", "§ 12", "3.1.2"; empty for unnumbered sections. */
  number: string;
  /** The heading, or a hint for numbered paragraphs that have none. */
  title: string;
  untitled: boolean;
  /** "p. 13". */
  page: string;
  /** Indentation in px for the rule's level. */
  indent: number;
  link: string;
}

const INDENT_PX = 16;

export function toRuleRow(rule: Rule): RuleRow {
  return {
    key: rule.key,
    number: rule.number ?? '',
    title: rule.title ?? 'Paragraph',
    untitled: rule.title === null,
    page: `p. ${rule.page}`,
    indent: (rule.level - 1) * INDENT_PX,
    link: rule.link,
  };
}

/** A search hit: the rule plus where it is from. */
export interface RuleHitRow extends RuleRow {
  source: string;
}

export function toRuleHitRow(hit: RuleHit): RuleHitRow {
  return { ...toRuleRow(hit), indent: 0, source: `${hit.association.short_name} · ${hit.rulebook.title}` };
}

/** The associations to show: all, or the one picked; those without rulebooks are left out. */
export function visibleAssociations(associations: Association[], picked: string | null): Association[] {
  return associations.filter((a) => a.rulebooks.length > 0 && (!picked || a.id === picked));
}

/** "2026-2027 · 227 rules", or a note that the rulebook isn't imported yet. */
export function editionSummary(rulebook: { edition: { label: string; rule_count: number } | null }): string {
  return rulebook.edition ? `${rulebook.edition.label} · ${rulebook.edition.rule_count} rules` : 'Not available yet';
}

/** Filters a table of contents by number or title (for when the search API can't be reached). */
export function filterRules(rules: Rule[], term: string): Rule[] {
  const wanted = term.trim().toLowerCase();
  if (!wanted) return rules;
  return rules.filter((r) => `${r.number ?? ''} ${r.title ?? ''}`.toLowerCase().includes(wanted));
}
