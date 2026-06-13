/**
 * Deterministic fixtures for every remote service the app talks to. These power
 * the network mocks in lib/mocks.ts so the Ball Library, Pattern Library and
 * Alley Map render rich, identical content on every run — offline.
 *
 * To refresh these from the live APIs, run `npm run capture:fixtures` (see
 * capture-fixtures.spec.ts) and paste the recorded JSON back in here.
 */
import type { Ball, Brand, Core, Coverstock } from '../../../src/app/core/models/ball.model';
import type { Pattern } from '../../../src/app/core/models/pattern.model';

type RawBall = {
  ball_id: string;
  ball_name: string;
  brand_name: string;
  core_name: string;
  core_type: string;
  core_rg: string;
  core_diff: string;
  core_int_diff: string;
  coverstock_name: string;
  coverstock_type: string;
  factory_finish: string;
  release_date: string;
  thumb: number;
};

const RAW: RawBall[] = [
  {
    ball_id: '101',
    ball_name: 'Phaze II',
    brand_name: 'Storm',
    core_name: 'Catalyst',
    core_type: 'Symmetric',
    core_rg: '2.48',
    core_diff: '0.051',
    core_int_diff: '',
    coverstock_name: 'R2S Pearl',
    coverstock_type: 'Pearl Reactive',
    factory_finish: '1500-grit Polished',
    release_date: '2018-09-12',
    thumb: 0,
  },
  {
    ball_id: '102',
    ball_name: 'IQ Tour',
    brand_name: 'Storm',
    core_name: 'C3 Centripetal',
    core_type: 'Symmetric',
    core_rg: '2.49',
    core_diff: '0.046',
    core_int_diff: '',
    coverstock_name: 'R2S Solid',
    coverstock_type: 'Solid Reactive',
    factory_finish: '3000-grit Abralon',
    release_date: '2014-02-10',
    thumb: 1,
  },
  {
    ball_id: '103',
    ball_name: 'Hustle INK',
    brand_name: 'Roto Grip',
    core_name: 'Hustle',
    core_type: 'Symmetric',
    core_rg: '2.57',
    core_diff: '0.038',
    core_int_diff: '',
    coverstock_name: 'MicroTrax',
    coverstock_type: 'Solid Reactive',
    factory_finish: '500/1000/1500 Polished',
    release_date: '2019-05-01',
    thumb: 2,
  },
  {
    ball_id: '104',
    ball_name: 'DNA',
    brand_name: 'Storm',
    core_name: 'RAD4',
    core_type: 'Asymmetric',
    core_rg: '2.47',
    core_diff: '0.054',
    core_int_diff: '0.018',
    coverstock_name: 'NeX Solid',
    coverstock_type: 'Solid Reactive',
    factory_finish: '3000-grit Abralon',
    release_date: '2020-08-21',
    thumb: 3,
  },
  {
    ball_id: '105',
    ball_name: 'Zen Master',
    brand_name: '900 Global',
    core_name: 'Enso',
    core_type: 'Asymmetric',
    core_rg: '2.48',
    core_diff: '0.052',
    core_int_diff: '0.016',
    coverstock_name: 'S77',
    coverstock_type: 'Solid Reactive',
    factory_finish: '3000-grit Abralon',
    release_date: '2021-03-19',
    thumb: 4,
  },
  {
    ball_id: '106',
    ball_name: 'Black Widow 2.0',
    brand_name: 'Hammer',
    core_name: 'Gas Mask',
    core_type: 'Asymmetric',
    core_rg: '2.50',
    core_diff: '0.058',
    core_int_diff: '0.017',
    coverstock_name: 'Aggression Solid',
    coverstock_type: 'Solid Reactive',
    factory_finish: '500/2000 Abralon',
    release_date: '2020-01-15',
    thumb: 5,
  },
  {
    ball_id: '107',
    ball_name: 'Phaze 4',
    brand_name: 'Storm',
    core_name: 'Velocity',
    core_type: 'Symmetric',
    core_rg: '2.49',
    core_diff: '0.055',
    core_int_diff: '',
    coverstock_name: 'AeroPlus',
    coverstock_type: 'Solid Reactive',
    factory_finish: '3000-grit Abralon',
    release_date: '2022-06-10',
    thumb: 6,
  },
  {
    ball_id: '108',
    ball_name: 'Idol Pearl',
    brand_name: 'Roto Grip',
    core_name: 'Ikon',
    core_type: 'Symmetric',
    core_rg: '2.49',
    core_diff: '0.050',
    core_int_diff: '',
    coverstock_name: 'eTrax Pearl',
    coverstock_type: 'Pearl Reactive',
    factory_finish: '1500 Polished',
    release_date: '2019-09-04',
    thumb: 7,
  },
  {
    ball_id: '109',
    ball_name: 'Gem',
    brand_name: 'Roto Grip',
    core_name: 'Nucleus',
    core_type: 'Asymmetric',
    core_rg: '2.48',
    core_diff: '0.053',
    core_int_diff: '0.015',
    coverstock_name: 'eTrax-S18',
    coverstock_type: 'Solid Reactive',
    factory_finish: '3000-grit Abralon',
    release_date: '2022-02-08',
    thumb: 0,
  },
  {
    ball_id: '110',
    ball_name: 'Spare Ball White',
    brand_name: 'Storm',
    core_name: 'Polyester',
    core_type: 'Symmetric',
    core_rg: '2.55',
    core_diff: '0.010',
    core_int_diff: '',
    coverstock_name: 'Polyester',
    coverstock_type: 'Plastic',
    factory_finish: 'Polished',
    release_date: '2010-01-01',
    thumb: 1,
  },
  {
    ball_id: '111',
    ball_name: 'Pitch Black',
    brand_name: 'Storm',
    core_name: 'Capacitor',
    core_type: 'Symmetric',
    core_rg: '2.49',
    core_diff: '0.048',
    core_int_diff: '',
    coverstock_name: 'Black Cap',
    coverstock_type: 'Urethane',
    factory_finish: '2000-grit Abralon',
    release_date: '2017-08-01',
    thumb: 2,
  },
  {
    ball_id: '112',
    ball_name: 'Trend 2',
    brand_name: 'Storm',
    core_name: 'Surge',
    core_type: 'Asymmetric',
    core_rg: '2.49',
    core_diff: '0.054',
    core_int_diff: '0.017',
    coverstock_name: 'TX-23',
    coverstock_type: 'Solid Reactive',
    factory_finish: '3000-grit Abralon',
    release_date: '2023-01-12',
    thumb: 3,
  },
];

function expandBall(raw: RawBall, weight = '15'): Ball {
  return {
    availability: 'Available',
    ball_id: raw.ball_id,
    ball_image: `/sites/ball-${raw.thumb}.png`,
    ball_name: raw.ball_name,
    brand_id: raw.brand_name.toLowerCase().replace(/\s+/g, '-'),
    brand_name: raw.brand_name,
    core_diff: raw.core_diff,
    core_id: `core-${raw.ball_id}`,
    core_image: `/sites/core-${raw.thumb}.png`,
    core_int_diff: raw.core_int_diff,
    core_name: raw.core_name,
    core_rg: raw.core_rg,
    core_type: raw.core_type,
    core_weight: weight,
    coverstock_id: `cover-${raw.ball_id}`,
    coverstock_name: raw.coverstock_name,
    coverstock_type: raw.coverstock_type,
    factory_finish: raw.factory_finish,
    last_update: '2024-01-01',
    release_date: raw.release_date,
    thumbnail_image: `/sites/ball-${raw.thumb}.png`,
    us_int: 'US',
    position: undefined,
  };
}

export const BALLS: Ball[] = RAW.map((r) => expandBall(r));

export const BRANDS: Brand[] = Array.from(new Set(BALLS.map((b) => b.brand_name))).map((name, i) => ({
  brand_name: name,
  id: String(i + 1),
  logo: `/sites/brand-${i}.png`,
}));

export const CORES: Core[] = BALLS.map((b) => ({
  core_name: b.core_name,
  brand: b.brand_name,
  id: b.core_id,
  api_filter_url: `core/${b.core_id}`,
}));

export const COVERSTOCKS: Coverstock[] = BALLS.map((b) => ({
  coverstock_name: b.coverstock_name,
  brand: b.brand_name,
  id: b.coverstock_id,
  api_filter_url: `cover/${b.coverstock_id}`,
}));

// ---- Patterns -------------------------------------------------------------

type RawPattern = {
  title: string;
  category: string;
  distance: string;
  ratio: string;
  volume: string;
  forward: string;
  reverse: string;
  pump: string;
  tanks: string;
  chart: number;
};

const RAW_PATTERNS: RawPattern[] = [
  {
    title: 'PBA Cheetah 35',
    category: 'PBA Animal',
    distance: '35',
    ratio: '2.79',
    volume: '18.45',
    forward: '9.2',
    reverse: '9.25',
    pump: '40',
    tanks: '6',
    chart: 0,
  },
  {
    title: 'PBA Viper 37',
    category: 'PBA Animal',
    distance: '37',
    ratio: '4.10',
    volume: '21.30',
    forward: '10.6',
    reverse: '10.7',
    pump: '45',
    tanks: '6',
    chart: 1,
  },
  {
    title: 'PBA Chameleon 39',
    category: 'PBA Animal',
    distance: '39',
    ratio: '4.88',
    volume: '23.05',
    forward: '11.4',
    reverse: '11.65',
    pump: '45',
    tanks: '6',
    chart: 2,
  },
  {
    title: 'PBA Scorpion 41',
    category: 'PBA Animal',
    distance: '41',
    ratio: '6.41',
    volume: '25.95',
    forward: '12.9',
    reverse: '13.05',
    pump: '50',
    tanks: '6',
    chart: 3,
  },
  {
    title: 'PBA Shark 44',
    category: 'PBA Animal',
    distance: '44',
    ratio: '8.95',
    volume: '30.10',
    forward: '15.0',
    reverse: '15.1',
    pump: '55',
    tanks: '6',
    chart: 4,
  },
  {
    title: 'Kegel Main Street',
    category: 'Kegel Recreational',
    distance: '39',
    ratio: '5.20',
    volume: '22.40',
    forward: '11.1',
    reverse: '11.3',
    pump: '45',
    tanks: '6',
    chart: 1,
  },
  {
    title: 'Kegel Stone Street',
    category: 'Kegel Sport',
    distance: '41',
    ratio: '3.10',
    volume: '24.85',
    forward: '12.3',
    reverse: '12.55',
    pump: '48',
    tanks: '6',
    chart: 2,
  },
  {
    title: 'Kegel Beaten Path',
    category: 'Kegel Challenge',
    distance: '43',
    ratio: '2.40',
    volume: '26.10',
    forward: '13.0',
    reverse: '13.1',
    pump: '50',
    tanks: '6',
    chart: 3,
  },
  {
    title: 'USBC Red',
    category: 'USBC',
    distance: '40',
    ratio: '3.00',
    volume: '25.50',
    forward: '12.6',
    reverse: '12.9',
    pump: '48',
    tanks: '6',
    chart: 0,
  },
];

function expandPattern(raw: RawPattern): Pattern {
  const url = raw.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    url,
    title: raw.title,
    category: raw.category,
    distance: raw.distance,
    ratio: raw.ratio,
    volume: raw.volume,
    forward: raw.forward,
    reverse: raw.reverse,
    pump: raw.pump,
    tanks: raw.tanks,
    pdf_url: `https://images.lightningbowl.de/${url}.pdf`,
    kosi_url: `https://images.lightningbowl.de/${url}.kosi`,
    forwards_data: [],
    reverse_data: [],
    chart_standard: `${url}-standard-${raw.chart}.png`,
    chart_horizontal: `${url}-horizontal-${raw.chart}.png`,
  };
}

export const PATTERNS: Pattern[] = RAW_PATTERNS.map(expandPattern);
export const PATTERN_CATEGORIES = Array.from(new Set(PATTERNS.map((p) => p.category)));

// ---- Alley map (Overpass + Nominatim) ------------------------------------

export const OVERPASS_RESPONSE = {
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 40.7138,
      lon: -74.004,
      tags: {
        name: 'Frames Bowling Lounge',
        leisure: 'bowling_alley',
        'addr:housenumber': '550',
        'addr:street': '9th Ave',
        'addr:city': 'New York',
        'addr:postcode': '10018',
        opening_hours: 'Mo-Su 11:00-02:00',
        phone: '+1 212-555-0143',
        website: 'framesnyc.com',
      },
    },
    {
      type: 'node',
      id: 2,
      lat: 40.7038,
      lon: -73.99,
      tags: {
        name: 'Brooklyn Bowl',
        leisure: 'bowling_alley',
        'addr:housenumber': '61',
        'addr:street': 'Wythe Ave',
        'addr:city': 'Brooklyn',
        'addr:postcode': '11249',
        opening_hours: 'Mo-Su 18:00-00:00',
        phone: '+1 718-555-0199',
        website: 'brooklynbowl.com',
      },
    },
    {
      type: 'node',
      id: 3,
      lat: 40.7218,
      lon: -74.012,
      tags: {
        name: 'Lucky Strike Lanes',
        sport: 'bowling',
        'addr:street': 'W 42nd St',
        'addr:city': 'New York',
        opening_hours: 'Mo-Th 12:00-00:00; Fr-Su 12:00-02:00',
        phone: '+1 212-555-0177',
      },
    },
    {
      type: 'node',
      id: 4,
      lat: 40.7008,
      lon: -74.014,
      tags: {
        name: 'Bowlero Chelsea Piers',
        amenity: 'bowling_alley',
        'addr:street': 'Pier 60',
        'addr:city': 'New York',
        opening_hours: 'Mo-Su 10:00-00:00',
      },
    },
    {
      type: 'node',
      id: 5,
      lat: 40.7268,
      lon: -73.995,
      tags: {
        name: 'The Gutter',
        sport: '10pin',
        'addr:street': 'N 14th St',
        'addr:city': 'Brooklyn',
        opening_hours: 'Mo-Su 16:00-02:00',
        website: 'thegutterbrooklyn.com',
      },
    },
    {
      type: 'node',
      id: 6,
      lat: 40.7098,
      lon: -73.985,
      tags: { name: 'Melody Lanes', leisure: 'bowling_alley', 'addr:street': '461 37th St', 'addr:city': 'Brooklyn', phone: '+1 718-555-0120' },
    },
  ],
};

export const NOMINATIM_RESPONSE = [{ lat: '40.6782', lon: '-73.9442', display_name: 'Brooklyn, New York, United States' }];
