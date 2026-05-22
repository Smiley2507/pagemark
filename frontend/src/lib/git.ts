export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

const GIT_URL_PATTERN =
  /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+(\/)?(\.git)?$/i;

export function validateGitUrl(url: string): boolean {
  const trimmed = url.trim().replace(/\.git$/, '');
  return GIT_URL_PATTERN.test(trimmed) || GIT_URL_PATTERN.test(trimmed + '/');
}

export function detectProvider(url: string): GitProvider | null {
  try {
    const host = new URL(url.trim().replace(/\.git$/, '')).hostname.toLowerCase();
    if (host.includes('github.com')) return 'github';
    if (host.includes('gitlab.com')) return 'gitlab';
    if (host.includes('bitbucket.org')) return 'bitbucket';
    return null;
  } catch {
    return null;
  }
}

export function parseOwnerRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:8000';
}

export function getOAuthAuthorizeUrl(provider: 'github' | 'gitlab'): string {
  return `${getApiBaseUrl()}/auth/${provider}/authorize`;
}
