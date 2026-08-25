export interface GitHubIssue {
  body: string;
  closed_at?: string;
  created_at: string;
  html_url: string;
  id: number;
  labels: GitHubLabel[];
  number: number;
  pull_request?: string;
  state: 'open' | 'closed';
  title: string;
  updated_at: string;
  user: {
    avatar_url: string;
    login: string;
  };
}

export interface GitHubLabel {
  color: string;
  description: string | null;
  id: number;
  name: string;
}
