import { League } from 'src/app/core/models/league.model';
import { makeGame } from 'src/testing/fixtures';

import {
  currentSeason,
  defaultSeasonName,
  fromDateInput,
  gamesInSeason,
  normalizeLeague,
  seasonForDate,
  seasonRanges,
  toDateInput,
  withNewSeason,
} from './league.utils';

const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

const league = (seasons: { id: string; name: string; start: string }[]): League => ({
  name: 'Thursday',
  type: 'league',
  createdAt: 0,
  seasons: seasons.map((season) => ({ ...season, start: day(season.start) })),
});

describe('league utils', () => {
  const thursday = league([
    { id: 'b', name: '2026/27', start: '2026-09-03' },
    { id: 'a', name: '2025/26', start: '2025-09-04' },
  ]);

  it('names seasons starting in the second half of a year after both years', () => {
    expect(defaultSeasonName(day('2026-09-03'))).toBe('2026/27');
    expect(defaultSeasonName(day('2099-08-01'))).toBe('2099/00');
    expect(defaultSeasonName(day('2026-02-01'))).toBe('2026');
  });

  it('reads leagues saved as plain names and fills in what older objects lack', () => {
    expect(normalizeLeague('Monday')).toEqual({ name: 'Monday', type: 'league', seasons: [], createdAt: 0 });
    expect(normalizeLeague('  ')).toBeNull();
    expect(normalizeLeague({ name: 'Cup', type: 'tournament' })).toEqual({ name: 'Cup', type: 'tournament', seasons: [], createdAt: 0 });
    expect(normalizeLeague({ type: 'league' })).toBeNull();
    expect(normalizeLeague({ name: 'X', seasons: [{ name: 'S', start: 5 }] })?.seasons[0].id).toBeTruthy();
  });

  it('lets each season run until the next one starts, the first one from the beginning', () => {
    expect(seasonRanges(thursday).map((range) => [range.season.id, range.from, range.to])).toEqual([
      ['a', undefined, day('2026-09-03')],
      ['b', day('2026-09-03'), undefined],
    ]);
    expect(seasonForDate(thursday, day('2024-01-01'))?.id).toBe('a');
    expect(seasonForDate(thursday, day('2026-09-02'))?.id).toBe('a');
    expect(seasonForDate(thursday, day('2026-09-03'))?.id).toBe('b');
    expect(seasonForDate(league([]), day('2026-09-03'))).toBeUndefined();
  });

  it('takes the last season that has started as the current one', () => {
    expect(currentSeason(thursday, day('2026-10-28'))?.id).toBe('b');
    expect(currentSeason(thursday, day('2026-01-01'))?.id).toBe('a');
    expect(currentSeason(thursday, day('2020-01-01'))?.id).toBe('a');
    expect(currentSeason(league([]))).toBeUndefined();
  });

  it('picks the games of a season by their date', () => {
    const games = [makeGame({ gameId: 'old', date: day('2025-10-01') }), makeGame({ gameId: 'new', date: day('2026-10-01') })];

    expect(gamesInSeason(games, thursday, 'a').map((game) => game.gameId)).toEqual(['old']);
    expect(gamesInSeason(games, thursday, 'b').map((game) => game.gameId)).toEqual(['new']);
    expect(gamesInSeason(games, thursday, 'missing')).toEqual([]);
  });

  it('gives a league without seasons a season for the games played before the new one', () => {
    const updated = withNewSeason(league([]), { name: '', start: day('2026-09-03') + 3600000 }, day('2025-09-04') + 72000000);

    expect(updated.seasons.map((season) => [season.name, season.start])).toEqual([
      ['2025/26', day('2025-09-04')],
      ['2026/27', day('2026-09-03')],
    ]);
  });

  it('adds just the new season to a league that has seasons or no earlier games', () => {
    expect(withNewSeason(thursday, { name: 'Spring', start: day('2027-02-01') }, day('2025-09-04')).seasons.map((season) => season.name)).toEqual([
      '2025/26',
      '2026/27',
      'Spring',
    ]);
    expect(withNewSeason(league([]), { name: 'First', start: day('2026-09-03') }).seasons.map((season) => season.name)).toEqual(['First']);
  });

  it('numbers a new season that would get the name of an existing one', () => {
    const updated = withNewSeason(thursday, { name: '2026/27', start: day('2027-01-10') });

    expect(updated.seasons.map((season) => season.name)).toEqual(['2025/26', '2026/27', '2026/27 (2)']);
  });

  it('converts to and from date inputs in local time', () => {
    expect(toDateInput(day('2026-09-03') + 3600000)).toBe('2026-09-03');
    expect(fromDateInput('2026-09-03')).toBe(day('2026-09-03'));
    expect(fromDateInput('03.09.2026')).toBeUndefined();
  });
});
