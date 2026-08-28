export type GitHubRepositoryRef = {
  owner: string;
  name: string;
  canonical_url: string;
};

export type GitHubRepositoryMetadata = GitHubRepositoryRef & {
  full_name: string;
  description: string | null;
  branch: "main";
  main_available: boolean;
  main_sha: string | null;
  readme_available: boolean;
  commit_history_available: boolean;
};

export type GitHubCommitAuthor = {
  login: string | null;
  name: string | null;
};

export type GitHubCommitSummary = {
  sha: string;
  message: string;
  author: GitHubCommitAuthor;
  authored_at: string | null;
  committed_at: string | null;
  canonical_url: string;
};

export type GitHubChangedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
};

export type GitHubCommitDetails = GitHubCommitSummary & {
  files: GitHubChangedFile[];
  files_truncated: boolean;
};

export type GitHubCommitPage = {
  commits: GitHubCommitSummary[];
  has_more: boolean;
};

export type GitHubReadme = {
  text: string;
};

export type GitHubClientOptions = {
  cache?: Pick<Cache, "match" | "put">;
  waitUntil?: (promise: Promise<unknown>) => void;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export type GitHubClient = {
  getRepository(ref: GitHubRepositoryRef): Promise<GitHubRepositoryMetadata>;
  getReadme(ref: GitHubRepositoryRef): Promise<GitHubReadme>;
  listCommits(ref: GitHubRepositoryRef, limit: number, page: number): Promise<GitHubCommitPage>;
  getCommit(ref: GitHubRepositoryRef, sha: string): Promise<GitHubCommitDetails>;
};
