export type GitProvider = 'github' | 'bitbucket';

const GIT_URL_PATTERN =
  /^https?:\/\/(github\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+(\/)?(\.git)?$/i;

export function validateGitUrl(url: string): boolean {
  const trimmed = url.trim().replace(/\.git$/, '');
  return GIT_URL_PATTERN.test(trimmed) || GIT_URL_PATTERN.test(trimmed + '/');
}

export function parseOwnerRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
}

export function detectProvider(url: string): 'github' | 'bitbucket' | null {
  const domain = url.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (domain.includes('github.com')) return 'github';
  if (domain.includes('bitbucket.org')) return 'bitbucket';
  return null;
}

export function getOAuthAuthorizeUrl(provider: 'github'): string {
  return `${getApiBaseUrl()}/auth/${provider}/authorize`;
}

const OAUTH_RETURN_PATH_KEY = 'pagemark.oauthReturnPath';

export function rememberOAuthReturnPath(path: string): void {
  window.sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, path);
}

export function consumeOAuthReturnPath(): string | null {
  const path = window.sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
  if (path) {
    window.sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
  }
  return path;
}
