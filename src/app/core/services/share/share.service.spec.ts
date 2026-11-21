import { TestBed } from '@angular/core/testing';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { makeBall } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { vi } from 'vitest';

import { LoadingService } from '../loader/loading.service';
import { ToastService } from '../toast/toast.service';
import { ShareService } from './share.service';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('ShareService', () => {
  let service: ShareService;
  let toastService: SpyObj<ToastService>;
  let renderImage: ReturnType<typeof vi.fn>;
  let navigatorShare: ReturnType<typeof vi.fn>;
  const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
  const originalCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare');

  const stubNavigator = (share: unknown, canShare: unknown) => {
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
  };

  beforeEach(() => {
    toastService = createSpyObj<ToastService>(['showToast']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: toastService },
        { provide: LoadingService, useValue: { setLoading: vi.fn() } },
      ],
    });
    service = TestBed.inject(ShareService);
    renderImage = vi.fn().mockResolvedValue(PNG);
    (service as unknown as { renderImage: unknown }).renderImage = renderImage;
    navigatorShare = vi.fn().mockResolvedValue(undefined);
    stubNavigator(navigatorShare, () => true);
  });

  afterEach(() => {
    for (const [name, descriptor] of [
      ['share', originalShare],
      ['canShare', originalCanShare],
    ] as const) {
      if (descriptor) Object.defineProperty(navigator, name, descriptor);
      else delete (navigator as unknown as Record<string, unknown>)[name];
    }
    vi.restoreAllMocks();
  });

  it('shares a screenshot of the element with the text', async () => {
    const element = document.createElement('div');
    await service.shareBall(makeBall({ ball_id: '42', ball_name: 'Phaze II' }), element);

    expect(renderImage).toHaveBeenCalledWith(element);
    const data = navigatorShare.mock.calls[0][0] as ShareData;
    expect(data.title).toBe('Phaze II');
    expect(data.text).toContain('Phaze II');
    expect(data.files?.[0].name).toBe('ball_42.png');
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it('shares the text alone when the screenshot fails', async () => {
    renderImage.mockResolvedValue(undefined);
    await service.shareBall(makeBall(), document.createElement('div'));

    const data = navigatorShare.mock.calls[0][0] as ShareData;
    expect(data.files).toBeUndefined();
    expect(data.text).toContain('Test Ball');
  });

  it('stays quiet when the share sheet is closed', async () => {
    navigatorShare.mockRejectedValue(new DOMException('Share canceled', 'AbortError'));
    await service.shareBall(makeBall());

    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it('reports other errors', async () => {
    navigatorShare.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await service.shareBall(makeBall());

    expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.shareError, 'bug', true);
  });

  it('falls back to the native share sheet without the Web Share API', async () => {
    stubNavigator(undefined, undefined);
    // Capacitor's plugin proxy can't be spied on, so stub the native path itself
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    (service as unknown as { shareViaCapacitor: unknown }).shareViaCapacitor = nativeShare;
    await service.shareBall(makeBall({ ball_id: '42', ball_name: 'Phaze II' }), document.createElement('div'));

    expect(nativeShare).toHaveBeenCalledWith('Phaze II', expect.stringContaining('Phaze II'), PNG, 'ball_42');
    expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.shareSuccess, 'share-social-outline');
  });
});
