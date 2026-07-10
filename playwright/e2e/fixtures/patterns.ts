import type { Pattern } from '../../../src/app/core/models/pattern.model';

/**
 * A small, deterministic set of oil patterns used to mock the Pattern Library
 * API in e2e (the real endpoint is network-backed). Titles are distinct so a
 * search term narrows to a single, assertable result.
 */
export const PATTERNS: Pattern[] = [
  pattern('kegel-main-street', 'Kegel Main Street', 'Recreational', '38', '7.5', '22.55'),
  pattern('pba-cheetah-35', 'PBA Cheetah 35', 'Sport', '35', '2.1', '18.45'),
  pattern('pba-scorpion-41', 'PBA Scorpion 41', 'Sport', '41', '4.8', '25.30'),
  pattern('kegel-stone-street', 'Kegel Stone Street', 'Challenge', '39', '5.2', '23.10'),
];

function pattern(url: string, title: string, category: string, distance: string, ratio: string, volume: string): Pattern {
  return {
    url,
    title,
    category,
    distance,
    ratio,
    volume,
    forward: '12.0',
    reverse: '10.5',
    pump: '40',
    tanks: '3',
    pdf_url: `https://example.test/${url}.pdf`,
    kosi_url: `https://example.test/${url}.kosi`,
    forwards_data: [],
    reverse_data: [],
    chart_standard: '',
    chart_horizontal: '',
  };
}
