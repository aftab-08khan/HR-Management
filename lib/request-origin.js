function parseOrigin(value) {
  if (typeof value !== 'string' || value.length > 2048 || !/^https?:\/\/[^/?#\\\s]+$/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/^(?:[a-z\d._-]+|\[[a-f\d:.]+\])$/i.test(url.hostname)) return null;
    return url.origin;
  } catch {return null;}
}

function configuredOrigin(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    return parseOrigin(url.origin);
  } catch {return null;}
}

/** Use the browser's Host when Next constructs req.url from an internal listening address. */
export function validRequestOrigin(req, configuredUrl = process.env.NEXTAUTH_URL) {
  if (req.headers.get('sec-fetch-site')?.trim().toLowerCase() === 'cross-site') return false;
  const supplied = req.headers.get('origin');
  // CLI clients do not normally send Origin. Browser cross-site requests are rejected above.
  if (supplied === null) return true;
  const origin = parseOrigin(supplied);
  if (!origin) return false;
  if (origin === configuredOrigin(configuredUrl)) return true;
  try {
    const requestUrl = new URL(req.url);
    if (!['http:', 'https:'].includes(requestUrl.protocol)) return false;
    const host = req.headers.get('host');
    // Forwarded-Host/Proto are deliberately ignored; a configured public URL is the trust boundary.
    const expected = host === null ? parseOrigin(requestUrl.origin) : parseOrigin(`${requestUrl.protocol}//${host}`);
    return expected !== null && origin === expected;
  } catch {return false;}
}
