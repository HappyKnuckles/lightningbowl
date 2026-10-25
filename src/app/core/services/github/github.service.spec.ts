import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GitHubIssue } from 'src/app/core/models/github-issue.model';
import { GitHubService } from './github.service';

const ISSUES_URL = 'https://api.github.com/repos/HappyKnuckles/Lightning-Bowl/issues';

function issue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    id: 1,
    number: 1,
    title: 'An issue',
    body: '',
    state: 'open',
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    html_url: '',
    user: { login: 'someone', avatar_url: '' },
    ...overrides,
  };
}

describe('GitHubService', () => {
  let service: GitHubService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GitHubService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getIssues', () => {
    it('requests open issues newest first by default', async () => {
      const pending = service.getIssues();

      const req = httpMock.expectOne((r) => r.url === ISSUES_URL);
      expect(req.request.params.get('state')).toBe('open');
      expect(req.request.params.get('sort')).toBe('created');
      expect(req.request.params.get('direction')).toBe('desc');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('per_page')).toBe('30');
      expect(req.request.params.has('labels')).toBe(false);
      req.flush([]);

      await pending;
    });

    it('passes state, paging and labels through', async () => {
      const pending = service.getIssues(['feature', 'bug'], 'closed', 2, 50);

      const req = httpMock.expectOne((r) => r.url === ISSUES_URL);
      expect(req.request.params.get('state')).toBe('closed');
      expect(req.request.params.get('labels')).toBe('feature,bug');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('per_page')).toBe('50');
      req.flush([]);

      await pending;
    });

    it('drops pull requests from the response', async () => {
      const pending = service.getIssues();

      httpMock.expectOne((r) => r.url === ISSUES_URL).flush([issue({ id: 1 }), issue({ id: 2, pull_request: 'https://example.com/pr/2' })]);

      expect((await pending).map((i) => i.id)).toEqual([1]);
    });

    it('returns an empty list when the request fails', async () => {
      const pending = service.getIssues();

      httpMock.expectOne((r) => r.url === ISSUES_URL).flush('rate limited', { status: 403, statusText: 'Forbidden' });

      await expect(pending).resolves.toEqual([]);
    });
  });

  describe('convenience wrappers', () => {
    it('getFeatureIssues asks for open feature issues', async () => {
      const pending = service.getFeatureIssues();

      const req = httpMock.expectOne((r) => r.url === ISSUES_URL);
      expect(req.request.params.get('labels')).toBe('feature');
      expect(req.request.params.get('state')).toBe('open');
      req.flush([]);

      await pending;
    });

    it('getClosedFeatures asks for closed issues with the given labels', async () => {
      const pending = service.getClosedFeatures(['feature'], 3, 10);

      const req = httpMock.expectOne((r) => r.url === ISSUES_URL);
      expect(req.request.params.get('state')).toBe('closed');
      expect(req.request.params.get('page')).toBe('3');
      req.flush([]);

      await pending;
    });

    it('getOpenFeatures asks for open issues with the given labels', async () => {
      const pending = service.getOpenFeatures(['feature']);

      const req = httpMock.expectOne((r) => r.url === ISSUES_URL);
      expect(req.request.params.get('state')).toBe('open');
      req.flush([]);

      await pending;
    });
  });
});
