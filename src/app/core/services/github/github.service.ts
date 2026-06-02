import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GitHubIssue } from '../../models/github-issue.model';

@Injectable({
  providedIn: 'root',
})
export class GitHubService {
  private http = inject(HttpClient);

  private readonly baseUrl = 'https://api.github.com';
  private readonly repoOwner = 'HappyKnuckles';
  private readonly repoName = 'Lightning-Bowl';

  async getIssues(labels: string[] = [], state: 'open' | 'closed' | 'all' = 'open', page = 1, perPage = 30): Promise<GitHubIssue[]> {
    try {
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

      const response = await firstValueFrom(this.http.get<GitHubIssue[]>(url, { params }));

      return response.filter((issue) => !issue.pull_request);
    } catch (error) {
      console.error('Error fetching GitHub issues:', error);
      return [];
    }
  }

  async getFeatureIssues(): Promise<GitHubIssue[]> {
    return this.getIssues(['feature']);
  }

  async getClosedFeatures(labels: string[] = [], page = 1, perPage = 30): Promise<GitHubIssue[]> {
    return this.getIssues(labels, 'closed', page, perPage);
  }

  async getOpenFeatures(labels: string[] = [], page = 1, perPage = 30): Promise<GitHubIssue[]> {
    return this.getIssues(labels, 'open', page, perPage);
  }
}
