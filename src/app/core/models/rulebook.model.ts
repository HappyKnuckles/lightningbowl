/** Models of the rulebooks API (lightningbowl-rulebooks): the structure of associations' rulebooks, not their texts. */

export type RulebookLanguage = 'en' | 'de';

export interface RulebookEdition {
  id: string;
  /** As the document states it ("2026-2027", "01.07.2026"), else the file date. */
  label: string;
  document_url: string;
  page_count: number;
  rule_count: number;
  structure: 'outline' | 'headings';
  fetched_at: string;
}

export interface RulebookSummary {
  id: string;
  association_id: string;
  title: string;
  language: RulebookLanguage;
  page_url: string;
  /** Null until the rulebook was imported once. */
  edition: RulebookEdition | null;
  checked_at: string | null;
}

export interface Association {
  id: string;
  name: string;
  short_name: string;
  country: string | null;
  scope: 'national' | 'continental' | 'world' | 'tour';
  website: string;
  aliases: string[];
  rulebooks: RulebookSummary[];
}

export interface Rule {
  key: string;
  /** As printed ("Rule 4", "§ 12", "3.1.2"); null for unnumbered sections. */
  number: string | null;
  /** Null for numbered paragraphs without a heading of their own. */
  title: string | null;
  level: number;
  parent_key: string | null;
  page: number;
  /** The official document opened at the rule's page. */
  link: string;
}

export interface Rulebook extends RulebookSummary {
  association: { id: string; name: string; short_name: string };
  rules: Rule[];
}

export interface RuleHit extends Rule {
  rulebook: { id: string; title: string; language: RulebookLanguage };
  association: { id: string; name: string; short_name: string };
  /** Edition label. */
  edition: string;
  score: number;
}

export interface RuleHitPage {
  content: RuleHit[];
  page: { number: number; size: number; totalElements: number; totalPages: number };
}
