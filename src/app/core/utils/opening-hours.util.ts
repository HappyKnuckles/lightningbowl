import { AlleyOpenState } from '../models/alley.model';

const DAY_KEYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

interface TimeRange {
  /** Minutes since midnight; may exceed 1440 when the range crosses midnight. */
  end: number;
  /** Minutes since midnight. */
  start: number;
}

interface OpeningRule {
  closed: boolean;
  /** Day indices (0 = Monday … 6 = Sunday) the rule applies to. */
  days: number[];
  ranges: TimeRange[];
}

/**
 * Determines whether a venue is currently open based on its OSM `opening_hours` tag.
 * Supports the common subset: "24/7", day ranges/lists ("Mo-Fr", "Sa,Su"),
 * multiple time ranges, ranges crossing midnight and "off"/"closed" rules.
 * Returns 'unknown' for syntax outside that subset rather than guessing.
 */
export function getOpenState(openingHours: string | undefined, now: Date = new Date()): AlleyOpenState {
  if (!openingHours) {
    return 'unknown';
  }
  const value = openingHours.trim();
  if (value === '24/7') {
    return 'open';
  }

  const rules = parseRules(value);
  if (!rules) {
    return 'unknown';
  }

  const dayIndex = (now.getDay() + 6) % 7; // JS Sunday=0 → OSM Monday=0
  const minutes = now.getHours() * 60 + now.getMinutes();

  let matchedAnyRule = false;
  let open = false;
  for (const rule of rules) {
    // Later rules override earlier ones for the days they cover.
    if (rule.days.includes(dayIndex)) {
      matchedAnyRule = true;
      open = !rule.closed && rule.ranges.some((r) => minutes >= r.start && minutes < r.end);
    }
    // A range that crosses midnight on the previous day can keep today open.
    const yesterday = (dayIndex + 6) % 7;
    if (!rule.closed && rule.days.includes(yesterday)) {
      if (rule.ranges.some((r) => r.end > 1440 && minutes < r.end - 1440)) {
        matchedAnyRule = true;
        open = true;
      }
    }
  }

  return matchedAnyRule ? (open ? 'open' : 'closed') : 'closed';
}

/** Splits an OSM opening_hours string into display lines, one per rule. */
export function formatOpeningHours(openingHours: string): string[] {
  return openingHours
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseRules(value: string): OpeningRule[] | null {
  const parts = value
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const rules: OpeningRule[] = [];
  for (const part of parts) {
    // Public/school holiday rules can't be evaluated without a calendar — skip them.
    if (/^(PH|SH)\b/.test(part)) {
      continue;
    }
    const rule = parseRule(part);
    if (!rule) {
      return null;
    }
    rules.push(rule);
  }
  return rules.length > 0 ? rules : null;
}

function parseRule(part: string): OpeningRule | null {
  const match = /^([A-Za-z,\- ]*?)\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*,?\s*)+|off|closed)$/.exec(part);
  if (!match) {
    return null;
  }

  const days = parseDays(match[1].trim());
  if (!days) {
    return null;
  }

  const timesPart = match[2].trim();
  if (timesPart === 'off' || timesPart === 'closed') {
    return { days, ranges: [], closed: true };
  }

  const ranges: TimeRange[] = [];
  for (const rangeText of timesPart.split(',')) {
    const rangeMatch = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(rangeText.trim());
    if (!rangeMatch) {
      return null;
    }
    const start = parseInt(rangeMatch[1], 10) * 60 + parseInt(rangeMatch[2], 10);
    let end = parseInt(rangeMatch[3], 10) * 60 + parseInt(rangeMatch[4], 10);
    if (end <= start) {
      end += 1440; // crosses midnight
    }
    ranges.push({ start, end });
  }
  return { days, ranges, closed: false };
}

function parseDays(daysPart: string): number[] | null {
  if (daysPart === '') {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const days = new Set<number>();
  for (const token of daysPart.split(',').map((t) => t.trim())) {
    const rangeMatch = /^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/.exec(token);
    if (rangeMatch) {
      const from = DAY_KEYS.indexOf(rangeMatch[1] as (typeof DAY_KEYS)[number]);
      const to = DAY_KEYS.indexOf(rangeMatch[2] as (typeof DAY_KEYS)[number]);
      if (from === -1 || to === -1) {
        return null;
      }
      for (let i = from; ; i = (i + 1) % 7) {
        days.add(i);
        if (i === to) {
          break;
        }
      }
    } else {
      const single = DAY_KEYS.indexOf(token as (typeof DAY_KEYS)[number]);
      if (single === -1) {
        return null;
      }
      days.add(single);
    }
  }
  return Array.from(days);
}
