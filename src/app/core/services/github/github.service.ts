import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { GitHubIssue } from '../../models/github-issue.model';

@Injectable({
  providedIn: 'root',
})
export class GitHubService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly repoOwner = 'HappyKnuckles';
  private readonly repoName = 'Lightning-Bowl';

  constructor(private http: HttpClient) {}

  getIssues(labels: string[] = [], state: 'open' | 'closed' | 'all' = 'open', page = 1, perPage = 30): Observable<GitHubIssue[]> {
    const url = `${this.baseUrl}/repos/${this.repoOwner}/${this.repoName}/issues`;
    const params: Record<string, string | number> = {
      state,
      sort: 'created',
      direction: 'desc',
      page,
      per_page: perPage,
    };

    if (labels.length > 0) {
      params['labels'] = labels.join(',');
    }

    return this.http.get<GitHubIssue[]>(url, { params }).pipe(
      map((response) => response.filter((issue) => !issue.pull_request)),
      catchError((error) => {
        console.error('Error fetching GitHub issues:', error);
        return of([]);
      }),
    );
  }

  getFeatureIssues(): Observable<GitHubIssue[]> {
    return this.getIssues(['feature']);
  }

  getClosedFeatures(labels: string[] = [], page = 1, perPage = 30): Observable<GitHubIssue[]> {
    return this.getIssues(labels, 'closed', page, perPage);
  }

  getOpenFeatures(labels: string[] = [], page = 1, perPage = 30): Observable<GitHubIssue[]> {
    return this.getIssues(labels, 'open', page, perPage);
  }
}
