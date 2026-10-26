/** No DNS names, alternate numeric spellings, paths, credentials, or redirects. */
export function validateEndpoint(value: string): string {
  const raw = value.trim();
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/.test(raw))
    throw new Error(
      'Use a loopback URL such as http://localhost:11434 or http://127.0.0.1:11434, without a path.',
    );
  const url = new URL(raw);
  if (url.port && Number(url.port) === 0) throw new Error('Choose a port between 1 and 65535.');
  return url.origin;
}
