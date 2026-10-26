export const GOOGLE_HOSTS = [
  'www.google.com',
  'google.com',
  'www.google.com.au',
  'google.com.au',
] as const;
export function searchQuery(href: string): string | null {
  try {
    const url = new URL(href);
    if (
      url.protocol !== 'https:' ||
      !(GOOGLE_HOSTS as readonly string[]).includes(url.hostname) ||
      url.pathname !== '/search'
    )
      return null;
    if (
      url.searchParams.has('tbm') ||
      (url.searchParams.has('udm') && url.searchParams.get('udm') !== '14')
    )
      return null;
    return url.searchParams.get('q')?.trim().slice(0, 2000) || null;
  } catch {
    return null;
  }
}
