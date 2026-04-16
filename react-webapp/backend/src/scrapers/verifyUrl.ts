/**
 * URL verification utilities:
 *
 *  verifyUrl()            — checks the link is alive (2xx/3xx)
 *  hasNonEnglishPath()    — detects language codes in the URL that signal a
 *                           non-English page (/fr/, de.example.com, ?lang=de)
 *  verifyEnglishUrl()     — combines both checks
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; OpportunityVerifier/1.0)',
};

// ISO 639-1 codes for non-English languages
const NON_EN_LANGS = new Set([
  'de', 'fr', 'es', 'pt', 'zh', 'ja', 'ko', 'ru', 'ar', 'it', 'nl', 'pl',
  'tr', 'uk', 'vi', 'th', 'id', 'cs', 'hu', 'ro', 'sv', 'da', 'fi', 'no',
  'he', 'fa', 'bn', 'ta', 'te', 'ur', 'ms', 'bg', 'sr', 'hr', 'sk', 'sl',
  'lt', 'lv', 'et', 'mk', 'bs', 'sq', 'hy', 'ka', 'az', 'kk', 'mn',
]);

/**
 * Returns true if the URL contains a clear signal that the target page
 * is in a non-English language:
 *   • subdomain:  de.example.com
 *   • first path: example.com/fr/page
 *   • query param: ?lang=de  ?hl=fr  ?language=ja
 *
 * An explicit English indicator (/en/, ?lang=en) is treated as passing.
 */
export function hasNonEnglishPath(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Explicit English path → always pass
    const pathname = parsed.pathname.toLowerCase();
    if (/(?:^|\/)en(?:[-_][a-z]{2})?(?:\/|$)/.test(pathname)) return false;

    // Non-English first path segment  (e.g. /fr/jobs)
    const firstSeg = pathname.split('/').filter(Boolean)[0] ?? '';
    if (NON_EN_LANGS.has(firstSeg)) return true;

    // Non-English subdomain (e.g. de.example.com)
    const parts = parsed.hostname.split('.');
    if (parts.length > 2 && NON_EN_LANGS.has(parts[0].toLowerCase())) return true;

    // Explicit ?lang= / ?hl= / ?language= query param
    const langParam =
      parsed.searchParams.get('lang') ??
      parsed.searchParams.get('hl') ??
      parsed.searchParams.get('language') ??
      '';
    if (langParam && NON_EN_LANGS.has(langParam.slice(0, 2).toLowerCase())) return true;

    return false;
  } catch {
    return false; // malformed URL → let verifyUrl handle it
  }
}

/**
 * Checks whether a URL is reachable (2xx/3xx).
 * Uses HEAD first, falls back to GET if the server rejects HEAD.
 */
export async function verifyUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: HEADERS,
    });
    clearTimeout(timer);

    if (res.status === 405 || res.status === 501) {
      const ctrl2  = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), timeoutMs);
      res = await fetch(url, {
        method: 'GET',
        signal: ctrl2.signal,
        redirect: 'follow',
        headers: HEADERS,
      });
      clearTimeout(timer2);
    }

    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

/**
 * Combined check: URL must be alive AND not point to a non-English page.
 */
export async function verifyEnglishUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  if (hasNonEnglishPath(url)) return false;
  return verifyUrl(url, timeoutMs);
}
