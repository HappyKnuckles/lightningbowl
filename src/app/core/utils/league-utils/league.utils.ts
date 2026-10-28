import { Game } from '../../models/game.model';
import { League, LeagueType, Season, SeasonRange } from '../../models/league.model';

/** Start of the local day `date` is in. */
export function startOfDay(date: number): number {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** "2026/27" for a season starting in the second half of a year (most leagues), "2026" otherwise. */
export function defaultSeasonName(start: number): string {
  const date = new Date(start);
  const year = date.getFullYear();
  return date.getMonth() >= 6 ? `${year}/${String((year + 1) % 100).padStart(2, '0')}` : `${year}`;
}

export function newSeasonId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function sortSeasons(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) => a.start - b.start);
}

export function createLeague(name: string, type: LeagueType = 'league', seasons: Season[] = []): League {
  return { name, type, seasons: sortSeasons(seasons), createdAt: Date.now() };
}

/**
 * A league as stored. Before leagues had a type and seasons they were saved as their plain name;
 * those load as leagues without seasons.
 */
export function normalizeLeague(value: unknown): League | null {
  if (typeof value === 'string') {
    return value.trim() ? { name: value, type: 'league', seasons: [], createdAt: 0 } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<League>;
  if (typeof stored.name !== 'string' || !stored.name.trim()) return null;
  const seasons = Array.isArray(stored.seasons)
    ? stored.seasons.filter((season): season is Season => !!season && typeof season.start === 'number' && typeof season.name === 'string')
    : [];
  return {
    name: stored.name,
    type: stored.type === 'tournament' ? 'tournament' : 'league',
    seasons: sortSeasons(seasons.map((season) => ({ ...season, id: season.id || newSeasonId() }))),
    createdAt: typeof stored.createdAt === 'number' ? stored.createdAt : 0,
  };
}

/** Each season with the dates it covers: until the next one starts, the first one from the beginning. */
export function seasonRanges(league: League | undefined): SeasonRange[] {
  const seasons = sortSeasons(league?.seasons ?? []);
  return seasons.map((season, index) => ({
    season,
    from: index === 0 ? undefined : season.start,
    to: seasons[index + 1]?.start,
  }));
}

export function isInRange(date: number, range: Pick<SeasonRange, 'from' | 'to'>): boolean {
  return (range.from === undefined || date >= range.from) && (range.to === undefined || date < range.to);
}

/** The season a game played on `date` belongs to. */
export function seasonForDate(league: League | undefined, date: number): Season | undefined {
  return seasonRanges(league).find((range) => isInRange(date, range))?.season;
}

/** The season running now: the last one that has started (the first one if none has started yet). */
export function currentSeason(league: League | undefined, now = Date.now()): Season | undefined {
  const seasons = sortSeasons(league?.seasons ?? []);
  return [...seasons].reverse().find((season) => season.start <= now) ?? seasons[0];
}

export function gamesInSeason(games: Game[], league: League | undefined, seasonId: string): Game[] {
  const range = seasonRanges(league).find((candidate) => candidate.season.id === seasonId);
  return range ? games.filter((game) => isInRange(game.date, range)) : [];
}

/**
 * The league with a new season added. A league that had no seasons yet gets one more before it for
 * the games already played, so they don't all end up in the new season (the first season takes
 * everything before the second).
 */
export function withNewSeason(league: League, season: Omit<Season, 'id'>, firstGameDate?: number): League {
  const start = startOfDay(season.start);
  const seasons = [...league.seasons];
  if (seasons.length === 0 && firstGameDate !== undefined && startOfDay(firstGameDate) < start) {
    const previousStart = startOfDay(firstGameDate);
    seasons.push({ id: newSeasonId(), name: defaultSeasonName(previousStart), start: previousStart });
  }
  const added: Season = { id: newSeasonId(), name: uniqueName(season.name.trim() || defaultSeasonName(start), seasons), start };
  return { ...league, seasons: sortSeasons([...seasons, added]) };
}

/** "2026/27", or "2026/27 (2)" when a season already has that name (a second season in the same year). */
function uniqueName(name: string, seasons: Season[]): string {
  const taken = new Set(seasons.map((season) => season.name));
  let candidate = name;
  for (let count = 2; taken.has(candidate); count++) candidate = `${name} (${count})`;
  return candidate;
}

/** The suggested next season: starting today, named after the date. */
export function nextSeasonDraft(now = Date.now()): Omit<Season, 'id'> {
  const start = startOfDay(now);
  return { name: defaultSeasonName(start), start };
}

/** "2026-09-03" for a date input, in local time. */
export function toDateInput(date: number): string {
  const day = new Date(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** Local start of the day of a "2026-09-03" date input; undefined when it isn't a date. */
export function fromDateInput(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}
