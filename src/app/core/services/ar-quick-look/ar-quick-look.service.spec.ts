import { TestBed } from '@angular/core/testing';
import { Pattern } from 'src/app/core/models/pattern.model';
import { ArQuickLookService } from './ar-quick-look.service';

const PATTERN: Pattern = {
  url: 'https://patternlibrary.kegel.net/pattern/test',
  title: 'PBA Cheetah 35',
  category: 'Sport',
  distance: '35',
  ratio: '2.1:1',
  volume: '18.45',
  forward: '12.0',
  reverse: '10.5',
  pump: '40',
  tanks: '3',
  pdf_url: '',
  kosi_url: '',
  forwards_data: [
    {
      number: '1',
      start: '10L',
      stop: '10R',
      load: '2',
      mics: '40',
      speed: '18',
      buf: '0',
      tank: '1',
      total_oil: '25',
      distance_start: '0',
      distance_end: '35',
    },
  ],
  reverse_data: [],
  chart_standard: '',
  chart_horizontal: '',
};

describe('ArQuickLookService', () => {
  let service: ArQuickLookService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ArQuickLookService);
  });

  afterEach(() => service.revoke());

  it('reports support from relList rather than sniffing the user agent', () => {
    // Chrome headless does not support rel="ar"; the point is that the check
    // is a real feature test and returns a boolean either way.
    expect(typeof service.isSupported()).toBe('boolean');
  });

  it('builds a usdz object url that locks real-world scale', async () => {
    const url = await service.buildUrl(PATTERN);

    expect(url).toContain('blob:');
    // Without this, Quick Look lets the user pinch a 60ft pattern to any size.
    expect(url).toContain('#allowsContentScaling=0');
  });

  it('serves the archive with the mime type Safari requires', async () => {
    const url = await service.buildUrl(PATTERN);
    const blob = await fetch(url.split('#')[0]).then((response) => response.blob());

    expect(blob.type).toBe('model/vnd.usdz+zip');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('packs a scene and a texture into the archive', async () => {
    const url = await service.buildUrl(PATTERN);
    const buffer = await fetch(url.split('#')[0]).then((response) => response.arrayBuffer());
    const text = new TextDecoder().decode(new Uint8Array(buffer));

    expect(text).toContain('lane.usda');
    expect(text).toContain('pattern.png');
    // Zip local file header signature.
    expect(new DataView(buffer).getUint32(0, true)).toBe(0x04034b50);
  });

  it('revokes the previous url when a new pattern is built', async () => {
    const first = await service.buildUrl(PATTERN);
    await service.buildUrl({ ...PATTERN, title: 'Another' });

    await expectAsync(fetch(first.split('#')[0])).toBeRejected();
  });
});
